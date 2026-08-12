import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { buildReceiptPdf } from '../_shared/receipt-pdf.ts';

type ManualAttachmentRequest = { booking_id?: string; receipt_number?: string };
type BookingRow = {
  id: string;
  user_id: string | null;
  event_title: string;
  start_time: string;
  end_time: string;
  status: 'approved' | 'rejected' | string;
  admin_remarks: string | null;
  halls: { name: string | null } | { name: string | null }[] | null;
  requester: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null;
};
type ReceiptRow = { id: string; booking_id: string; receipt_no: string; status: 'approved' | 'rejected'; pdf_path: string; storage_deleted_at: string | null };

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('VENUEVERSE_ALLOWED_WEB_ORIGIN') ?? '',
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const bucketName = 'booking-receipts';
const smtpTimeoutMs = 120_000;
const maxPdfAttachmentBytes = 10 * 1024 * 1024;
const defaultReceiptEmailLogoUrl = 'https://ovpmleiiwdvbvndplwqp.supabase.co/storage/v1/object/public/email-assets/venueverse-email-logo.png';
const receiptEmailLogoSrc = Deno.env.get('EMAIL_LOGO_URL') ?? defaultReceiptEmailLogoUrl;
const receiptSelect = 'id, booking_id, receipt_no, status, pdf_path, storage_deleted_at';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const startedAt = Date.now();
  let receiptForError: ReceiptRow | null = null;
  let bookingForError: BookingRow | null = null;
  let serviceClient: ReturnType<typeof createClient> | null = null;
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return jsonResponse({ error: 'Supabase environment variables are missing.' }, 500);

    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
    if (!jwt) return jsonResponse({ error: 'Unauthorized.' }, 401);

    serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } }
    });

    const { data: authData, error: authError } = await serviceClient.auth.getUser(jwt);
    if (authError || !authData.user) return jsonResponse({ error: 'Unauthorized.' }, 401);

    const payload = (await req.json().catch(() => ({}))) as ManualAttachmentRequest;
    const receipt = await fetchReceipt(serviceClient, payload);
    receiptForError = receipt;
    if (!receipt) return jsonResponse({ error: 'Receipt not found.' }, 404);
    if (receipt.status !== 'approved' && receipt.status !== 'rejected') return jsonResponse({ error: 'Receipt is not available.' }, 400);

    const canView = await canViewBooking(userClient, receipt.booking_id);
    if (!canView) return jsonResponse({ error: 'Forbidden.' }, 403);

    const rateAllowed = await checkRateLimit(serviceClient, receipt.id);
    if (!rateAllowed) return jsonResponse({ error: 'Please wait before sending another PDF copy.' }, 429);

    const booking = await fetchBooking(serviceClient, receipt.booking_id);
    bookingForError = booking;
    if (!booking) return jsonResponse({ error: 'Booking not found.' }, 404);
    const requesterEmail = single(booking.requester)?.email?.trim();
    if (!requesterEmail) return jsonResponse({ error: 'Requester email is unavailable.' }, 400);

    const pdf = await getReceiptPdfAttachment(serviceClient, receipt);
    validateReceiptPdf(pdf.pdfBytes);
    const bookingRef = formatBookingRef(booking.id, new Date(booking.start_time).getFullYear());

    await sendReceiptAttachmentEmail({
      booking,
      bookingRef,
      receiptNo: receipt.receipt_no,
      recipientEmail: requesterEmail,
      pdfBytes: pdf.pdfBytes,
      attachmentFileName: `${receipt.receipt_no}.pdf`
    });

    await recordAttachmentSent(serviceClient, receipt.id, requesterEmail);
    await insertNotification(serviceClient, booking, receipt);
    console.log('[receipt-pdf-attachment] sent', { receiptNumber: receipt.receipt_no, source: pdf.source, recipient: maskEmail(requesterEmail), ms: Date.now() - startedAt });
    return jsonResponse({ success: true });
  } catch (error) {
    const safeError = safeErrorMessage(error);
    console.warn('[receipt-pdf-attachment] failed', safeError);
    if (serviceClient && receiptForError) await recordAttachmentError(serviceClient, receiptForError.id, safeError);
    if (serviceClient && receiptForError && bookingForError) {
      await insertFailureNotification(serviceClient, bookingForError, receiptForError).catch((notifyError) => {
        console.warn('[receipt-pdf-attachment] failure notification unavailable:', safeErrorMessage(notifyError));
      });
    }
    return jsonResponse({ success: false, error: safeError }, 500);
  }
});

async function fetchReceipt(supabase: ReturnType<typeof createClient>, payload: ManualAttachmentRequest) {
  const bookingId = typeof payload.booking_id === 'string' ? payload.booking_id.trim() : '';
  const receiptNumber = typeof payload.receipt_number === 'string' ? payload.receipt_number.trim() : '';
  if (!bookingId && !receiptNumber) throw new Error('booking_id or receipt_number is required.');
  let query = supabase.from('booking_receipts').select(receiptSelect);
  query = bookingId ? query.eq('booking_id', bookingId) : query.eq('receipt_no', receiptNumber);
  const { data, error } = await query.order('generated_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data as ReceiptRow | null;
}

async function canViewBooking(supabase: ReturnType<typeof createClient>, bookingId: string) {
  const { data, error } = await supabase.rpc('can_view_booking', { target_booking_id: bookingId });
  if (error) return false;
  return data === true;
}

async function checkRateLimit(supabase: ReturnType<typeof createClient>, receiptId: string) {
  const { data, error } = await supabase.rpc('check_rate_limit', { rate_key: `receipt-pdf-attachment:${receiptId}`, max_requests: 3, window_seconds: 3600 });
  if (error) throw error;
  return data === true;
}

async function fetchBooking(supabase: ReturnType<typeof createClient>, bookingId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, user_id, event_title, start_time, end_time, status, admin_remarks, halls(name), requester:user_id(full_name, email)')
    .eq('id', bookingId)
    .maybeSingle();
  if (error) throw error;
  return data as BookingRow | null;
}

async function getReceiptPdfAttachment(supabase: ReturnType<typeof createClient>, receipt: ReceiptRow) {
  if (!receipt.storage_deleted_at) {
    const downloaded = await downloadReceiptPdf(supabase, receipt).catch(() => null);
    if (downloaded) return { pdfBytes: downloaded, source: 'storage' };
  }
  const built = await buildReceiptPdf(supabase, receipt.booking_id);
  return { pdfBytes: built.pdfBuffer, source: 'regenerated' };
}

async function downloadReceiptPdf(supabase: ReturnType<typeof createClient>, receipt: ReceiptRow) {
  const paths = uniqueStrings([receipt.pdf_path, `${receipt.receipt_no}.pdf`, `${receipt.booking_id}/${receipt.receipt_no}.pdf`]);
  for (const path of paths) {
    const { data, error } = await supabase.storage.from(bucketName).download(path);
    if (!error && data) return new Uint8Array(await data.arrayBuffer());
  }
  return null;
}

async function sendReceiptAttachmentEmail(params: {
  booking: BookingRow; bookingRef: string; receiptNo: string; recipientEmail: string; pdfBytes: Uint8Array; attachmentFileName: string;
}) {
  const host = Deno.env.get('SMTP_HOST');
  const port = Number(Deno.env.get('SMTP_PORT') ?? '465');
  const username = Deno.env.get('SMTP_USERNAME');
  const password = Deno.env.get('SMTP_PASSWORD');
  const from = Deno.env.get('SMTP_FROM') ?? username;
  if (!host || !username || !password || !from) throw new Error('SMTP secrets are not configured.');
  const input = buildEmailInput(params);
  await withTimeout(sendSmtpMail({
    host,
    port,
    username,
    password,
    from,
    to: params.recipientEmail,
    subject: `VenueVerse Receipt PDF Copy - ${params.booking.event_title}`,
    html: buildReceiptEmailHtml(input),
    text: buildReceiptEmailText(input),
    attachment: { filename: params.attachmentFileName, contentType: 'application/pdf', contentBase64: bytesToBase64(params.pdfBytes) }
  }), smtpTimeoutMs, 'Gmail SMTP send timed out.');
}

function buildEmailInput(params: { booking: BookingRow; bookingRef: string; receiptNo: string }) {
  const requester = single(params.booking.requester);
  const hall = single(params.booking.halls);
  const isApproved = params.booking.status === 'approved';
  return {
    requesterName: requester?.full_name ?? 'VenueVerse user',
    status: isApproved ? 'approved' as const : 'rejected' as const,
    eventTitle: params.booking.event_title,
    bookingPublicId: params.bookingRef,
    receiptNo: params.receiptNo,
    hallName: hall?.name ?? 'Venue',
    dateText: formatDate(params.booking.start_time),
    timeText: `${formatTime(params.booking.start_time)} - ${formatTime(params.booking.end_time)}`,
    adminRemarks: params.booking.admin_remarks
  };
}

async function sendSmtpMail(params: {
  host: string; port: number; username: string; password: string; from: string; to: string; subject: string; html: string; text: string;
  attachment: { filename: string; contentType: string; contentBase64: string };
}) {
  if (params.port !== 465) throw new Error('Receipt email currently supports SMTP over TLS on port 465.');
  const conn = await Deno.connectTls({ hostname: params.host, port: params.port });
  const reader = new SmtpReader(conn);
  try {
    await reader.expect([220]);
    await smtpCommand(conn, reader, 'EHLO venueverse.local', [250]);
    await smtpCommand(conn, reader, 'AUTH LOGIN', [334]);
    await smtpCommand(conn, reader, btoa(params.username), [334]);
    await smtpCommand(conn, reader, btoa(params.password), [235]);
    await smtpCommand(conn, reader, `MAIL FROM:<${extractEmailAddress(params.from)}>`, [250]);
    await smtpCommand(conn, reader, `RCPT TO:<${extractEmailAddress(params.to)}>`, [250, 251]);
    await smtpCommand(conn, reader, 'DATA', [354]);
    await writeSmtp(conn, buildEmailMessage(params));
    await reader.expect([250]);
    await smtpCommand(conn, reader, 'QUIT', [221]);
  } finally {
    try { conn.close(); } catch { /* noop */ }
  }
}

function buildReceiptEmailHtml(input: ReturnType<typeof buildEmailInput>) {
  const isApproved = input.status === 'approved';
  const statusColor = isApproved ? '#16A34A' : '#DC2626';
  const message = isApproved
    ? 'Your official VenueVerse booking receipt is attached as a PDF.'
    : 'Your official VenueVerse decision receipt is attached as a PDF.';
  const details = [
    ['Booking ID', input.bookingPublicId],
    ['Receipt No', input.receiptNo],
    ['Venue', input.hallName],
    ['Date', input.dateText],
    ['Time', input.timeText],
    ...(isApproved ? [] : [['Remarks', input.adminRemarks || 'No remarks provided.']])
  ];
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F6F8FB;font-family:Arial,sans-serif;color:#0F172A;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F8FB;padding:24px 12px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#FFFFFF;border-radius:18px;border:1px solid #E2E8F0;overflow:hidden;"><tr><td style="background:#0A3A66;padding:22px 26px;color:#FFFFFF;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td width="58" valign="middle" style="width:58px;"><img src="${receiptEmailLogoSrc}" width="48" height="48" alt="VenueVerse" style="display:block;width:48px;height:48px;border-radius:12px;background:#FFFFFF;padding:4px;object-fit:contain;border:0;outline:none;text-decoration:none;" /></td><td valign="middle" style="padding-left:14px;"><div style="font-size:22px;font-weight:800;line-height:26px;color:#FFFFFF;">VenueVerse</div><div style="font-size:12px;font-weight:600;line-height:18px;color:#E4EEF8;">Campus Venue Booking System</div></td></tr></table></td></tr><tr><td style="padding:22px 24px 10px;"><span style="display:inline-block;background:${statusColor};color:#FFFFFF;font-size:12px;font-weight:800;letter-spacing:.04em;border-radius:999px;padding:7px 12px;">${isApproved ? 'APPROVED' : 'REJECTED'}</span><h1 style="font-size:20px;line-height:1.3;margin:16px 0 8px;color:#0F172A;">${escapeHtml(input.eventTitle)}</h1><p style="font-size:15px;line-height:1.55;margin:0 0 10px;color:#0F172A;">Dear ${escapeHtml(input.requesterName)},</p><p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#0F172A;">${message}</p></td></tr><tr><td style="padding:0 24px 8px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">${details.map(([label, value]) => `<tr><td style="width:34%;padding:10px 12px;background:#F8FAFC;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:12px;font-weight:800;text-transform:uppercase;">${escapeHtml(label)}</td><td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:14px;font-weight:700;">${escapeHtml(value)}</td></tr>`).join('')}</table></td></tr><tr><td style="padding:12px 24px 22px;"><p style="font-size:13px;line-height:1.5;margin:0;color:#64748B;">This email was sent after a manual PDF copy request in VenueVerse.</p></td></tr><tr><td style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:14px 24px;color:#64748B;font-size:12px;line-height:1.5;"><strong style="color:#0A3A66;">VenueVerse</strong><br>Campus Venue Booking System</td></tr></table></td></tr></table></body></html>`;
}

function buildReceiptEmailText(input: ReturnType<typeof buildEmailInput>) {
  const message = input.status === 'approved'
    ? 'Your official VenueVerse booking receipt is attached as a PDF.'
    : 'Your official VenueVerse decision receipt is attached as a PDF.';
  return ['VenueVerse', 'Campus Venue Booking System', '', input.status === 'approved' ? 'APPROVED' : 'REJECTED', '', `Dear ${input.requesterName},`, '', message, 'Open the attached PDF receipt.', '', `Booking ID: ${input.bookingPublicId}`, `Receipt No: ${input.receiptNo}`, `Venue: ${input.hallName}`, `Date: ${input.dateText}`, `Time: ${input.timeText}`, ...(input.status === 'approved' ? [] : [`Remarks: ${input.adminRemarks || 'No remarks provided.'}`]), '', 'This email was sent after a manual PDF copy request in VenueVerse.', '', 'VenueVerse', 'Campus Venue Booking System'].join('\n');
}

function buildEmailMessage(params: { from: string; to: string; subject: string; html: string; text: string; attachment: { filename: string; contentType: string; contentBase64: string } }) {
  const alternativeBoundary = `venueverse-alt-${crypto.randomUUID()}`;
  const mixedBoundary = `venueverse-mixed-${crypto.randomUUID()}`;
  const safeFilename = sanitizeHeader(params.attachment.filename);
  const alternativeBody = [`--${alternativeBoundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: 8bit', '', dotStuff(params.text), `--${alternativeBoundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: 8bit', '', dotStuff(params.html), `--${alternativeBoundary}--`].join('\r\n');
  return [`From: ${params.from}`, `To: ${params.to}`, `Subject: ${sanitizeHeader(params.subject)}`, 'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`, '', `--${mixedBoundary}`, `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`, '', alternativeBody, `--${mixedBoundary}`, `Content-Type: ${params.attachment.contentType}; name="${safeFilename}"`, 'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${safeFilename}"`, '', chunkBase64(params.attachment.contentBase64), `--${mixedBoundary}--`, '.', ''].join('\r\n');
}

async function recordAttachmentSent(supabase: ReturnType<typeof createClient>, receiptId: string, recipientEmail: string) {
  const now = new Date().toISOString();
  const { data } = await supabase.from('booking_receipts').select('pdf_attachment_send_count').eq('id', receiptId).maybeSingle();
  const count = Number((data as { pdf_attachment_send_count?: number | null } | null)?.pdf_attachment_send_count ?? 0) + 1;
  await supabase.from('booking_receipts').update({
    emailed_to: recipientEmail,
    emailed_at: now,
    email_status: 'manual_sent',
    email_error: null,
    last_pdf_attachment_sent_at: now,
    pdf_attachment_send_count: count,
    pdf_attachment_last_error: null
  }).eq('id', receiptId);
}

async function recordAttachmentError(supabase: ReturnType<typeof createClient>, receiptId: string, error: string) {
  await supabase.from('booking_receipts').update({
    email_status: 'manual_failed',
    email_error: error,
    pdf_attachment_last_error: error
  }).eq('id', receiptId);
}

async function insertNotification(supabase: ReturnType<typeof createClient>, booking: BookingRow, receipt: ReceiptRow) {
  if (!booking.user_id) return;
  await supabase.from('notifications').insert({
    user_id: booking.user_id,
    booking_id: booking.id,
    title: 'Receipt PDF copy emailed',
    message: `Receipt PDF copy ${receipt.receipt_no} was emailed to you.`,
    type: 'receipt_emailed',
    data: {
      type: 'receipt_emailed',
      booking_id: booking.id,
      receipt_no: receipt.receipt_no
    },
    is_read: false
  });
}

async function insertFailureNotification(supabase: ReturnType<typeof createClient>, booking: BookingRow, receipt: ReceiptRow) {
  if (!booking.user_id) return;
  await supabase.from('notifications').insert({
    user_id: booking.user_id,
    booking_id: booking.id,
    title: 'Receipt email failed',
    message: 'Unable to email the receipt PDF copy. Please try again later.',
    type: 'receipt_email_failed',
    data: {
      type: 'receipt_email_failed',
      booking_id: booking.id,
      receipt_no: receipt.receipt_no
    },
    is_read: false
  });
}

async function smtpCommand(conn: Deno.TlsConn, reader: SmtpReader, command: string, expectedCodes: number[]) {
  await writeSmtp(conn, `${command}\r\n`);
  await reader.expect(expectedCodes);
}
async function writeSmtp(conn: Deno.TlsConn, value: string) {
  const bytes = new TextEncoder().encode(value);
  let offset = 0;
  while (offset < bytes.byteLength) {
    const written = await conn.write(bytes.subarray(offset));
    if (written <= 0) throw new Error('SMTP connection stopped accepting data.');
    offset += written;
  }
}
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => { timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs); });
  try { return await Promise.race([promise, timeoutPromise]); } finally { if (timeoutId) clearTimeout(timeoutId); }
}

class SmtpReader {
  private buffer = '';
  constructor(private conn: Deno.TlsConn) {}
  async expect(expectedCodes: number[]) {
    while (true) {
      const line = await this.readLine();
      const code = Number(line.slice(0, 3));
      if (line[3] !== '-') {
        if (!expectedCodes.includes(code)) throw new Error(`SMTP error ${code}`);
        return line;
      }
    }
  }
  private async readLine() {
    while (!this.buffer.includes('\n')) {
      const chunk = new Uint8Array(1024);
      const count = await this.conn.read(chunk);
      if (count === null) throw new Error('SMTP connection closed.');
      this.buffer += new TextDecoder().decode(chunk.subarray(0, count));
    }
    const index = this.buffer.indexOf('\n');
    const line = this.buffer.slice(0, index + 1).trimEnd();
    this.buffer = this.buffer.slice(index + 1);
    return line;
  }
}

function validateReceiptPdf(pdfBytes: Uint8Array) {
  if (!pdfBytes || pdfBytes.byteLength === 0) throw new Error('Receipt PDF attachment is empty');
  if (pdfBytes.byteLength > maxPdfAttachmentBytes) throw new Error('Receipt PDF attachment too large');
  if (new TextDecoder().decode(pdfBytes.slice(0, 5)) !== '%PDF-') throw new Error('Generated receipt attachment is not a valid PDF');
}
function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  return btoa(binary);
}
function chunkBase64(value: string) { return value.match(/.{1,76}/g)?.join('\r\n') ?? ''; }
function formatBookingRef(bookingId: string, year: number) { return `VV-${year}-${bookingId.slice(0, 8).toUpperCase()}`; }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(value)); }
function formatTime(value: string) { return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(value)); }
function single<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }
function uniqueStrings(values: string[]) { return values.filter((value, index) => value && values.indexOf(value) === index); }
function sanitizeHeader(value: string) { return value.replace(/[\r\n]+/g, ' ').trim(); }
function extractEmailAddress(value: string) { const match = value.match(/<([^>]+)>/); return (match?.[1] ?? value).trim(); }
function dotStuff(value: string) { return value.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..'); }
function escapeHtml(value: string) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function sanitizeError(value: string | null) { return (value || 'Unable to send receipt PDF copy.').replace(/password|secret|token|apikey/gi, '[redacted]').slice(0, 500); }
function safeErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return 'Unable to email receipt PDF copy. Please try again.';
  const message = sanitizeError(error.message);
  if (message.toLowerCase().includes('smtp')) return 'Unable to email receipt PDF copy. Please try again.';
  return message;
}
function maskEmail(value: string) { const [name, domain] = value.split('@'); return domain ? `${name.slice(0, 2)}***@${domain}` : '[invalid-email]'; }
function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
