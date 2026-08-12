import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system';

export type BookingReceipt = {
  id: string;
  bookingId: string;
  receiptNo: string;
  status: 'approved' | 'rejected';
  pdfPath: string;
  emailedTo: string | null;
  emailedAt: string | null;
  emailStatus: string | null;
  emailError: string | null;
  generatedAt: string;
};

export type GenerateReceiptResult = {
  success: boolean;
  receiptNo: string | null;
  pdfPath: string | null;
  emailed: boolean;
  emailQueued: boolean;
  emailStatus: string | null;
  emailError: string | null;
};

export type EmailReceiptPdfCopyResult = {
  success: boolean;
};

export type ReceiptVerificationResult = {
  valid: boolean;
  error?: string;
  receiptNo?: string;
  bookingId?: string | null;
  status?: 'approved' | 'rejected';
  receiptStatus?: 'approved' | 'rejected';
  liveBookingStatus?: string | null;
  isRevoked?: boolean;
  revokedAt?: string | null;
  revokedOn?: string | null;
  revocationReason?: string | null;
  revokedByDepartment?: string | null;
  eventTitle?: string | null;
  venue?: string | null;
  department?: string | null;
  date?: string | null;
  timeSlot?: string | null;
  generatedAt?: string | null;
};

type BookingReceiptRow = {
  id: string;
  booking_id: string;
  receipt_no: string;
  status: 'approved' | 'rejected';
  pdf_path: string;
  emailed_to: string | null;
  emailed_at: string | null;
  email_status?: string | null;
  email_error?: string | null;
  generated_at: string;
};

type GenerateReceiptResponse = {
  success?: boolean;
  receipt_no?: string;
  pdf_path?: string;
  emailed?: boolean;
  email_queued?: boolean;
  email_status?: string | null;
  email_error?: string | null;
  error?: string;
};

type EmailReceiptPdfCopyResponse = {
  success?: boolean;
  error?: string;
};

type FunctionInvokeError = Error & {
  context?: Response;
};

type VerifyReceiptResponse = {
  valid?: boolean;
  error?: string;
  receipt_no?: string;
  booking_id?: string | null;
  status?: 'approved' | 'rejected';
  receipt_status?: 'approved' | 'rejected';
  live_booking_status?: string | null;
  is_revoked?: boolean;
  revoked_at?: string | null;
  revoked_on?: string | null;
  revocation_reason?: string | null;
  revoked_by_department?: string | null;
  event_title?: string | null;
  venue?: string | null;
  department?: string | null;
  date?: string | null;
  time_slot?: string | null;
  generated_at?: string | null;
};

type ReceiptPdfJsonResponse = {
  mode?: 'signed_url';
  signedUrl?: string;
  receiptNumber?: string;
  expiresIn?: number;
  error?: string;
};

export async function generateBookingReceipt(bookingId: string, options?: { forceResendEmail?: boolean; forceRegenerate?: boolean; queueEmail?: boolean }): Promise<GenerateReceiptResult> {
  const { data, error } = await supabase.functions.invoke('generate-booking-receipt', {
    body: {
      booking_id: bookingId,
      force_resend_email: options?.forceResendEmail ?? false,
      force_regenerate: options?.forceRegenerate ?? false,
      queue_email: options?.queueEmail ?? false
    }
  });

  if (error) throw await normalizeFunctionError(error);
  const response = data as GenerateReceiptResponse;
  if (response.error) throw new Error(response.error);
  if (options?.queueEmail && response.email_queued) {
    triggerReceiptEmailQueueProcessing();
  }

  return {
    success: Boolean(response.success),
    receiptNo: response.receipt_no ?? null,
    pdfPath: response.pdf_path ?? null,
    emailed: Boolean(response.emailed),
    emailQueued: Boolean(response.email_queued),
    emailStatus: response.email_status ?? null,
    emailError: response.email_error ?? null
  };
}

export function triggerReceiptEmailQueueProcessing(delayMs = 1500) {
  setTimeout(() => {
    void callReceiptEmailQueueFunction({ limit: 1 }).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`Receipt email queue trigger failed: ${message}`);
    });
  }, delayMs);
}

export function triggerBookingReceiptGeneration(bookingId: string, options?: { forceResendEmail?: boolean; forceRegenerate?: boolean; queueEmail?: boolean; delayMs?: number }) {
  const delayMs = options?.delayMs ?? 300;
  setTimeout(() => {
    void generateBookingReceiptInBackground(bookingId, options);
  }, delayMs);
}

async function generateBookingReceiptInBackground(bookingId: string, options?: { forceResendEmail?: boolean; forceRegenerate?: boolean; queueEmail?: boolean }) {
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await generateBookingReceipt(bookingId, options);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`Receipt generation background attempt ${attempt} failed: ${message}`);
      if (attempt < maxAttempts) {
        await wait(1500);
      }
    }
  }
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function getBookingReceipt(bookingId: string): Promise<BookingReceipt | null> {
  const { data, error } = await supabase
    .from('booking_receipts')
    .select('id, booking_id, receipt_no, status, pdf_path, emailed_to, emailed_at, email_status, email_error, generated_at')
    .eq('booking_id', bookingId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw await normalizeFunctionError(error);
  if (!data) return null;
  return mapReceipt(data as BookingReceiptRow);
}

export async function emailReceiptPdfCopy(receipt: BookingReceipt): Promise<EmailReceiptPdfCopyResult> {
  const { data, error } = await supabase.functions.invoke('send-receipt-pdf-attachment', {
    body: {
      booking_id: receipt.bookingId,
      receipt_number: receipt.receiptNo
    }
  });

  if (error) throw await normalizeFunctionError(error);
  const response = data as EmailReceiptPdfCopyResponse;
  if (response.error) throw new Error(response.error);
  return { success: Boolean(response.success) };
}

export function getDefaultReceiptFileName(receiptNo: string) {
  return `VenueVerse_Receipt_${receiptNo}.pdf`;
}

export function sanitizeReceiptFileName(name: string, receiptNo: string) {
  const fallback = getDefaultReceiptFileName(receiptNo);
  const withoutExtension = name
    .replace(/\.pdf$/i, '')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .trim()
    .replace(/\s+/g, '_');

  return `${withoutExtension || fallback.replace(/\.pdf$/i, '')}.pdf`;
}

export async function downloadReceiptToCache(params: {
  signedUrl: string;
  receiptNo: string;
  customFileName?: string;
}) {
  const fileName = params.customFileName
    ? sanitizeReceiptFileName(params.customFileName, params.receiptNo)
    : sanitizeReceiptFileName(params.receiptNo, params.receiptNo);
  const directory = getReceiptCacheDirectory();
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true }).catch(() => undefined);
  const targetUri = `${directory}${fileName}`;
  const cached = await FileSystem.getInfoAsync(targetUri);
  if (cached.exists && cached.size && cached.size > 0) {
    return {
      localUri: targetUri,
      fileName
    };
  }

  const downloaded = await FileSystem.downloadAsync(params.signedUrl, targetUri);
  return {
    localUri: downloaded.uri,
    fileName
  };
}

export async function fetchReceiptPdfToCache(receipt: BookingReceipt) {
  const cached = await getCachedReceiptFile(receipt.receiptNo);
  if (cached) return cached;

  const directory = getReceiptCacheDirectory();
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true }).catch(() => undefined);
  const fileName = sanitizeReceiptFileName(receipt.receiptNo, receipt.receiptNo);
  const targetUri = `${directory}${fileName}`;
  const response = await callReceiptPdfFunction(receipt);
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const json = (await response.json()) as ReceiptPdfJsonResponse;
    if (json.error) throw new Error(json.error);
    if (json.mode !== 'signed_url' || !json.signedUrl) throw new Error('Receipt PDF link was not returned.');
    const downloaded = await FileSystem.downloadAsync(json.signedUrl, targetUri);
    await assertCachedPdf(downloaded.uri);
    return {
      localUri: downloaded.uri,
      fileName
    };
  }

  if (!response.ok) {
    throw new Error('Unable to download receipt PDF.');
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  validatePdfBytes(bytes);
  await FileSystem.writeAsStringAsync(targetUri, bytesToBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64
  });

  return {
    localUri: targetUri,
    fileName
  };
}

export async function copyReceiptCacheFile(params: {
  sourceUri: string;
  receiptNo: string;
  customFileName: string;
}) {
  const fileName = sanitizeReceiptFileName(params.customFileName, params.receiptNo);
  const directory = getReceiptCacheDirectory();
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true }).catch(() => undefined);
  const targetUri = `${directory}${fileName}`;
  if (params.sourceUri !== targetUri) {
    await FileSystem.copyAsync({ from: params.sourceUri, to: targetUri });
  }
  return {
    localUri: targetUri,
    fileName
  };
}

export async function getCachedReceiptFile(receiptNo: string) {
  const fileName = sanitizeReceiptFileName(receiptNo, receiptNo);
  const localUri = `${getReceiptCacheDirectory()}${fileName}`;
  const cached = await getValidCachedPdfInfo(localUri);
  if (cached) {
    return {
      localUri,
      fileName
    };
  }
  return null;
}

export async function deleteCachedReceiptFile(localUri: string) {
  await FileSystem.deleteAsync(localUri, { idempotent: true });
}

function getReceiptCacheDirectory() {
  return `${FileSystem.cacheDirectory ?? ''}venueverse-receipts/`;
}

async function callReceiptPdfFunction(receipt: BookingReceipt) {
  const functionUrl = getSupabaseFunctionUrl('get-receipt-pdf');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in again to view this receipt.');

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: getSupabaseAnonKey(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      booking_id: receipt.bookingId,
      receipt_number: receipt.receiptNo
    })
  });

  if (!response.ok && !(response.headers.get('content-type') ?? '').includes('application/json')) {
    throw new Error('Unable to download receipt PDF.');
  }

  return response;
}

async function callReceiptEmailQueueFunction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('process-receipt-email-queue', {
    body
  });

  if (error) throw await normalizeFunctionError(error);
  const json = data as { error?: string };
  if (json?.error) throw new Error(json.error);
  return json;
}

function getSupabaseFunctionUrl(functionName: string) {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
  if (!supabaseUrl) throw new Error('Supabase URL is not configured.');
  return `${supabaseUrl}/functions/v1/${functionName}`;
}

function getSupabaseAnonKey() {
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error('Supabase anon key is not configured.');
  return anonKey;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function assertCachedPdf(localUri: string) {
  const file = await getValidCachedPdfInfo(localUri);
  if (!file) {
    throw new Error('Receipt PDF download was empty.');
  }
}

async function getValidCachedPdfInfo(localUri: string) {
  const file = await FileSystem.getInfoAsync(localUri);
  if (!file.exists || !file.size || file.size <= 0) return null;

  const header = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
    length: 8
  });
  if (!header.startsWith('JVBER')) return null;

  return file;
}

function validatePdfBytes(bytes: Uint8Array) {
  if (bytes.byteLength <= 0) throw new Error('Receipt PDF download was empty.');
  const header = String.fromCharCode(...bytes.slice(0, 5));
  if (header !== '%PDF-') throw new Error('Downloaded receipt is not a valid PDF.');
}

export async function verifyReceiptQr(rawPayload: string): Promise<ReceiptVerificationResult> {
  const { data, error } = await supabase.functions.invoke('verify-receipt-qr', {
    body: {
      token: extractReceiptToken(rawPayload),
      payload: rawPayload
    }
  });

  if (error) throw error;
  const response = data as VerifyReceiptResponse;
  return {
    valid: Boolean(response.valid),
    error: response.error,
    receiptNo: response.receipt_no,
    bookingId: response.booking_id,
    status: response.status,
    receiptStatus: response.receipt_status,
    liveBookingStatus: response.live_booking_status,
    isRevoked: response.is_revoked,
    revokedAt: response.revoked_at,
    revokedOn: response.revoked_on,
    revocationReason: response.revocation_reason,
    revokedByDepartment: response.revoked_by_department,
    eventTitle: response.event_title,
    venue: response.venue,
    department: response.department,
    date: response.date,
    timeSlot: response.time_slot,
    generatedAt: response.generated_at
  };
}

export function extractReceiptToken(rawPayload: string) {
  const value = rawPayload.trim();
  const deepLinkPrefix = 'venueverse://receipt/verify/';
  if (value.startsWith(deepLinkPrefix)) return value.slice(deepLinkPrefix.length);

  try {
    const parsed = new URL(value);
    return parsed.searchParams.get('token') ?? parsed.pathname.split('/').filter(Boolean).pop() ?? value;
  } catch {
    return value;
  }
}

function mapReceipt(row: BookingReceiptRow): BookingReceipt {
  return {
    id: row.id,
    bookingId: row.booking_id,
    receiptNo: row.receipt_no,
    status: row.status,
    pdfPath: row.pdf_path,
    emailedTo: row.emailed_to,
    emailedAt: row.emailed_at,
    emailStatus: row.email_status ?? null,
    emailError: row.email_error ?? null,
    generatedAt: row.generated_at
  };
}

async function normalizeFunctionError(error: unknown) {
  const invokeError = error as FunctionInvokeError;
  if (invokeError?.context) {
    const status = invokeError.context.status;
    try {
      const body = await invokeError.context.clone().json();
      if (body?.error) return new Error(String(body.error));
      if (body?.message) return new Error(String(body.message));
    } catch {
      try {
        const text = await invokeError.context.clone().text();
        if (text) return new Error(text);
      } catch {
        // Fall through to the original message.
      }
    }

    if (status === 401) return new Error('Your session is not authorized to generate this receipt. Please sign in again.');
    if (status === 403) return new Error('Only the booking reviewer, department approver, or admin can generate this receipt.');
    if (status >= 500) return new Error('Receipt generation failed on the server. Please try again.');
  }

  if (error instanceof Error && error.message.includes('non-2xx')) {
    return new Error(error.message);
  }

  return error instanceof Error ? error : new Error('Receipt request failed.');
}
