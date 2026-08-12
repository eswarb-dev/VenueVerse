# Receipt Email PDF Attachment

This document covers only the VenueVerse receipt email PDF attachment flow that runs in Supabase Edge Functions.

## Purpose

When a booking receipt email job is queued, the backend must send the existing branded Gmail SMTP receipt email with:

- the branded HTML body
- the existing View Receipt signed link
- the generated receipt PDF attached from the private `booking-receipts` bucket when available
- a regenerated PDF fallback only when the bucket copy is unavailable

The app may show `email queued` after the job is created, but `booking_receipts.email_status` and `receipt_email_jobs.status` must only become `sent` after Gmail SMTP succeeds with the attachment included.

## Current Flow

1. `generate-booking-receipt` creates or updates a `booking_receipts` row.
2. The generated PDF is uploaded to the private `booking-receipts` bucket using `booking_receipts.pdf_path`.
3. A row is created in `receipt_email_jobs` with `status = 'pending'`.
4. The app triggers `process-receipt-email-queue` through Supabase Edge Functions.
5. The queue worker releases stale `processing` jobs, claims one pending job, and marks it `processing`.
6. The worker loads the receipt and booking details.
7. The worker downloads the PDF from the private bucket. If unavailable, it regenerates the PDF with the shared PDF builder.
8. The worker validates the PDF bytes before sending: non-empty, under 10 MB, and starts with `%PDF-`.
9. The worker sends Gmail SMTP mail with the existing HTML body, View Receipt button, and PDF MIME attachment.
10. Only after SMTP succeeds, the worker marks the job and receipt as `sent` and creates the receipt emailed notification.
11. On failure, the worker retries or marks failed and stores a safe error in `receipt_email_jobs.last_error`.

## Important Files

- `supabase/functions/process-receipt-email-queue/index.ts`
- `supabase/functions/_shared/receipt-pdf.ts`
- `supabase/functions/generate-booking-receipt/index.ts`
- `supabase/functions/get-receipt-pdf/index.ts`
- `src/services/receiptService.ts`

## Gmail SMTP Requirements

Supabase Edge Function secrets must provide:

- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=465`
- `SMTP_USERNAME=venueverse.srec@gmail.com`
- `SMTP_PASSWORD=<gmail app password>`
- `SMTP_FROM=VenueVerse <venueverse.srec@gmail.com>`

The SMTP password must stay in Supabase secrets only. It must not be placed in frontend `.env` files or logged.

## Full Edge Function Code

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { buildReceiptPdf } from '../_shared/receipt-pdf.ts';

type ProcessQueueRequest = {
  limit?: number;
};

type BookingRow = {
  id: string;
  user_id: string | null;
  event_title: string;
  start_time: string;
  end_time: string;
  status: 'approved' | 'rejected' | string;
  admin_remarks: string | null;
  halls: {
    name: string | null;
  } | { name: string | null }[] | null;
  requester: {
    full_name: string | null;
    email: string | null;
  } | { full_name: string | null; email: string | null }[] | null;
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
  storage_deleted_at: string | null;
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

type PushTokenRow = {
  id: string;
  expo_push_token: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('VENUEVERSE_ALLOWED_WEB_ORIGIN') ?? '',
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-receipt-queue-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const bucketName = 'booking-receipts';
const smtpTimeoutMs = 45_000;
const receiptLinkExpiresIn = 60 * 60 * 24 * 7;
const maxQueueLimit = 5;
const maxPdfAttachmentBytes = 10 * 1024 * 1024;
const receiptSelect = 'id, booking_id, receipt_no, status, pdf_path, emailed_to, emailed_at, email_status, email_error, email_attempts, last_email_attempt_at, receipt_email_notification_sent_at, receipt_push_notification_sent_at, receipt_notification_error, storage_deleted_at';
const jobSelect = 'id, receipt_id, booking_id, recipient_email, status, attempts, max_attempts, last_error, locked_at, locked_by, run_after, sent_at, created_at, updated_at';
const defaultReceiptEmailLogoUrl = 'https://ovpmleiiwdvbvndplwqp.supabase.co/storage/v1/object/public/email-assets/venueverse-email-logo.png';
const receiptEmailLogoSrc = Deno.env.get('EMAIL_LOGO_URL') ?? defaultReceiptEmailLogoUrl;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const startedAt = Date.now();
  const workerId = crypto.randomUUID();
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Supabase environment variables are missing.' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const authorized = await isAuthorized(req, supabase);
    if (!authorized) return jsonResponse({ error: 'Unauthorized.' }, 401);

    const payload = (await req.json().catch(() => ({}))) as ProcessQueueRequest;
    const limit = Math.max(1, Math.min(Number(payload.limit ?? 1), maxQueueLimit));
    const results = [];

    await releaseStaleProcessingJobs(supabase);

    for (let index = 0; index < limit; index += 1) {
      const job = await claimNextJob(supabase, workerId);
      if (!job) break;
      results.push(await processJob(supabase, job, workerId));
    }

    console.log(`[receipt-queue] worker=${workerId} processed=${results.length} total_ms=${Date.now() - startedAt}`);
    return jsonResponse({ success: true, processed: results.length, results });
  } catch (error) {
    console.warn(`[receipt-queue] worker=${workerId} failed:`, sanitizeError(error instanceof Error ? error.message : String(error)));
    return jsonResponse({ success: false, error: error instanceof Error ? sanitizeError(error.message) : 'Receipt email queue failed.' }, 500);
  }
});

async function isAuthorized(req: Request, supabase: ReturnType<typeof createClient>) {
  const queueSecret = Deno.env.get('RECEIPT_QUEUE_SECRET');
  const providedSecret = req.headers.get('x-receipt-queue-secret');
  if (queueSecret && providedSecret === queueSecret) return true;

  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  if (!jwt) return false;
  const { data, error } = await supabase.auth.getUser(jwt);
  return !error && Boolean(data.user);
}

async function claimNextJob(supabase: ReturnType<typeof createClient>, workerId: string) {
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
    .update({
      status: 'processing',
      locked_at: now,
      locked_by: workerId,
      updated_at: now
    })
    .eq('id', job.id)
    .eq('status', 'pending')
    .select(jobSelect)
    .maybeSingle();

  if (claimError) throw claimError;
  return claimed as ReceiptEmailJobRow | null;
}

async function releaseStaleProcessingJobs(supabase: ReturnType<typeof createClient>) {
  const staleBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('receipt_email_jobs')
    .update({
      status: 'pending',
      locked_at: null,
      locked_by: null,
      run_after: now,
      updated_at: now
    })
    .eq('status', 'processing')
    .lt('locked_at', staleBefore)
    .select('id, receipt_id');

  if (error) {
    console.warn('[receipt-email] stale-release-failed', sanitizeError(error.message));
    return;
  }

  const released = (data ?? []) as Array<{ id: string; receipt_id: string | null }>;
  if (released.length === 0) return;

  const receiptIds = released.map((job) => job.receipt_id).filter(Boolean) as string[];
  if (receiptIds.length > 0) {
    await supabase
      .from('booking_receipts')
      .update({ email_status: 'queued', email_error: null })
      .in('id', receiptIds);
  }

  console.log('[receipt-email] stale-processing-released', { count: released.length });
}

async function processJob(supabase: ReturnType<typeof createClient>, job: ReceiptEmailJobRow, workerId: string) {
  const attempt = Number(job.attempts ?? 0) + 1;
  const startedAt = Date.now();
  let receiptForError: ReceiptRow | null = null;
  try {
    console.log('[receipt-email] processing', { jobId: job.id, receiptId: job.receipt_id });
    const receipt = await fetchReceipt(supabase, job);
    receiptForError = receipt;
    if (!receipt) throw new Error('Receipt metadata not found.');

    await updateReceiptSending(supabase, receipt.id, attempt);
    const booking = await fetchBooking(supabase, receipt.booking_id);
    if (!booking) throw new Error('Booking not found.');

    const attachmentStart = Date.now();
    const attachment = await getReceiptPdfAttachment(supabase, receipt);
    validateReceiptPdf(attachment.pdfBytes);
    console.log('[receipt-email] pdf-built', {
      receiptNumber: receipt.receipt_no,
      bytes: attachment.pdfBytes.byteLength,
      ms: Date.now() - attachmentStart,
      source: attachment.source
    });

    const signedUrl = await createReceiptSignedUrl(supabase, receipt).catch((linkError) => {
      console.warn(`[receipt-queue] receipt=${receipt.receipt_no} signed_link_unavailable:`, sanitizeError(linkError instanceof Error ? linkError.message : String(linkError)));
      return '';
    });

    const bookingRef = formatBookingRef(booking.id, new Date(booking.start_time).getFullYear());
    console.log('[receipt-email] sending-gmail', { receiptNumber: receipt.receipt_no, recipient: maskEmail(job.recipient_email) });
    const emailResult = await sendReceiptEmail({
      booking,
      bookingRef,
      receiptNo: receipt.receipt_no,
      recipientEmail: job.recipient_email,
      signedUrl,
      pdfBytes: attachment.pdfBytes,
      attachmentFileName: `${receipt.receipt_no}.pdf`
    });

    const sentAt = new Date().toISOString();
    await supabase
      .from('receipt_email_jobs')
      .update({
        status: 'sent',
        attempts: attempt,
        last_error: null,
        sent_at: sentAt,
        updated_at: sentAt
      })
      .eq('id', job.id);

    const updatedReceipt = await updateReceiptSent(supabase, receipt.id, job.recipient_email, sentAt, attempt);
    if (updatedReceipt) {
      await notifyReceiptEmailSent({ supabase, receipt: updatedReceipt, booking });
    }

    console.log('[receipt-email] sent', { receiptNumber: receipt.receipt_no, messageId: emailResult.messageId, ms: Date.now() - startedAt });
    return { job_id: job.id, status: 'sent', attempts: attempt, receipt_no: receipt.receipt_no };
  } catch (error) {
    const safeError = safeErrorMessage(error);
    const failed = attempt >= Number(job.max_attempts ?? 3);
    const nextRun = getNextRunAfter(attempt);
    const now = new Date().toISOString();

    await supabase
      .from('receipt_email_jobs')
      .update({
        status: failed ? 'failed' : 'pending',
        attempts: attempt,
        last_error: safeError,
        locked_at: null,
        locked_by: null,
        run_after: failed ? now : nextRun,
        updated_at: now
      })
      .eq('id', job.id);

    if (job.receipt_id) {
      await updateReceiptFailed(supabase, job.receipt_id, safeError, attempt, failed ? 'failed' : 'queued');
    }

    console.error('[receipt-email] failed', { jobId: job.id, receiptNumber: receiptForError?.receipt_no ?? null, safeError });
    return { job_id: job.id, status: failed ? 'failed' : 'pending', attempts: attempt, error: safeError };
  }
}

async function fetchReceipt(supabase: ReturnType<typeof createClient>, job: ReceiptEmailJobRow) {
  let query = supabase.from('booking_receipts').select(receiptSelect);
  query = job.receipt_id ? query.eq('id', job.receipt_id) : query.eq('booking_id', job.booking_id);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as ReceiptRow | null;
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

async function createReceiptSignedUrl(supabase: ReturnType<typeof createClient>, receipt: ReceiptRow) {
  if (receipt.storage_deleted_at) throw new Error('Receipt PDF was cleaned from storage.');
  const paths = uniqueStrings([receipt.pdf_path, `${receipt.receipt_no}.pdf`, `${receipt.booking_id}/${receipt.receipt_no}.pdf`]);
  let lastError = '';
  for (const path of paths) {
    const { data, error } = await supabase.storage.from(bucketName).createSignedUrl(path, receiptLinkExpiresIn);
    if (!error && data?.signedUrl) return data.signedUrl;
    lastError = error?.message ?? '';
  }
  throw new Error(`Unable to create receipt link. ${lastError}`.trim());
}

async function getReceiptPdfAttachment(supabase: ReturnType<typeof createClient>, receipt: ReceiptRow) {
  if (!receipt.storage_deleted_at) {
    const downloaded = await downloadReceiptPdf(supabase, receipt).catch(() => null);
    if (downloaded) return { pdfBytes: downloaded, source: 'storage' };
  }

  const buildStart = Date.now();
  const built = await buildReceiptPdf(supabase, receipt.booking_id);
  console.log(`[receipt-queue] receipt=${receipt.receipt_no} regenerated_pdf_ms=${Date.now() - buildStart}`);
  return { pdfBytes: built.pdfBuffer, source: 'regenerated' };
}

async function downloadReceiptPdf(supabase: ReturnType<typeof createClient>, receipt: ReceiptRow) {
  const paths = uniqueStrings([receipt.pdf_path, `${receipt.receipt_no}.pdf`, `${receipt.booking_id}/${receipt.receipt_no}.pdf`]);
  for (const path of paths) {
    const downloadStart = Date.now();
    const { data, error } = await supabase.storage.from(bucketName).download(path);
    if (!error && data) {
      const bytes = new Uint8Array(await data.arrayBuffer());
      console.log(`[receipt-queue] receipt=${receipt.receipt_no} storage_download_ms=${Date.now() - downloadStart}`);
      return bytes;
    }
  }
  return null;
}

async function updateReceiptSending(supabase: ReturnType<typeof createClient>, receiptId: string, attempt: number) {
  const now = new Date().toISOString();
  await supabase
    .from('booking_receipts')
    .update({
      email_status: 'sending',
      email_error: null,
      email_attempts: attempt,
      last_email_attempt_at: now
    })
    .eq('id', receiptId);
}

async function updateReceiptSent(
  supabase: ReturnType<typeof createClient>,
  receiptId: string,
  recipientEmail: string,
  sentAt: string,
  attempt: number
) {
  const { data, error } = await supabase
    .from('booking_receipts')
    .update({
      emailed_to: recipientEmail,
      emailed_at: sentAt,
      email_status: 'sent',
      email_error: null,
      email_attempts: attempt,
      last_email_attempt_at: sentAt
    })
    .eq('id', receiptId)
    .select(receiptSelect)
    .single();

  if (error) {
    console.warn('Unable to update sent receipt email status:', sanitizeError(error.message));
    return null;
  }
  return data as ReceiptRow;
}

async function updateReceiptFailed(
  supabase: ReturnType<typeof createClient>,
  receiptId: string,
  error: string,
  attempt: number,
  status: 'queued' | 'failed'
) {
  await supabase
    .from('booking_receipts')
    .update({
      email_status: status,
      email_error: error,
      email_attempts: attempt,
      last_email_attempt_at: new Date().toISOString()
    })
    .eq('id', receiptId);
}

function getNextRunAfter(attempt: number) {
  const delayMs = attempt <= 1 ? 2 * 60 * 1000 : 5 * 60 * 1000;
  return new Date(Date.now() + delayMs).toISOString();
}

async function sendReceiptEmail(params: {
  booking: BookingRow;
  bookingRef: string;
  receiptNo: string;
  recipientEmail: string;
  signedUrl: string;
  pdfBytes: Uint8Array;
  attachmentFileName: string;
}) {
  const host = Deno.env.get('SMTP_HOST');
  const port = Number(Deno.env.get('SMTP_PORT') ?? '465');
  const username = Deno.env.get('SMTP_USERNAME');
  const password = Deno.env.get('SMTP_PASSWORD');
  const from = Deno.env.get('SMTP_FROM') ?? username;
  if (!host || !username || !password || !from) {
    throw new Error('SMTP secrets are not configured.');
  }

  const requester = single(params.booking.requester);
  const hall = single(params.booking.halls);
  const isApproved = params.booking.status === 'approved';
  const subject = `VenueVerse Booking ${isApproved ? 'Approved' : 'Rejected'} Receipt - ${params.booking.event_title}`;
  const emailInput = {
    requesterName: requester?.full_name ?? 'VenueVerse user',
    status: isApproved ? 'approved' as const : 'rejected' as const,
    eventTitle: params.booking.event_title,
    bookingPublicId: params.bookingRef,
    receiptNo: params.receiptNo,
    hallName: hall?.name ?? 'Venue',
    dateText: formatDate(params.booking.start_time),
    timeText: `${formatTime(params.booking.start_time)} - ${formatTime(params.booking.end_time)}`,
    adminRemarks: params.booking.admin_remarks,
    signedUrl: params.signedUrl
  };
  validateReceiptPdf(params.pdfBytes);

  const smtpStart = Date.now();
  await withTimeout(
    sendSmtpMail({
      host,
      port,
      username,
      password,
      from,
      to: params.recipientEmail,
      subject,
      html: buildReceiptEmailHtml(emailInput),
      text: buildReceiptEmailText(emailInput),
      attachment: {
        filename: params.attachmentFileName,
        contentType: 'application/pdf',
        contentBase64: bytesToBase64(params.pdfBytes)
      }
    }),
    smtpTimeoutMs,
    'Gmail SMTP send timed out.'
  );
  console.log(`[receipt-queue] receipt=${params.receiptNo} gmail_smtp_send_ms=${Date.now() - smtpStart}`);
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
  attachment?: {
    filename: string;
    contentType: string;
    contentBase64: string;
  };
}) {
  if (params.port !== 465) throw new Error('Receipt email currently supports SMTP over TLS on port 465.');

  const connectStart = Date.now();
  const conn = await Deno.connectTls({ hostname: params.host, port: params.port });
  console.log(`[receipt-queue] gmail_smtp_connect_ms=${Date.now() - connectStart}`);
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
    try {
      conn.close();
    } catch {
      // Connection may already be closed.
    }
  }
}

async function smtpCommand(conn: Deno.TlsConn, reader: SmtpReader, command: string, expectedCodes: number[]) {
  await writeSmtp(conn, `${command}\r\n`);
  await reader.expect(expectedCodes);
}

async function writeSmtp(conn: Deno.TlsConn, value: string) {
  await conn.write(new TextEncoder().encode(value));
}

function buildEmailMessage(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  attachment?: {
    filename: string;
    contentType: string;
    contentBase64: string;
  };
}) {
  const alternativeBoundary = `venueverse-alt-${crypto.randomUUID()}`;
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

  if (params.attachment) {
    const mixedBoundary = `venueverse-mixed-${crypto.randomUUID()}`;
    const safeFilename = sanitizeHeader(params.attachment.filename);
    return [
      `From: ${params.from}`,
      `To: ${params.to}`,
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

  return [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${sanitizeHeader(params.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    '',
    alternativeBody,
    '.',
    ''
  ].join('\r\n');
}

function chunkBase64(value: string) {
  return value.match(/.{1,76}/g)?.join('\r\n') ?? '';
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
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
  signedUrl: string;
}) {
  const isApproved = input.status === 'approved';
  const statusLabel = isApproved ? 'APPROVED' : 'REJECTED';
  const statusColor = isApproved ? '#16A34A' : '#DC2626';
  const ctaLabel = isApproved ? 'View Receipt' : 'View Decision Receipt';
  const ctaHtml = input.signedUrl
    ? `<a href="${escapeAttribute(input.signedUrl)}" style="display:inline-block;background:#0A3A66;color:#FFFFFF;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:10px;margin:4px 0 14px;">${ctaLabel}</a>`
    : '';
  const message = isApproved
    ? 'Your venue booking request has been approved.'
    : 'Your venue booking request has been reviewed and rejected.';
  const note = isApproved
    ? 'You may show this receipt to the venue coordinator or department staff when required.'
    : 'This decision receipt is available for your records.';
  const details = [
    ['Booking ID', input.bookingPublicId],
    ['Receipt No', input.receiptNo],
    ['Venue', input.hallName],
    ['Date', input.dateText],
    ['Time', input.timeText],
    ...(isApproved ? [] : [['Remarks', input.adminRemarks || 'No remarks provided.']])
  ];

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F6F8FB;font-family:Arial,sans-serif;color:#0F172A;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F8FB;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#FFFFFF;border-radius:18px;border:1px solid #E2E8F0;overflow:hidden;">
            <tr>
              <td style="background:#0A3A66;padding:22px 26px;color:#FFFFFF;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="58" valign="middle" style="width:58px;">
                      <img src="${receiptEmailLogoSrc}" width="48" height="48" alt="VenueVerse" style="display:block;width:48px;height:48px;border-radius:12px;background:#FFFFFF;padding:4px;object-fit:contain;border:0;outline:none;text-decoration:none;" />
                    </td>
                    <td valign="middle" style="padding-left:14px;">
                      <div style="font-size:22px;font-weight:800;line-height:26px;color:#FFFFFF;">VenueVerse</div>
                      <div style="font-size:12px;font-weight:600;line-height:18px;color:#E4EEF8;">Campus Venue Booking System</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 24px 10px;">
                <span style="display:inline-block;background:${statusColor};color:#FFFFFF;font-size:12px;font-weight:800;letter-spacing:.04em;border-radius:999px;padding:7px 12px;">${statusLabel}</span>
                <h1 style="font-size:20px;line-height:1.3;margin:16px 0 8px;color:#0F172A;">${escapeHtml(input.eventTitle)}</h1>
                <p style="font-size:15px;line-height:1.55;margin:0 0 10px;color:#0F172A;">Dear ${escapeHtml(input.requesterName)},</p>
                <p style="font-size:15px;line-height:1.55;margin:0 0 16px;color:#0F172A;">${message}</p>
                <p style="font-size:14px;line-height:1.5;margin:0 0 16px;color:#64748B;">Your official VenueVerse ${isApproved ? 'booking receipt' : 'decision receipt'} is attached.${input.signedUrl ? ' You can also use the button below to view it.' : ''}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 8px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">
                  ${details.map(([label, value]) => `
                  <tr>
                    <td style="width:34%;padding:10px 12px;background:#F8FAFC;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:12px;font-weight:800;text-transform:uppercase;">${escapeHtml(label)}</td>
                    <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;color:#0F172A;font-size:14px;font-weight:700;">${escapeHtml(value)}</td>
                  </tr>`).join('')}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 24px 22px;">
                ${ctaHtml}
                <p style="font-size:13px;line-height:1.5;margin:0;color:#64748B;">${note}</p>
              </td>
            </tr>
            <tr>
              <td style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:14px 24px;color:#64748B;font-size:12px;line-height:1.5;">
                <strong style="color:#0A3A66;">VenueVerse</strong><br>
                Campus Venue Booking System
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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
  signedUrl: string;
}) {
  const isApproved = input.status === 'approved';
  return [
    'VenueVerse',
    'Campus Venue Booking System',
    '',
    isApproved ? 'APPROVED' : 'REJECTED',
    '',
    `Dear ${input.requesterName},`,
    '',
    isApproved ? 'Your venue booking request has been approved.' : 'Your venue booking request has been reviewed and rejected.',
    '',
    `Booking ID: ${input.bookingPublicId}`,
    `Receipt No: ${input.receiptNo}`,
    `Venue: ${input.hallName}`,
    `Date: ${input.dateText}`,
    `Time: ${input.timeText}`,
    ...(isApproved ? [] : [`Remarks: ${input.adminRemarks || 'No remarks provided.'}`]),
    '',
    input.signedUrl ? `Use the View ${isApproved ? 'Receipt' : 'Decision Receipt'} button in the HTML email, or open the attached PDF.` : 'Open the attached PDF receipt.',
    '',
    isApproved
      ? 'You may show this receipt to the venue coordinator or department staff when required.'
      : 'This decision receipt is available for your records.',
    '',
    'VenueVerse',
    'Campus Venue Booking System'
  ].join('\n');
}

async function notifyReceiptEmailSent(params: {
  supabase: ReturnType<typeof createClient>;
  receipt: ReceiptRow;
  booking: BookingRow;
}) {
  if (!params.booking.user_id) return;

  const message = buildReceiptNotificationMessage(params.booking);
  const updates: Record<string, string | null> = {};
  const errors: string[] = [];

  if (!params.receipt.receipt_email_notification_sent_at) {
    const { error } = await params.supabase.from('notifications').insert({
      user_id: params.booking.user_id,
      booking_id: params.booking.id,
      title: message.title,
      message: message.body,
      is_read: false
    });

    if (error) errors.push(`In-app notification failed: ${sanitizeError(error.message)}`);
    else updates.receipt_email_notification_sent_at = new Date().toISOString();
  }

  if (!params.receipt.receipt_push_notification_sent_at) {
    const pushResult = await sendReceiptPushNotification({
      supabase: params.supabase,
      userId: params.booking.user_id,
      title: message.title,
      body: message.body,
      data: {
        type: 'receipt_email_sent',
        booking_id: params.booking.id,
        receipt_no: params.receipt.receipt_no,
        status: params.booking.status
      }
    });
    if (pushResult.sent > 0) updates.receipt_push_notification_sent_at = new Date().toISOString();
    else if (pushResult.warning) errors.push(pushResult.warning);
  }

  updates.receipt_notification_error = errors.length > 0 ? sanitizeError(errors.join(' | ')) : null;
  if (Object.keys(updates).length === 1 && updates.receipt_notification_error === null) return;

  const { error } = await params.supabase.from('booking_receipts').update(updates).eq('id', params.receipt.id);
  if (error) console.warn('Unable to update receipt notification status:', sanitizeError(error.message));
}

function buildReceiptNotificationMessage(booking: BookingRow) {
  const isApproved = booking.status === 'approved';
  const hall = single(booking.halls);
  const venueName = hall?.name ?? 'your venue';
  return {
    title: isApproved ? 'Receipt emailed' : 'Decision receipt emailed',
    body: `Your ${isApproved ? 'approved' : 'rejected'} booking receipt for ${venueName} has been emailed to you.`
  };
}

async function sendReceiptPushNotification(params: {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}) {
  const { data: tokens, error } = await params.supabase
    .from('push_tokens')
    .select('id, expo_push_token')
    .eq('user_id', params.userId)
    .eq('is_active', true);

  if (error) return { sent: 0, warning: `Push notification failed: ${sanitizeError(error.message)}` };

  const pushTokens = ((tokens ?? []) as PushTokenRow[]).filter(isValidExpoPushToken);
  if (pushTokens.length === 0) return { sent: 0, warning: 'No active push token for requester.' };

  let sent = 0;
  for (const chunk of chunkArray(pushTokens, 100)) {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(chunk.map((row) => ({
        to: row.expo_push_token,
        sound: 'default',
        title: params.title,
        body: params.body,
        data: params.data
      })))
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) return { sent, warning: 'Expo Push API request failed.' };

    const receipts = Array.isArray(result.data) ? result.data : [result.data];
    await Promise.all(
      receipts.map((receipt, index) => {
        if (receipt?.details?.error !== 'DeviceNotRegistered') return Promise.resolve();
        return params.supabase
          .from('push_tokens')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', chunk[index].id)
          .then(() => undefined);
      })
    );
    sent += chunk.length;
  }
  return { sent, warning: null };
}

function isValidExpoPushToken(row: PushTokenRow) {
  return row.expo_push_token.startsWith('ExponentPushToken[') || row.expo_push_token.startsWith('ExpoPushToken[');
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
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

function uniqueStrings(values: string[]) {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

function validateReceiptPdf(pdfBytes: Uint8Array) {
  if (!pdfBytes || pdfBytes.byteLength === 0) {
    throw new Error('Receipt PDF attachment is empty');
  }
  if (pdfBytes.byteLength > maxPdfAttachmentBytes) {
    throw new Error('Receipt PDF attachment too large');
  }

  const header = new TextDecoder().decode(pdfBytes.slice(0, 5));
  if (header !== '%PDF-') {
    throw new Error('Generated receipt attachment is not a valid PDF');
  }
}

function sanitizeError(value: string | null) {
  if (!value) return 'Unable to send receipt email.';
  return value.replace(/password|secret|token|apikey/gi, '[redacted]').slice(0, 500);
}

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) return sanitizeError(`${error.name}: ${error.message}`);
  return 'Unknown receipt email error';
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
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}

function maskEmail(value: string) {
  const [local, domain] = value.split('@');
  if (!domain) return '[invalid-email]';
  return `${local.slice(0, 2)}***@${domain}`;
}

class SmtpReader {
  private decoder = new TextDecoder();
  private buffer = '';

  constructor(private conn: Deno.TlsConn) {}

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
      const chunk = new Uint8Array(2048);
      const bytesRead = await this.conn.read(chunk);
      if (bytesRead === null) throw new Error('SMTP connection closed unexpectedly.');
      this.buffer += this.decoder.decode(chunk.subarray(0, bytesRead), { stream: true });
    }
    const newlineIndex = this.buffer.indexOf('\n');
    const line = this.buffer.slice(0, newlineIndex).replace(/\r$/, '');
    this.buffer = this.buffer.slice(newlineIndex + 1);
    return line;
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

```

