import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { connect } from 'cloudflare:sockets';
import { buildReceiptPdf } from './receipt-pdf';

type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RECEIPT_QUEUE_SECRET?: string;
  WORKER_ADMIN_SECRET?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USERNAME?: string;
  SMTP_PASSWORD?: string;
  SMTP_FROM?: string;
  VENUEVERSE_ALLOWED_WEB_ORIGIN?: string;
};

type ProcessQueueRequest = {
  limit?: number;
};

type ReceiptPdfRequest = {
  booking_id?: string;
  receipt_number?: string;
};

type BookingRow = {
  id: string;
  user_id: string | null;
  event_title: string;
  start_time: string;
  end_time: string;
  status: 'approved' | 'rejected' | string;
  admin_remarks: string | null;
  halls: { name: string | null; department: string | null } | { name: string | null; department: string | null }[] | null;
  requester: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null;
};

type ReceiptRow = {
  id: string;
  booking_id: string;
  receipt_no: string;
  status: 'approved' | 'rejected';
  pdf_path: string;
  emailed_to: string | null;
  emailed_at: string | null;
  email_status: string | null;
  email_error: string | null;
  email_attempts: number | null;
  last_email_attempt_at: string | null;
  receipt_email_notification_sent_at: string | null;
  receipt_push_notification_sent_at: string | null;
  receipt_notification_error: string | null;
};

type ReceiptEmailJobRow = {
  id: string;
  receipt_id: string | null;
  booking_id: string;
  recipient_email: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  locked_at: string | null;
  locked_by: string | null;
  run_after: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  role: string | null;
  department: string | null;
};

const maxQueueLimit = 5;
const maxPdfAttachmentBytes = 5 * 1024 * 1024;
const receiptSelect = 'id, booking_id, receipt_no, status, pdf_path, emailed_to, emailed_at, email_status, email_error, email_attempts, last_email_attempt_at, receipt_email_notification_sent_at, receipt_push_notification_sent_at, receipt_notification_error';
const jobSelect = 'id, receipt_id, booking_id, recipient_email, status, attempts, max_attempts, last_error, locked_at, locked_by, run_after, sent_at, created_at, updated_at';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(env) });

    try {
      if (url.pathname === '/process-receipt-email-queue') {
        return await processReceiptEmailQueue(request, env);
      }
      if (url.pathname === '/debug/process-one-receipt-email') {
        return await processOneReceiptEmailDebug(request, env);
      }
      if (url.pathname === '/get-receipt-pdf') {
        return await getReceiptPdf(request, env);
      }
      return jsonResponse(env, { error: 'Not found.' }, 404);
    } catch (error) {
      console.warn('[receipt-worker] request failed:', sanitizeError(error instanceof Error ? error.message : String(error)));
      return jsonResponse(env, { error: 'Receipt service failed.' }, 500);
    }
  },

  async queue(batch: { messages: Array<{ body: unknown; ack: () => void; retry: () => void }> }, env: Env): Promise<void> {
    const supabase = getSupabase(env);
    const workerId = crypto.randomUUID();
    for (const message of batch.messages) {
      const job = await resolveQueueJob(supabase, message.body, workerId);
      if (!job) {
        message.ack();
        continue;
      }

      const result = await processJob(supabase, env, job, workerId);
      if (result.status === 'sent' || result.status === 'failed') message.ack();
      else message.retry();
    }
  },

  async scheduled(_event: unknown, env: Env): Promise<void> {
    const supabase = getSupabase(env);
    const workerId = crypto.randomUUID();
    const results = await processPendingJobs(supabase, env, workerId, maxQueueLimit);
    console.log('[receipt-email] scheduled-processed', { processed: results.length });
  }
};

async function processReceiptEmailQueue(request: Request, env: Env) {
  if (request.method !== 'POST') return jsonResponse(env, { error: 'Method not allowed.' }, 405);

  const supabase = getSupabase(env);
  const authorized = await isAuthorized(request, env, supabase);
  if (!authorized) return jsonResponse(env, { error: 'Unauthorized.' }, 401);

  const workerId = crypto.randomUUID();
  const payload = (await request.json().catch(() => ({}))) as ProcessQueueRequest;
  const limit = Math.max(1, Math.min(Number(payload.limit ?? 1), maxQueueLimit));
  const results = await processPendingJobs(supabase, env, workerId, limit);

  return jsonResponse(env, { success: true, processed: results.length, results });
}

async function processPendingJobs(supabase: SupabaseClient, env: Env, workerId: string, limit: number) {
  const results = [];
  for (let index = 0; index < limit; index += 1) {
    const job = await claimNextJob(supabase, workerId);
    if (!job) break;
    results.push(await processJob(supabase, env, job, workerId));
  }
  return results;
}

async function processOneReceiptEmailDebug(request: Request, env: Env) {
  if (request.method !== 'POST') return jsonResponse(env, { error: 'Method not allowed.' }, 405);
  if (!env.WORKER_ADMIN_SECRET || request.headers.get('x-worker-admin-secret') !== env.WORKER_ADMIN_SECRET) {
    return jsonResponse(env, { error: 'Unauthorized.' }, 401);
  }

  const supabase = getSupabase(env);
  const workerId = crypto.randomUUID();
  const job = await claimNextJob(supabase, workerId);
  if (!job) return jsonResponse(env, { processed: false });

  const result = await processJob(supabase, env, job, workerId);
  return jsonResponse(env, {
    processed: result.status === 'sent',
    jobId: job.id,
    receiptNumber: result.receiptNumber ?? null,
    pdfBytes: result.pdfBytes ?? null,
    messageId: result.messageId ?? null,
    status: result.status,
    error: result.error ?? null
  });
}

async function getReceiptPdf(request: Request, env: Env) {
  if (request.method !== 'POST') return jsonResponse(env, { error: 'Method not allowed.' }, 405);

  const supabase = getSupabase(env);
  const user = await getAuthorizedUser(request, supabase);
  if (!user) return jsonResponse(env, { error: 'Unauthorized.' }, 401);

  const payload = (await request.json().catch(() => ({}))) as ReceiptPdfRequest;
  const receipt = await fetchReceiptByRequest(supabase, payload);
  if (!receipt) return jsonResponse(env, { error: 'Receipt not found.' }, 404);

  const booking = await fetchBooking(supabase, receipt.booking_id);
  if (!booking) return jsonResponse(env, { error: 'Booking not found.' }, 404);

  const allowed = await canAccessReceipt(supabase, user.id, booking);
  if (!allowed) return jsonResponse(env, { error: 'Forbidden.' }, 403);

  const pdf = await buildReceiptPdf(supabase, receipt.booking_id);
  return new Response(pdf.pdfBuffer, {
    headers: {
      ...corsHeaders(env),
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${sanitizeHeader(`VenueVerse_Receipt_${pdf.receiptNumber}.pdf`)}"`,
      'Cache-Control': 'private, no-store'
    }
  });
}

async function processJob(supabase: SupabaseClient, env: Env, job: ReceiptEmailJobRow, workerId: string) {
  const attempt = Number(job.attempts ?? 0) + 1;
  let receiptForError: ReceiptRow | null = null;
  try {
    console.log('[receipt-email] processing', { jobId: job.id, receiptId: job.receipt_id });
    const receipt = await fetchReceipt(supabase, job);
    receiptForError = receipt;
    if (!receipt) throw new Error('Receipt metadata not found.');

    await updateReceiptSending(supabase, receipt.id, attempt);
    const booking = await fetchBooking(supabase, receipt.booking_id);
    if (!booking) throw new Error('Booking not found.');

    const pdfStart = Date.now();
    const pdf = await buildReceiptPdf(supabase, receipt.booking_id);
    const pdfArrayBuffer = toAttachmentArrayBuffer(pdf.pdfBuffer);
    validateSendInputs({
      receiptNumber: receipt.receipt_no,
      recipientEmail: job.recipient_email,
      pdfArrayBuffer
    });
    console.log('[receipt-email] pdf-built', { receiptNumber: receipt.receipt_no, bytes: pdfArrayBuffer.byteLength, ms: Date.now() - pdfStart });

    const bookingRef = formatBookingRef(booking.id, new Date(booking.start_time).getFullYear());
    console.log('[receipt-email] sending-email', { receiptNumber: receipt.receipt_no, recipient: maskEmail(job.recipient_email) });
    const emailResult = await sendReceiptEmail(env, {
      booking,
      bookingRef,
      receiptNo: receipt.receipt_no,
      recipientEmail: job.recipient_email,
      pdfArrayBuffer,
      attachmentFileName: `${receipt.receipt_no}.pdf`
    });

    const sentAt = new Date().toISOString();
    await supabase
      .from('receipt_email_jobs')
      .update({ status: 'sent', attempts: attempt, last_error: null, sent_at: sentAt, locked_at: null, locked_by: null, updated_at: sentAt })
      .eq('id', job.id);

    await supabase
      .from('booking_receipts')
      .update({ emailed_to: job.recipient_email, emailed_at: sentAt, email_status: 'sent', email_error: null, email_attempts: attempt, last_email_attempt_at: sentAt })
      .eq('id', receipt.id);

    await notifyReceiptEmailSent({ supabase, receipt, booking });

    console.log('[receipt-email] sent', { receiptNumber: receipt.receipt_no, messageId: emailResult.messageId ?? null });
    return { job_id: job.id, status: 'sent', attempts: attempt, receiptNumber: receipt.receipt_no, pdfBytes: pdfArrayBuffer.byteLength, messageId: emailResult.messageId ?? null };
  } catch (error) {
    const safeError = safeErrorMessage(error);
    const failed = attempt >= Number(job.max_attempts ?? 3);
    const now = new Date().toISOString();
    const runAfter = failed ? now : getNextRunAfter(attempt);

    await supabase
      .from('receipt_email_jobs')
      .update({ status: failed ? 'failed' : 'pending', attempts: attempt, last_error: safeError, locked_at: null, locked_by: null, run_after: runAfter, updated_at: now })
      .eq('id', job.id);

    if (job.receipt_id) {
      await supabase
        .from('booking_receipts')
        .update({ email_status: failed ? 'failed' : 'queued', email_error: safeError, email_attempts: attempt, last_email_attempt_at: now })
        .eq('id', job.receipt_id);
    }

    console.error('[receipt-email] failed', { jobId: job.id, receiptNumber: receiptForError?.receipt_no ?? null, safeError });
    return { job_id: job.id, status: failed ? 'failed' : 'pending', attempts: attempt, receiptNumber: receiptForError?.receipt_no ?? null, error: safeError };
  }
}

async function isAuthorized(request: Request, env: Env, supabase: SupabaseClient) {
  const providedSecret = request.headers.get('x-receipt-queue-secret');
  if (env.RECEIPT_QUEUE_SECRET && providedSecret === env.RECEIPT_QUEUE_SECRET) return true;
  return Boolean(await getAuthorizedUser(request, supabase));
}

async function getAuthorizedUser(request: Request, supabase: SupabaseClient) {
  const jwt = (request.headers.get('Authorization') ?? '').replace('Bearer ', '');
  if (!jwt) return null;
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data.user) return null;
  return data.user;
}

async function claimNextJob(supabase: SupabaseClient, workerId: string) {
  const now = new Date().toISOString();
  const { data: candidate, error: fetchError } = await supabase
    .from('receipt_email_jobs')
    .select(jobSelect)
    .eq('status', 'pending')
    .lte('run_after', now)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!candidate) return null;

  const job = candidate as ReceiptEmailJobRow;
  const { data: claimed, error: claimError } = await supabase
    .from('receipt_email_jobs')
    .update({ status: 'processing', locked_at: now, locked_by: workerId, updated_at: now })
    .eq('id', job.id)
    .eq('status', 'pending')
    .select(jobSelect)
    .maybeSingle();
  if (claimError) throw claimError;
  return claimed as ReceiptEmailJobRow | null;
}

async function resolveQueueJob(supabase: SupabaseClient, body: unknown, workerId: string) {
  const payload = typeof body === 'object' && body !== null ? body as { jobId?: string; id?: string } : {};
  const jobId = payload.jobId ?? payload.id;
  if (!jobId) return claimNextJob(supabase, workerId);

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('receipt_email_jobs')
    .update({ status: 'processing', locked_at: now, locked_by: workerId, updated_at: now })
    .eq('id', jobId)
    .eq('status', 'pending')
    .select(jobSelect)
    .maybeSingle();
  if (error) throw error;
  return data as ReceiptEmailJobRow | null;
}

async function fetchReceipt(supabase: SupabaseClient, job: ReceiptEmailJobRow) {
  let query = supabase.from('booking_receipts').select(receiptSelect);
  query = job.receipt_id ? query.eq('id', job.receipt_id) : query.eq('booking_id', job.booking_id);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as ReceiptRow | null;
}

async function fetchReceiptByRequest(supabase: SupabaseClient, payload: ReceiptPdfRequest) {
  let query = supabase.from('booking_receipts').select(receiptSelect);
  if (payload.booking_id) query = query.eq('booking_id', payload.booking_id);
  else if (payload.receipt_number) query = query.eq('receipt_no', payload.receipt_number);
  else throw new Error('booking_id or receipt_number is required.');

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as ReceiptRow | null;
}

async function fetchBooking(supabase: SupabaseClient, bookingId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, user_id, event_title, start_time, end_time, status, admin_remarks, halls(name, department), requester:user_id(full_name, email)')
    .eq('id', bookingId)
    .maybeSingle();
  if (error) throw error;
  return data as BookingRow | null;
}

async function canAccessReceipt(supabase: SupabaseClient, userId: string, booking: BookingRow) {
  if (booking.user_id === userId) return true;

  const { data: profile, error } = await supabase.from('profiles').select('id, role, department').eq('id', userId).maybeSingle();
  if (error) throw error;
  const caller = profile as ProfileRow | null;
  if (caller?.role === 'super_admin') return true;
  if (caller?.role !== 'admin') return false;

  const hall = single(booking.halls);
  return Boolean(caller.department && hall?.department && caller.department === hall.department);
}

async function updateReceiptSending(supabase: SupabaseClient, receiptId: string, attempt: number) {
  await supabase
    .from('booking_receipts')
    .update({ email_status: 'sending', email_error: null, email_attempts: attempt, last_email_attempt_at: new Date().toISOString() })
    .eq('id', receiptId);
}

async function sendReceiptEmail(env: Env, params: {
  booking: BookingRow;
  bookingRef: string;
  receiptNo: string;
  recipientEmail: string;
  pdfArrayBuffer: ArrayBuffer;
  attachmentFileName: string;
}) {
  const host = env.SMTP_HOST ?? 'smtp.gmail.com';
  const port = Number(env.SMTP_PORT ?? '465');
  const username = env.SMTP_USERNAME;
  const password = env.SMTP_PASSWORD;
  const from = env.SMTP_FROM ?? username;
  if (!username || !password || !from) throw new Error('Gmail SMTP secrets are not configured.');

  const requester = single(params.booking.requester);
  const hall = single(params.booking.halls);
  const isApproved = params.booking.status === 'approved';
  const subject = `VenueVerse Booking ${isApproved ? 'Approved' : 'Rejected'} Receipt - ${params.booking.event_title}`;
  const input = {
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

  await withTimeout(
    sendSmtpMail({
      host,
      port,
      username,
      password,
      from,
      to: params.recipientEmail,
      subject,
      html: buildReceiptEmailHtml(input),
      text: buildReceiptEmailText(input),
      attachment: {
        filename: params.attachmentFileName,
        contentType: 'application/pdf',
        contentBase64: arrayBufferToBase64(params.pdfArrayBuffer)
      }
    }),
    45_000,
    'Gmail SMTP send timed out.'
  );
  return { messageId: null };
}

async function sendSmtpMail(params: {
  host: string;
  port: number;
  username: string;
  password: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  attachment: {
    filename: string;
    contentType: string;
    contentBase64: string;
  };
}) {
  if (params.port !== 465) throw new Error('Receipt email currently supports SMTP over TLS on port 465.');

  const socket = connect({ hostname: params.host, port: params.port }, { secureTransport: 'on', allowHalfOpen: false });
  const writer = socket.writable.getWriter();
  const reader = new SmtpReader(socket.readable);
  try {
    await reader.expect([220]);
    await smtpCommand(writer, reader, 'EHLO venueverse.local', [250]);
    await smtpCommand(writer, reader, 'AUTH LOGIN', [334]);
    await smtpCommand(writer, reader, btoa(params.username), [334]);
    await smtpCommand(writer, reader, btoa(params.password), [235]);
    await smtpCommand(writer, reader, `MAIL FROM:<${extractEmailAddress(params.from)}>`, [250]);
    await smtpCommand(writer, reader, `RCPT TO:<${extractEmailAddress(params.to)}>`, [250, 251]);
    await smtpCommand(writer, reader, 'DATA', [354]);
    await writeSmtp(writer, buildEmailMessage(params));
    await reader.expect([250]);
    await smtpCommand(writer, reader, 'QUIT', [221]);
  } finally {
    writer.releaseLock();
    await socket.close().catch(() => undefined);
  }
}

async function smtpCommand(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: SmtpReader,
  command: string,
  expectedCodes: number[]
) {
  await writeSmtp(writer, `${command}\r\n`);
  await reader.expect(expectedCodes);
}

async function writeSmtp(writer: WritableStreamDefaultWriter<Uint8Array>, value: string) {
  await writer.write(new TextEncoder().encode(value));
}

function buildEmailMessage(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  attachment: {
    filename: string;
    contentType: string;
    contentBase64: string;
  };
}) {
  const alternativeBoundary = `venueverse-alt-${crypto.randomUUID()}`;
  const mixedBoundary = `venueverse-mixed-${crypto.randomUUID()}`;
  const safeFilename = sanitizeHeader(params.attachment.filename);
  const alternativeBody = [
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    dotStuff(params.text),
    `--${alternativeBoundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    dotStuff(params.html),
    `--${alternativeBoundary}--`
  ].join('\r\n');

  return [
    `From: ${sanitizeHeader(params.from)}`,
    `To: ${sanitizeHeader(params.to)}`,
    `Subject: ${sanitizeHeader(params.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    '',
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    '',
    alternativeBody,
    `--${mixedBoundary}`,
    `Content-Type: ${params.attachment.contentType}; name="${safeFilename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${safeFilename}"`,
    '',
    chunkBase64(params.attachment.contentBase64),
    `--${mixedBoundary}--`,
    '.',
    ''
  ].join('\r\n');
}

function getSupabase(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

function getNextRunAfter(attempt: number) {
  const delayMs = attempt <= 1 ? 2 * 60 * 1000 : 5 * 60 * 1000;
  return new Date(Date.now() + delayMs).toISOString();
}

function buildReceiptEmailHtml(input: {
  requesterName: string;
  status: 'approved' | 'rejected';
  eventTitle: string;
  bookingPublicId: string;
  receiptNo: string;
  hallName: string;
  dateText: string;
  timeText: string;
  adminRemarks: string | null;
}) {
  const isApproved = input.status === 'approved';
  const statusLabel = isApproved ? 'APPROVED' : 'REJECTED';
  const statusColor = isApproved ? '#16A34A' : '#DC2626';
  const message = isApproved
    ? 'Your venue booking request has been approved.'
    : 'Your venue booking request has been reviewed and rejected.';
  const details = [
    ['Booking ID', input.bookingPublicId],
    ['Receipt No', input.receiptNo],
    ['Venue', input.hallName],
    ['Date', input.dateText],
    ['Time', input.timeText],
    ...(isApproved ? [] : [['Remarks', input.adminRemarks || 'No remarks provided.']])
  ];

  return `<!doctype html><html><body style="margin:0;padding:0;background:#F6F8FB;font-family:Arial,sans-serif;color:#0F172A;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F8FB;padding:24px 12px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#FFFFFF;border-radius:18px;border:1px solid #E2E8F0;overflow:hidden;"><tr><td style="background:#0A3A66;padding:22px 26px;color:#FFFFFF;"><div style="font-size:22px;font-weight:800;line-height:26px;color:#FFFFFF;">VenueVerse</div><div style="font-size:12px;font-weight:600;line-height:18px;color:#E4EEF8;">Campus Venue Booking System</div></td></tr><tr><td style="padding:22px 24px 10px;"><span style="display:inline-block;background:${statusColor};color:#FFFFFF;font-size:12px;font-weight:800;letter-spacing:.04em;border-radius:999px;padding:7px 12px;">${statusLabel}</span><h1 style="font-size:20px;line-height:1.3;margin:16px 0 8px;color:#0F172A;">${escapeHtml(input.eventTitle)}</h1><p style="font-size:15px;line-height:1.55;margin:0 0 10px;color:#0F172A;">Dear ${escapeHtml(input.requesterName)},</p><p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#0F172A;">${message}</p><p style="font-size:14px;line-height:1.5;margin:0 0 16px;color:#64748B;">Your official VenueVerse ${isApproved ? 'booking receipt' : 'decision receipt'} is attached as a PDF.</p></td></tr><tr><td style="padding:0 24px 22px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">${details.map(([label, value]) => `<tr><td style="width:34%;padding:10px 12px;background:#F8FAFC;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:12px;font-weight:800;text-transform:uppercase;">${escapeHtml(label)}</td><td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:14px;font-weight:700;">${escapeHtml(value)}</td></tr>`).join('')}</table></td></tr><tr><td style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:14px 24px;color:#64748B;font-size:12px;line-height:1.5;"><strong style="color:#0A3A66;">VenueVerse</strong><br>Campus Venue Booking System</td></tr></table></td></tr></table></body></html>`;
}

function buildReceiptEmailText(input: {
  requesterName: string;
  status: 'approved' | 'rejected';
  eventTitle: string;
  bookingPublicId: string;
  receiptNo: string;
  hallName: string;
  dateText: string;
  timeText: string;
  adminRemarks: string | null;
}) {
  const isApproved = input.status === 'approved';
  return [
    'VenueVerse',
    '',
    isApproved ? 'APPROVED' : 'REJECTED',
    '',
    `Dear ${input.requesterName},`,
    isApproved ? 'Your venue booking request has been approved.' : 'Your venue booking request has been reviewed and rejected.',
    '',
    `Booking ID: ${input.bookingPublicId}`,
    `Receipt No: ${input.receiptNo}`,
    `Venue: ${input.hallName}`,
    `Date: ${input.dateText}`,
    `Time: ${input.timeText}`,
    ...(isApproved ? [] : [`Remarks: ${input.adminRemarks || 'No remarks provided.'}`]),
    '',
    'Your official receipt PDF is attached.'
  ].join('\n');
}

function corsHeaders(env: Env) {
  return {
    'Access-Control-Allow-Origin': env.VENUEVERSE_ALLOWED_WEB_ORIGIN ?? '',
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, content-type, x-receipt-queue-secret, x-worker-admin-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}

function jsonResponse(env: Env, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(env), 'Content-Type': 'application/json' }
  });
}

function formatBookingRef(bookingId: string, year: number) {
  return `VV-${year}-${bookingId.slice(0, 8).toUpperCase()}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(value));
}

function single<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function toAttachmentArrayBuffer(pdfBytes: Uint8Array | ArrayBuffer) {
  if (pdfBytes instanceof Uint8Array) {
    return pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
  }
  return pdfBytes;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function chunkBase64(value: string) {
  return value.match(/.{1,76}/g)?.join('\r\n') ?? '';
}

function validateSendInputs(params: {
  receiptNumber: string | null | undefined;
  recipientEmail: string | null | undefined;
  pdfArrayBuffer: ArrayBuffer;
}) {
  if (!params.receiptNumber) throw new Error('Receipt number is missing.');
  if (!params.recipientEmail) throw new Error('Recipient email is missing.');
  if (!isValidEmail(params.recipientEmail)) throw new Error('Recipient email is invalid.');
  if (params.pdfArrayBuffer.byteLength <= 0) throw new Error('Receipt PDF attachment is empty.');
  if (params.pdfArrayBuffer.byteLength >= maxPdfAttachmentBytes) throw new Error('Receipt PDF attachment exceeds 5 MB.');
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function sanitizeError(value: string | null) {
  if (!value) return 'Unable to send receipt email.';
  return value.replace(/password|secret|token|apikey|authorization|bearer/gi, '[redacted]').slice(0, 500);
}

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) return sanitizeError(`${error.name}: ${error.message}`);
  return 'Unknown email worker error';
}

function sanitizeHeader(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function extractEmailAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim();
}

function dotStuff(value: string) {
  return value.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function maskEmail(value: string) {
  const [local, domain] = value.split('@');
  if (!domain) return '[invalid-email]';
  return `${local.slice(0, 2)}***@${domain}`;
}

async function notifyReceiptEmailSent(params: {
  supabase: SupabaseClient;
  receipt: ReceiptRow;
  booking: BookingRow;
}) {
  if (!params.booking.user_id || params.receipt.receipt_email_notification_sent_at) return;

  const hall = single(params.booking.halls);
  const isApproved = params.booking.status === 'approved';
  const { error } = await params.supabase.from('notifications').insert({
    user_id: params.booking.user_id,
    booking_id: params.booking.id,
    title: isApproved ? 'Receipt emailed' : 'Decision receipt emailed',
    message: `Your ${isApproved ? 'approved' : 'rejected'} booking receipt for ${hall?.name ?? 'your venue'} has been emailed to you.`,
    is_read: false
  });

  const now = new Date().toISOString();
  await params.supabase
    .from('booking_receipts')
    .update({
      receipt_email_notification_sent_at: error ? null : now,
      receipt_notification_error: error ? sanitizeError(`In-app notification failed: ${error.message}`) : null
    })
    .eq('id', params.receipt.id);
}

class SmtpReader {
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private decoder = new TextDecoder();
  private buffer = '';

  constructor(readable: ReadableStream<Uint8Array>) {
    this.reader = readable.getReader();
  }

  async expect(expectedCodes: number[]) {
    const response = await this.readResponse();
    if (!expectedCodes.includes(response.code)) throw new Error(`SMTP ${response.code}: ${response.message}`);
    return response;
  }

  private async readResponse(): Promise<{ code: number; message: string }> {
    const lines: string[] = [];
    while (true) {
      const line = await this.readLine();
      if (!line) continue;
      lines.push(line);
      if (/^\d{3} /.test(line)) return { code: Number(line.slice(0, 3)), message: lines.join(' ') };
    }
  }

  private async readLine() {
    while (!this.buffer.includes('\n')) {
      const { value, done } = await this.reader.read();
      if (done || !value) throw new Error('SMTP connection closed unexpectedly.');
      this.buffer += this.decoder.decode(value, { stream: true });
    }
    const newlineIndex = this.buffer.indexOf('\n');
    const line = this.buffer.slice(0, newlineIndex).replace(/\r$/, '');
    this.buffer = this.buffer.slice(newlineIndex + 1);
    return line;
  }
}
