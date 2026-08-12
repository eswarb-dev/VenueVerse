import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';
import QRCode from 'https://esm.sh/qrcode@1.5.4';
import {
  APPROVED_STAMP_PNG_BASE64,
  REJECTED_STAMP_PNG_BASE64,
  SREC_HEADER_PNG_BASE64,
  VENUEVERSE_LOGO_PNG_BASE64
} from './receiptAssets.ts';

type GenerateReceiptRequest = {
  booking_id?: string;
  force_resend_email?: boolean;
  force_regenerate?: boolean;
  queue_email?: boolean;
};

type BookingRow = {
  id: string;
  user_id: string | null;
  event_title: string;
  event_type: string | null;
  department: string | null;
  faculty_coordinator: string | null;
  start_time: string;
  end_time: string;
  status: 'approved' | 'rejected' | string;
  admin_remarks: string | null;
  approved_by: string | null;
  updated_at: string | null;
  halls: {
    name: string | null;
    department: string | null;
    venue_type: string | null;
    location: string | null;
    block: string | null;
    floor: string | null;
  } | { name: string | null; department: string | null; venue_type: string | null; location: string | null; block: string | null; floor: string | null }[] | null;
  requester: {
    full_name: string | null;
    email: string | null;
    department: string | null;
    role: string | null;
  } | { full_name: string | null; email: string | null; department: string | null; role: string | null }[] | null;
  approver: {
    full_name: string | null;
    email: string | null;
  } | { full_name: string | null; email: string | null }[] | null;
};

type ReceiptRow = {
  id: string;
  booking_id: string;
  receipt_no: string;
  verification_token: string;
  status: 'approved' | 'rejected';
  pdf_path: string;
  qr_payload: string;
  emailed_to: string | null;
  emailed_at: string | null;
  email_status: string | null;
  email_error: string | null;
  email_attempts: number | null;
  last_email_attempt_at: string | null;
  receipt_email_notification_sent_at: string | null;
  receipt_push_notification_sent_at: string | null;
  receipt_notification_error: string | null;
  generated_by: string | null;
  generated_at: string;
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

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('VENUEVERSE_ALLOWED_WEB_ORIGIN') ?? '',
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const receiptSelect = 'id, booking_id, receipt_no, verification_token, status, pdf_path, qr_payload, emailed_to, emailed_at, email_status, email_error, email_attempts, last_email_attempt_at, receipt_email_notification_sent_at, receipt_push_notification_sent_at, receipt_notification_error, generated_by, generated_at';
const receiptEmailJobSelect = 'id, receipt_id, booking_id, recipient_email, status, attempts, max_attempts, last_error, locked_at, locked_by, run_after, sent_at, created_at, updated_at';
const bucketName = 'booking-receipts';
const gmailSmtpTimeoutMs = 30_000;
const recentSendingWindowMs = 2 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const totalStart = Date.now();
  let bookingIdForLog = 'unknown';
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Supabase environment variables are missing.' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: authData, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !authData.user) return jsonResponse({ error: 'Unauthorized.' }, 401);

    const payload = (await req.json().catch(() => ({}))) as GenerateReceiptRequest;
    if (!payload.booking_id) return jsonResponse({ error: 'booking_id is required.' }, 400);
    bookingIdForLog = payload.booking_id;
    logTiming('receipt request start', bookingIdForLog);

    const bookingFetchStart = Date.now();
    const booking = await fetchBooking(supabase, payload.booking_id);
    logTiming('booking fetch ms', bookingIdForLog, Date.now() - bookingFetchStart);
    if (!booking) return jsonResponse({ error: 'Booking not found.' }, 404);
    if (booking.status !== 'approved' && booking.status !== 'rejected') {
      return jsonResponse({ error: 'Receipts are generated only for approved or rejected bookings.' }, 400);
    }

    const allowed = await canGenerateReceipt(supabase, authData.user.id, booking);
    if (!allowed) return jsonResponse({ error: 'Only admins or responsible approvers can generate receipts.' }, 403);

    const existingReceipt = await fetchReceipt(supabase, booking.id);
    const year = new Date(booking.updated_at ?? booking.start_time).getFullYear();
    const bookingRef = formatBookingRef(booking.id, year);
    const receiptNo = existingReceipt?.receipt_no ?? formatReceiptNo(booking.id, year);
    const verificationToken = existingReceipt?.verification_token ?? crypto.randomUUID().replaceAll('-', '');
    const qrPayload = `venueverse://receipt/verify/${verificationToken}`;
    const pdfPath = existingReceipt?.pdf_path ?? getReceiptPdfPath(receiptNo);

    let receipt = existingReceipt;
    let pdfUploaded = false;
    if (!receipt || payload.force_regenerate || receipt.status !== booking.status) {
      receipt = await upsertReceipt(supabase, {
        existingReceipt,
        booking,
        receiptNo,
        verificationToken,
        qrPayload,
        pdfPath,
        generatedBy: authData.user.id
      });
      const pdfBytes = await generateReceiptPdf({
        booking,
        bookingRef,
        receiptNo: receipt.receipt_no,
        qrPayload: receipt.qr_payload,
        generatedAt: new Date(receipt.generated_at)
      });
      await uploadReceiptPdf(supabase, receipt.pdf_path, pdfBytes);
      pdfUploaded = true;
    }
    await notifyReceiptGenerated({ supabase, receipt, booking }).catch((notifyError) => {
      console.warn('Unable to create receipt generated notification:', sanitizeError(notifyError instanceof Error ? notifyError.message : String(notifyError)));
    });

    const shouldQueueEmail = payload.queue_email === true && payload.force_resend_email === true;
    let emailSent = receipt.email_status === 'sent' || Boolean(receipt.emailed_at);
    let emailError: string | null = receipt.email_error ?? null;
    let emailQueued = false;
    let queueMessage: string | null = null;
    if (shouldQueueEmail && (!emailSent || payload.force_resend_email) && receipt) {
      const queueResult = await enqueueReceiptEmail(supabase, {
        receipt,
        booking,
        forceResend: Boolean(payload.force_resend_email)
      });
      receipt = queueResult.receipt ?? receipt;
      emailQueued = queueResult.queued;
      emailSent = false;
      emailError = queueResult.error;
      queueMessage = queueResult.message;
    }

    logTiming('function response ms', booking.id, Date.now() - totalStart);
    return jsonResponse({
      success: true,
      receipt_no: receipt.receipt_no,
      booking_id: booking.id,
      pdf_path: receipt.pdf_path,
      verification_token: receipt.verification_token,
      emailed: emailSent,
      email_status: emailQueued ? 'queued' : (emailSent ? 'sent' : (emailError ? 'failed' : receipt.email_status ?? 'not_requested')),
      email_error: emailError,
      email_queued: emailQueued,
      message: queueMessage,
      warning: emailError ? 'Receipt generated but email could not be queued.' : null,
      pdf_uploaded: pdfUploaded
    });
  } catch (error) {
    logTiming('function failed ms', bookingIdForLog, Date.now() - totalStart);
    return jsonResponse({
      success: false,
      emailed: false,
      error: error instanceof Error ? error.message : 'Receipt generation failed.'
    }, 500);
  }
});

async function fetchBooking(supabase: ReturnType<typeof createClient>, bookingId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, user_id, event_title, event_type, department, faculty_coordinator, start_time, end_time, status, admin_remarks, approved_by, updated_at, halls(name, department, venue_type, location, block, floor), requester:user_id(full_name, email, department, role), approver:approved_by(full_name, email)')
    .eq('id', bookingId)
    .maybeSingle();
  if (error) throw error;
  return data as BookingRow | null;
}

async function fetchReceipt(supabase: ReturnType<typeof createClient>, bookingId: string) {
  const { data, error } = await supabase
    .from('booking_receipts')
    .select(receiptSelect)
    .eq('booking_id', bookingId)
    .maybeSingle();
  if (error) throw error;
  return data as ReceiptRow | null;
}

async function canGenerateReceipt(supabase: ReturnType<typeof createClient>, callerId: string, booking: BookingRow) {
  if (booking.approved_by === callerId) return true;

  const { data: profile, error } = await supabase.from('profiles').select('role').eq('id', callerId).maybeSingle();
  if (error) throw error;
  if (profile?.role === 'admin') return true;

  const hall = single(booking.halls);
  if (!hall?.department) return false;
  const { data: approver, error: approverError } = await supabase
    .from('department_approvers')
    .select('id')
    .eq('user_id', callerId)
    .eq('department', hall.department)
    .eq('is_active', true)
    .maybeSingle();
  if (approverError) throw approverError;
  return Boolean(approver);
}

async function upsertReceipt(
  supabase: ReturnType<typeof createClient>,
  params: {
    existingReceipt: ReceiptRow | null;
    booking: BookingRow;
    receiptNo: string;
    verificationToken: string;
    qrPayload: string;
    pdfPath: string;
    generatedBy: string;
  }
) {
  const values = {
    booking_id: params.booking.id,
    receipt_no: params.receiptNo,
    verification_token: params.verificationToken,
    status: params.booking.status,
    pdf_path: params.pdfPath,
    qr_payload: params.qrPayload,
    email_status: 'not_requested',
    email_error: null,
    generated_by: params.generatedBy,
    generated_at: new Date().toISOString()
  };

  const query = params.existingReceipt
    ? supabase.from('booking_receipts').update(values).eq('id', params.existingReceipt.id)
    : supabase.from('booking_receipts').insert(values);

  const { data, error } = await query
    .select(receiptSelect)
    .single();
  if (error) throw error;
  return data as ReceiptRow;
}

async function downloadReceiptPdf(supabase: ReturnType<typeof createClient>, receipt: ReceiptRow) {
  const candidates = getReceiptPdfPathCandidates(receipt);
  let lastError: unknown = null;

  for (const pdfPath of candidates) {
    const { data, error } = await supabase.storage.from(bucketName).download(pdfPath);
    if (!error && data) {
      return new Uint8Array(await data.arrayBuffer());
    }
    lastError = error;
  }

  throw new Error(
    `Receipt PDF not found in storage. Checked ${candidates.join(', ')}. ${
      lastError instanceof Error ? lastError.message : ''
    }`.trim()
  );
}

async function uploadReceiptPdf(supabase: ReturnType<typeof createClient>, pdfPath: string, pdfBytes: Uint8Array) {
  validateReceiptPdf(pdfBytes);
  const { error } = await supabase.storage.from(bucketName).upload(pdfPath, pdfBytes, {
    contentType: 'application/pdf',
    upsert: true
  });
  if (error) throw new Error(`Receipt PDF upload failed: ${error.message}`);
}

async function enqueueReceiptEmail(
  supabase: ReturnType<typeof createClient>,
  params: {
    receipt: ReceiptRow;
    booking: BookingRow;
    forceResend: boolean;
  }
) {
  const recipientEmail = bookingRequesterEmail(params.booking);
  if (!recipientEmail) {
    const receipt = await updateReceiptEmailQueuedStatus(supabase, params.receipt.id, {
      status: 'failed',
      error: 'Requester email is missing.'
    });
    return {
      queued: false,
      receipt,
      error: 'Requester email is missing.',
      message: null
    };
  }

  const existingJob = await fetchLatestReceiptEmailJob(supabase, params.receipt.id);
  if (existingJob && ['pending', 'processing'].includes(existingJob.status)) {
    const receipt = await updateReceiptEmailQueuedStatus(supabase, params.receipt.id, {
      status: existingJob.status === 'processing' ? 'sending' : 'queued',
      error: null
    });
    return {
      queued: true,
      receipt,
      error: null,
      message: 'Receipt email is already queued.'
    };
  }

  if (existingJob?.status === 'sent' && !params.forceResend) {
    return {
      queued: false,
      receipt: params.receipt,
      error: null,
      message: 'Receipt email was already sent.'
    };
  }

  const now = new Date().toISOString();
  const values = {
    receipt_id: params.receipt.id,
    booking_id: params.booking.id,
    recipient_email: recipientEmail,
    status: 'pending',
    attempts: 0,
    max_attempts: 3,
    last_error: null,
    locked_at: null,
    locked_by: null,
    run_after: now,
    sent_at: null,
    updated_at: now
  };

  const query = existingJob && (params.forceResend || existingJob.status === 'failed')
    ? supabase.from('receipt_email_jobs').update(values).eq('id', existingJob.id)
    : supabase.from('receipt_email_jobs').insert(values);

  const { error } = await query.select(receiptEmailJobSelect).single();
  if (error) {
    const receipt = await updateReceiptEmailQueuedStatus(supabase, params.receipt.id, {
      status: 'failed',
      error: error.message
    });
    return {
      queued: false,
      receipt,
      error: sanitizeError(error.message),
      message: null
    };
  }

  const receipt = await updateReceiptEmailQueuedStatus(supabase, params.receipt.id, {
    status: 'queued',
    error: null
  });

  return {
    queued: true,
    receipt,
    error: null,
    message: 'Receipt generated and email queued.'
  };
}

async function fetchLatestReceiptEmailJob(supabase: ReturnType<typeof createClient>, receiptId: string) {
  const { data, error } = await supabase
    .from('receipt_email_jobs')
    .select(receiptEmailJobSelect)
    .eq('receipt_id', receiptId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as ReceiptEmailJobRow | null;
}

async function updateReceiptEmailQueuedStatus(
  supabase: ReturnType<typeof createClient>,
  receiptId: string,
  params: {
    status: 'queued' | 'sending' | 'sent' | 'failed';
    error: string | null;
  }
) {
  const { data, error } = await supabase
    .from('booking_receipts')
    .update({
      email_status: params.status,
      email_error: params.error ? sanitizeError(params.error) : null
    })
    .eq('id', receiptId)
    .select(receiptSelect)
    .single();

  if (error) {
    console.warn('Unable to update receipt queue status:', error.message);
    return null;
  }

  return data as ReceiptRow;
}

async function notifyReceiptGenerated(params: {
  supabase: ReturnType<typeof createClient>;
  receipt: ReceiptRow;
  booking: BookingRow;
}) {
  if (!params.booking.user_id || params.receipt.receipt_push_notification_sent_at) return;

  const hall = single(params.booking.halls);
  const { error } = await params.supabase.from('notifications').insert({
    user_id: params.booking.user_id,
    booking_id: params.booking.id,
    title: 'Receipt generated',
    message: 'Your official booking receipt is ready.',
    type: 'receipt_generated',
    data: {
      type: 'receipt_generated',
      booking_id: params.booking.id,
      receipt_no: params.receipt.receipt_no,
      venue_name: hall?.name ?? ''
    },
    is_read: false
  });

  if (error) throw error;

  await params.supabase
    .from('booking_receipts')
    .update({
      receipt_push_notification_sent_at: new Date().toISOString(),
      receipt_notification_error: null
    })
    .eq('id', params.receipt.id);
}

async function markEmailSending(supabase: ReturnType<typeof createClient>, receipt: ReceiptRow) {
  const updateStart = Date.now();
  const nextAttempts = Number(receipt.email_attempts ?? 0) + 1;
  const { data, error } = await supabase
    .from('booking_receipts')
    .update({
      email_status: 'sending',
      email_error: null,
      email_attempts: nextAttempts,
      last_email_attempt_at: new Date().toISOString()
    })
    .eq('id', receipt.id)
    .select(receiptSelect)
    .single();

  if (error) {
    console.warn('Unable to mark receipt email sending:', error.message);
    return null;
  }

  logTiming('email status DB update ms', receipt.booking_id, Date.now() - updateStart);
  return data as ReceiptRow;
}

async function sendAndUpdateReceiptEmail(params: {
  supabase: ReturnType<typeof createClient>;
  receipt: ReceiptRow;
  booking: BookingRow;
  bookingRef: string;
  receiptNo: string;
  pdfBytes: Uint8Array | null;
  filename: string;
}) {
  const emailTaskStart = Date.now();
  try {
    let pdfBytes = params.pdfBytes;
    if (!pdfBytes) {
      const downloadStart = Date.now();
      pdfBytes = await downloadReceiptPdf(params.supabase, params.receipt);
      logTiming('receipt pdf storage download ms', params.receipt.booking_id, Date.now() - downloadStart);
    }
    logTiming('pdf size bytes', params.receipt.booking_id, pdfBytes.length);

    const emailResult = await sendReceiptEmail({
      booking: params.booking,
      bookingRef: params.bookingRef,
      receiptNo: params.receiptNo,
      pdfBytes,
      filename: params.filename
    });

    await updateEmailStatus(params.supabase, params.receipt.id, {
      sent: emailResult.sent,
      to: bookingRequesterEmail(params.booking),
      error: emailResult.error
    });

    if (emailResult.sent) {
      await notifyReceiptEmailSent({
        supabase: params.supabase,
        receipt: params.receipt,
        booking: params.booking
      });
    }
  } catch (error) {
    await updateEmailStatus(params.supabase, params.receipt.id, {
      sent: false,
      to: bookingRequesterEmail(params.booking),
      error: error instanceof Error ? error.message : 'Unable to send receipt email.'
    });
  } finally {
    logTiming('email task total ms', params.receipt.booking_id, Date.now() - emailTaskStart);
  }
}

async function updateEmailStatus(
  supabase: ReturnType<typeof createClient>,
  receiptId: string,
  params: {
    sent: boolean;
    to: string | null;
    error: string | null;
  }
) {
  const updateStart = Date.now();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('booking_receipts')
    .update({
      emailed_to: params.sent ? params.to : null,
      emailed_at: params.sent ? now : null,
      email_status: params.sent ? 'sent' : 'failed',
      email_error: params.sent ? null : sanitizeError(params.error),
      last_email_attempt_at: now
    })
    .eq('id', receiptId)
    .select(receiptSelect)
    .single();

  if (error) {
    console.warn('Unable to update receipt email status:', error.message);
    return null;
  }

  const receipt = data as ReceiptRow;
  logTiming('email status DB update ms', receipt.booking_id, Date.now() - updateStart);
  return receipt;
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
      type: 'receipt_emailed',
      data: {
        type: 'receipt_emailed',
        booking_id: params.booking.id,
        receipt_no: params.receipt.receipt_no
      },
      is_read: false
    });

    if (error) {
      errors.push(`In-app notification failed: ${sanitizeError(error.message)}`);
    } else {
      updates.receipt_email_notification_sent_at = new Date().toISOString();
    }
  }

  if (!params.receipt.receipt_push_notification_sent_at && updates.receipt_email_notification_sent_at) {
    // Direct FCM delivery is handled by the notifications database webhook.
    updates.receipt_push_notification_sent_at = updates.receipt_email_notification_sent_at;
  }

  if (errors.length > 0) {
    updates.receipt_notification_error = sanitizeError(errors.join(' | '));
  } else if (Object.keys(updates).length > 0) {
    updates.receipt_notification_error = null;
  }

  if (Object.keys(updates).length === 0) return;

  const { error } = await params.supabase
    .from('booking_receipts')
    .update(updates)
    .eq('id', params.receipt.id);

  if (error) {
    console.warn('Unable to update receipt notification status:', sanitizeError(error.message));
  }
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

function sanitizeError(value: string | null) {
  if (!value) return 'Unable to send receipt email.';
  return value.replace(/password|secret|token|apikey/gi, '[redacted]').slice(0, 500);
}

function validateReceiptPdf(pdfBytes: Uint8Array) {
  if (!pdfBytes || pdfBytes.byteLength === 0) {
    throw new Error('Receipt PDF attachment is empty');
  }
  if (pdfBytes.byteLength > 10 * 1024 * 1024) {
    throw new Error('Receipt PDF attachment too large');
  }

  const header = new TextDecoder().decode(pdfBytes.slice(0, 5));
  if (header !== '%PDF-') {
    throw new Error('Generated receipt attachment is not a valid PDF');
  }
}

async function generateReceiptPdf(params: {
  booking: BookingRow;
  bookingRef: string;
  receiptNo: string;
  qrPayload: string;
  generatedAt: Date;
}) {
  const { booking, bookingRef, receiptNo, qrPayload, generatedAt } = params;
  const status = booking.status as 'approved' | 'rejected';
  const isApproved = status === 'approved';
  const hall = single(booking.halls);
  const requester = single(booking.requester);
  const approver = single(booking.approver);
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const headerImage = await pdfDoc.embedPng(decodeBase64(SREC_HEADER_PNG_BASE64));
  const logoImage = await pdfDoc.embedPng(decodeBase64(VENUEVERSE_LOGO_PNG_BASE64));
  const stampImage = await pdfDoc.embedPng(decodeBase64(isApproved ? APPROVED_STAMP_PNG_BASE64 : REJECTED_STAMP_PNG_BASE64));

  const primary = rgb(0.039, 0.227, 0.4);
  const green = rgb(0.084, 0.451, 0.278);
  const red = rgb(0.706, 0.137, 0.094);
  const muted = rgb(0.4, 0.44, 0.52);
  const border = rgb(0.85, 0.88, 0.91);
  const light = rgb(0.965, 0.98, 0.99);
  const statusColor = isApproved ? green : red;
  const pageSize: [number, number] = [595.28, 841.89];
  const bottomMargin = 58;
  let currentPage = page;

  page.drawImage(headerImage, { x: 34, y: 766, width: 527, height: 54 });
  page.drawLine({ start: { x: 34, y: 754 }, end: { x: 561, y: 754 }, thickness: 2, color: green });
  page.drawImage(logoImage, { x: 42, y: 696, width: 46, height: 46 });
  page.drawText('Official Venue Booking Receipt', { x: 100, y: 728, size: 20, font: bold, color: primary });
  page.drawText(isApproved ? 'Approved venue / hall booking proof document' : 'Rejected venue / hall booking decision document', {
    x: 100,
    y: 709,
    size: 10,
    font: regular,
    color: muted
  });
  page.drawImage(stampImage, { x: 435, y: 690, width: 92, height: 58 });

  drawBox(page, 34, 620, 527, 58, light, border);
  drawMeta(page, bold, regular, 'Receipt No', receiptNo, 48, 654, primary, muted);
  drawMeta(page, bold, regular, 'Booking ID', bookingRef, 190, 654, primary, muted);
  drawMeta(page, bold, regular, 'Generated On', formatDateTime(generatedAt.toISOString()), 322, 654, primary, muted);
  drawQrCode(page, qrPayload, 492, 626, 50);
  page.drawText('Verify', { x: 507, y: 621, size: 6.5, font: bold, color: primary });

  const bookingRows = [
    ['Session / Event Name', booking.event_title],
    ['Booked Venue', hall?.name ?? 'Venue not provided'],
    ['Department', booking.department ?? requester?.department ?? 'Not provided'],
    ['Venue Type', hall?.venue_type ?? booking.event_type ?? 'Not provided'],
    ['Location', formatLocation(hall)],
    ['Date', formatDate(booking.start_time)],
    ['Time Slot', `${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}`],
    ['Booking Status', status.toUpperCase()]
  ];

  const requesterRows = [
    ['Requested By', requester?.full_name ?? 'Not provided'],
    ['Requester Email', requester?.email ?? 'Not provided'],
    ['Requester Dept.', requester?.department ?? 'Not provided'],
    ['Requester Role', requester?.role ?? 'user'],
    ['Faculty Coordinator', booking.faculty_coordinator ?? 'Not provided']
  ];

  const decisionRows = [
    [isApproved ? 'Approved Status' : 'Decision Status', isApproved ? 'Approved' : 'Rejected'],
    [isApproved ? 'Approved By' : 'Rejected By', approver?.full_name ?? 'Not provided'],
    [isApproved ? 'Approved On' : 'Rejected On', booking.updated_at ? formatDateTime(booking.updated_at) : 'Not provided'],
    [isApproved ? 'Approval Remarks' : 'Rejection Remarks', booking.admin_remarks || 'No remarks provided.']
  ];

  const mainTop = 590;
  const leftX = 34;
  const leftWidth = 305;
  const rightX = 351;
  const rightWidth = 210;
  const leftBottom = drawCompactSection(page, bold, regular, 'Booking Summary', bookingRows, leftX, mainTop, leftWidth, primary, statusColor);
  let rightBottom = drawCompactSection(page, bold, regular, 'Requester Details', requesterRows, rightX, mainTop, rightWidth, primary, primary);
  rightBottom = drawCompactSection(page, bold, regular, isApproved ? 'Approval Details' : 'Decision Details', decisionRows, rightX, rightBottom - 9, rightWidth, primary, statusColor);
  let y = Math.min(leftBottom, rightBottom) - 10;

  const purpose = isApproved
    ? 'This document confirms that the listed venue booking has been approved for the specified date and time slot. It may be shown to the venue coordinator, department staff, or admin when accessing the hall, lab, or auditorium.'
    : 'This document confirms that the listed venue booking request was reviewed and rejected. It is provided as an official decision record for the requester and department reference.';
  const purposeHeight = estimateTextHeight(regular, purpose, 497, 8.5, 11.5) + 34;
  if (y - purposeHeight < bottomMargin + 44) {
    currentPage = pdfDoc.addPage(pageSize);
    y = 792;
  }
  drawDocumentPurpose(currentPage, bold, regular, purpose, 34, y, 527, purposeHeight, isApproved, primary, muted, border);
  y -= purposeHeight + 8;

  if (y < bottomMargin + 38) {
    currentPage = pdfDoc.addPage(pageSize);
    y = 792;
  }
  drawFooter(currentPage, bold, regular, primary, muted, y);

  return await pdfDoc.save();
}

async function sendReceiptEmail(params: {
  booking: BookingRow;
  bookingRef: string;
  receiptNo: string;
  pdfBytes: Uint8Array;
  filename: string;
}) {
  const requester = single(params.booking.requester);
  const to = requester?.email;
  if (!to) return { sent: false, error: 'Requester email is missing.' };

  const host = Deno.env.get('SMTP_HOST');
  const port = Number(Deno.env.get('SMTP_PORT') ?? '465');
  const username = Deno.env.get('SMTP_USERNAME');
  const password = Deno.env.get('SMTP_PASSWORD');
  const from = Deno.env.get('SMTP_FROM') ?? username;
  if (!host || !username || !password || !from) {
    return { sent: false, error: 'SMTP secrets are not configured.' };
  }

  const isApproved = params.booking.status === 'approved';
  const hall = single(params.booking.halls);
  const subject = `VenueVerse Booking ${isApproved ? 'Approved' : 'Rejected'} Receipt - ${params.booking.event_title}`;
  const body = [
    `Dear ${requester?.full_name ?? 'VenueVerse user'},`,
    '',
    isApproved ? 'Your venue booking request has been approved.' : 'Your venue booking request has been reviewed and rejected.',
    '',
    `Booking ID: ${params.bookingRef}`,
    `Venue: ${hall?.name ?? 'Venue'}`,
    `Date: ${formatDate(params.booking.start_time)}`,
    `Time: ${formatTime(params.booking.start_time)} - ${formatTime(params.booking.end_time)}`,
    '',
    isApproved
      ? 'The official VenueVerse booking receipt is attached. You may show this document to the venue coordinator or department staff when required.'
      : 'The official VenueVerse decision receipt is attached for your reference.',
    '',
    'VenueVerse',
    'Campus Venue Booking System'
  ].join('\n');

  try {
    const base64Start = Date.now();
    const contentBase64 = bytesToBase64(params.pdfBytes);
    logTiming('pdf base64 conversion ms', params.booking.id, Date.now() - base64Start);

    const smtpStart = Date.now();
    await withTimeout(
      sendSmtpMail({
        host,
        port,
        username,
        password,
        from,
        to,
        subject,
        text: body,
        attachment: {
          filename: params.filename,
          contentType: 'application/pdf',
          contentBase64
        }
      }),
      gmailSmtpTimeoutMs,
      'Gmail SMTP send timed out.'
    );
    logTiming('gmail smtp send ms', params.booking.id, Date.now() - smtpStart);
    return { sent: true, error: null };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : 'Unable to send receipt email.' };
  }
}

async function sendSmtpMail(params: {
  host: string;
  port: number;
  username: string;
  password: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  attachment?: {
    filename: string;
    contentType: string;
    contentBase64: string;
  };
}) {
  if (params.port !== 465) {
    throw new Error('Receipt email currently supports SMTP over TLS on port 465.');
  }

  const connectStart = Date.now();
  const conn = await Deno.connectTls({ hostname: params.host, port: params.port });
  console.log(`[receipt] gmail smtp connect ms=${Date.now() - connectStart}`);
  const reader = new SmtpReader(conn);
  try {
    await reader.expect([220]);
    await smtpCommand(conn, reader, `EHLO venueverse.local`, [250]);
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
  text: string;
  attachment?: {
    filename: string;
    contentType: string;
    contentBase64: string;
  };
}) {
  const safeSubject = sanitizeHeader(params.subject);
  if (params.attachment) {
    const boundary = `venueverse-${crypto.randomUUID()}`;
    const safeFilename = sanitizeHeader(params.attachment.filename);
    const lines = [
      `From: ${params.from}`,
      `To: ${params.to}`,
      `Subject: ${safeSubject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      dotStuff(params.text),
      `--${boundary}`,
      `Content-Type: ${params.attachment.contentType}; name="${safeFilename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${safeFilename}"`,
      '',
      chunkBase64(params.attachment.contentBase64),
      `--${boundary}--`,
      '.',
      ''
    ];
    return lines.join('\r\n');
  }

  const lines = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${safeSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    dotStuff(params.text),
    '.',
    ''
  ];
  return lines.join('\r\n');
}

function chunkBase64(value: string) {
  return value.match(/.{1,76}/g)?.join('\r\n') ?? '';
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function dotStuff(value: string) {
  return value.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
}

function sanitizeHeader(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function extractEmailAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim();
}

class SmtpReader {
  private decoder = new TextDecoder();
  private buffer = '';

  constructor(private conn: Deno.TlsConn) {}

  async expect(expectedCodes: number[]) {
    const response = await this.readResponse();
    if (!expectedCodes.includes(response.code)) {
      throw new Error(`SMTP ${response.code}: ${response.message}`);
    }
    return response;
  }

  private async readResponse(): Promise<{ code: number; message: string }> {
    const lines: string[] = [];
    while (true) {
      const line = await this.readLine();
      if (!line) continue;
      lines.push(line);
      if (/^\d{3} /.test(line)) {
        return {
          code: Number(line.slice(0, 3)),
          message: lines.join(' ')
        };
      }
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

function drawSection(page: ReturnType<PDFDocument['addPage']>, font: unknown, title: string, y: number, color: ReturnType<typeof rgb>) {
  page.drawText(title, { x: 34, y, size: 13, font, color });
  page.drawLine({ start: { x: 34, y: y - 6 }, end: { x: 561, y: y - 6 }, thickness: 1, color: rgb(0.85, 0.88, 0.91) });
  return y - 22;
}

function drawTable(page: ReturnType<PDFDocument['addPage']>, bold: unknown, regular: unknown, rows: string[][], y: number, accent: ReturnType<typeof rgb>) {
  let currentY = y;
  rows.forEach(([label, value], index) => {
    const rowHeight = getTableRowHeight(regular, value);
    page.drawRectangle({ x: 34, y: currentY - rowHeight + 10, width: 527, height: rowHeight, color: index % 2 === 0 ? rgb(0.98, 0.985, 0.995) : rgb(1, 1, 1) });
    page.drawText(label, { x: 46, y: currentY - 5, size: 9, font: bold, color: rgb(0.4, 0.44, 0.52) });
    if (label === 'Booking Status' || label.includes('Status')) {
      page.drawText(toPdfText(value), { x: 198, y: currentY - 5, size: 10, font: bold, color: accent });
    } else {
      drawWrappedText(page, regular, value, 198, currentY - 5, 340, 10, 12, rgb(0.09, 0.13, 0.17));
    }
    currentY -= rowHeight;
  });
  return currentY;
}

function drawCompactSection(
  page: ReturnType<PDFDocument['addPage']>,
  bold: unknown,
  regular: unknown,
  title: string,
  rows: string[][],
  x: number,
  y: number,
  width: number,
  titleColor: ReturnType<typeof rgb>,
  accent: ReturnType<typeof rgb>
) {
  const sectionHeight = estimateCompactSectionHeight(rows, regular, width);
  drawBox(page, x, y - sectionHeight + 4, width, sectionHeight, rgb(1, 1, 1), rgb(0.88, 0.91, 0.94));
  page.drawText(title, { x: x + 10, y: y - 12, size: 11.5, font: bold, color: titleColor });
  page.drawLine({
    start: { x: x + 10, y: y - 19 },
    end: { x: x + width - 10, y: y - 19 },
    thickness: 1,
    color: rgb(0.88, 0.91, 0.94)
  });
  return drawCompactTable(page, bold, regular, rows, x, y - 25, width, accent) - 4;
}

function drawCompactTable(
  page: ReturnType<PDFDocument['addPage']>,
  bold: unknown,
  regular: unknown,
  rows: string[][],
  x: number,
  y: number,
  width: number,
  accent: ReturnType<typeof rgb>
) {
  let currentY = y;
  rows.forEach(([label, value], index) => {
    const rowHeight = getCompactRowHeight(regular, value, width);
    const labelWidth = Math.min(106, width * 0.42);
    const valueX = x + labelWidth + 14;
    const valueWidth = width - labelWidth - 24;
    const valueSize = label.toLowerCase().includes('email') ? 7.5 : 8.5;
    page.drawRectangle({
      x: x + 1,
      y: currentY - rowHeight + 5,
      width: width - 2,
      height: rowHeight,
      color: index % 2 === 0 ? rgb(0.98, 0.985, 0.995) : rgb(1, 1, 1)
    });
    page.drawText(label, {
      x: x + 9,
      y: currentY - 8,
      size: 7.7,
      font: bold,
      color: rgb(0.4, 0.44, 0.52)
    });
    if (label === 'Booking Status' || label.includes('Status')) {
      page.drawText(toPdfText(value), { x: valueX, y: currentY - 8, size: 8.8, font: bold, color: accent });
    } else {
      drawWrappedText(page, regular, value, valueX, currentY - 8, valueWidth, valueSize, 10.2, rgb(0.09, 0.13, 0.17));
    }
    currentY -= rowHeight;
  });
  return currentY;
}

function drawQrCode(page: ReturnType<PDFDocument['addPage']>, payload: string, x: number, y: number, size: number) {
  const qr = QRCode.create(payload, { margin: 1 });
  const modules = qr.modules as { size: number; data: boolean[] };
  const moduleCount = modules.size;
  const cellSize = size / moduleCount;

  page.drawRectangle({ x, y, width: size, height: size, color: rgb(1, 1, 1) });
  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!modules.data[row * moduleCount + col]) continue;
      page.drawRectangle({
        x: x + col * cellSize,
        y: y + size - (row + 1) * cellSize,
        width: cellSize + 0.05,
        height: cellSize + 0.05,
        color: rgb(0, 0, 0)
      });
    }
  }
}

function drawMeta(page: ReturnType<PDFDocument['addPage']>, bold: unknown, regular: unknown, label: string, value: string, x: number, y: number, textColor: ReturnType<typeof rgb>, muted: ReturnType<typeof rgb>) {
  page.drawText(label, { x, y, size: 8, font: bold, color: muted });
  page.drawText(toPdfText(value), { x, y: y - 16, size: 10, font: regular, color: textColor });
}

function drawBox(page: ReturnType<PDFDocument['addPage']>, x: number, y: number, width: number, height: number, color: ReturnType<typeof rgb>, borderColor: ReturnType<typeof rgb>) {
  page.drawRectangle({ x, y, width, height, color, borderColor, borderWidth: 1 });
}

function drawWrappedText(page: ReturnType<PDFDocument['addPage']>, font: unknown, text: string, x: number, y: number, maxWidth: number, size: number, lineHeight: number, color: ReturnType<typeof rgb>) {
  const words = toPdfText(text).split(/\s+/);
  let line = '';
  let currentY = y;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    const width = (font as { widthOfTextAtSize: (value: string, size: number) => number }).widthOfTextAtSize(next, size);
    if (width > maxWidth && line) {
      page.drawText(line, { x, y: currentY, size, font, color });
      line = word;
      currentY -= lineHeight;
    } else {
      line = next;
    }
  }
  if (line) page.drawText(line, { x, y: currentY, size, font, color });
}

function drawFooter(page: ReturnType<PDFDocument['addPage']>, bold: unknown, regular: unknown, primary: ReturnType<typeof rgb>, muted: ReturnType<typeof rgb>, y: number) {
  const footerTop = y - 4;
  page.drawLine({ start: { x: 34, y: footerTop }, end: { x: 561, y: footerTop }, thickness: 1, color: rgb(0.85, 0.88, 0.91) });
  page.drawText('VenueVerse - Campus Venue Booking System', { x: 188, y: footerTop - 12, size: 8, font: bold, color: primary });
  page.drawText('Computer-generated receipt - Scan the QR code in VenueVerse to verify', { x: 162, y: footerTop - 24, size: 7, font: regular, color: muted });
  page.drawText('Generated securely by VenueVerse', { x: 236, y: footerTop - 34, size: 7, font: regular, color: muted });
}

function drawDocumentPurpose(
  page: ReturnType<PDFDocument['addPage']>,
  bold: unknown,
  regular: unknown,
  purpose: string,
  x: number,
  y: number,
  width: number,
  height: number,
  isApproved: boolean,
  primary: ReturnType<typeof rgb>,
  muted: ReturnType<typeof rgb>,
  border: ReturnType<typeof rgb>
) {
  const fill = isApproved ? rgb(0.95, 0.99, 0.965) : rgb(1, 0.96, 0.955);
  const leftBorder = isApproved ? rgb(0.084, 0.451, 0.278) : rgb(0.706, 0.137, 0.094);
  drawBox(page, x, y - height + 6, width, height, fill, border);
  page.drawRectangle({ x, y: y - height + 6, width: 4, height, color: leftBorder });
  page.drawText('Document Purpose', { x: x + 14, y: y - 10, size: 11, font: bold, color: primary });
  drawWrappedText(page, regular, purpose, x + 14, y - 25, width - 28, 8.5, 11.5, muted);
}

function estimateSectionHeight(rows: string[][], font: unknown) {
  return 22 + rows.reduce((height, [, value]) => height + getTableRowHeight(font, value), 0);
}

function estimateCompactSectionHeight(rows: string[][], font: unknown, width: number) {
  return 33 + rows.reduce((height, [, value]) => height + getCompactRowHeight(font, value, width), 0);
}

function getTableRowHeight(font: unknown, value: string) {
  return Math.max(24, estimateTextHeight(font, value, 340, 10, 12) + 12);
}

function getCompactRowHeight(font: unknown, value: string, width: number) {
  const labelWidth = Math.min(106, width * 0.42);
  const valueWidth = width - labelWidth - 24;
  return Math.max(20, estimateTextHeight(font, value, valueWidth, 8.5, 10.2) + 9);
}

function estimateTextHeight(font: unknown, text: string, maxWidth: number, size: number, lineHeight: number) {
  return wrapTextLines(font, text, maxWidth, size).length * lineHeight;
}

function wrapTextLines(font: unknown, text: string, maxWidth: number, size: number) {
  const words = toPdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    const width = (font as { widthOfTextAtSize: (value: string, size: number) => number }).widthOfTextAtSize(next, size);
    if (width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [''];
}

function formatBookingRef(bookingId: string, year: number) {
  return `VV-${year}-${bookingId.slice(0, 8).toUpperCase()}`;
}

function formatReceiptNo(bookingId: string, year: number) {
  return `VV-RCPT-${year}-${bookingId.slice(0, 8).toUpperCase()}`;
}

function getReceiptPdfPath(receiptNo: string) {
  return `${receiptNo}.pdf`;
}

function getReceiptPdfPathCandidates(receipt: ReceiptRow) {
  return uniqueStrings([
    receipt.pdf_path,
    getReceiptPdfPath(receipt.receipt_no),
    `${receipt.booking_id}/${receipt.receipt_no}.pdf`
  ]);
}

function uniqueStrings(values: string[]) {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

function formatDate(value: string) {
  return toPdfText(new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(value)));
}

function formatTime(value: string) {
  return toPdfText(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(value)));
}

function formatDateTime(value: string) {
  return toPdfText(new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value)));
}

function formatLocation(hall: ReturnType<typeof single<NonNullable<BookingRow['halls']>>>) {
  if (!hall) return 'Not provided';
  return [hall.location, hall.block, hall.floor].filter(Boolean).join(', ') || 'Not provided';
}

function single<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function bookingRequesterEmail(booking: BookingRow) {
  return single(booking.requester)?.email ?? null;
}

function isRecentEmailSending(receipt: ReceiptRow) {
  if (receipt.email_status !== 'sending' || !receipt.last_email_attempt_at) return false;
  const attemptedAt = new Date(receipt.last_email_attempt_at).getTime();
  if (Number.isNaN(attemptedAt)) return false;
  return Date.now() - attemptedAt < recentSendingWindowMs;
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

function logTiming(label: string, bookingId: string, value?: number) {
  const suffix = typeof value === 'number' ? `=${value}` : '';
  console.log(`[receipt] booking=${bookingId} ${label}${suffix}`);
}

function waitUntil(promise: Promise<unknown>) {
  const runtime = (globalThis as {
    EdgeRuntime?: {
      waitUntil: (promise: Promise<unknown>) => void;
    };
  }).EdgeRuntime;

  if (runtime?.waitUntil) {
    runtime.waitUntil(promise);
    return;
  }

  promise.catch((error) => {
    console.warn('Background receipt email failed:', error instanceof Error ? error.message : String(error));
  });
}

function decodeBase64(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toPdfText(value: string) {
  return value
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, '?');
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
