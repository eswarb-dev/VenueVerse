import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { buildReceiptPdf } from '../_shared/receipt-pdf.ts';

type RequestBody = {
  booking_id?: string;
  receipt_number?: string;
};

type ReceiptRow = {
  booking_id: string;
  receipt_no: string;
  pdf_path: string;
  storage_deleted_at: string | null;
};

type BookingRow = {
  id: string;
  user_id: string | null;
  halls: { department: string | null } | { department: string | null }[] | null;
};

const bucketName = 'booking-receipts';
const signedUrlExpiresIn = 60 * 10;
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('VENUEVERSE_ALLOWED_WEB_ORIGIN') ?? '',
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Supabase environment variables are missing.' }, 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: authData, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !authData.user) return jsonResponse({ error: 'Unauthorized.' }, 401);

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const receipt = await fetchReceipt(supabase, body);
    if (!receipt) return jsonResponse({ error: 'Receipt not found.' }, 404);

    const booking = await fetchBooking(supabase, receipt.booking_id);
    if (!booking) return jsonResponse({ error: 'Booking not found.' }, 404);

    const allowed = await canViewReceipt(supabase, authData.user.id, booking);
    if (!allowed) return jsonResponse({ error: 'Not allowed to view this receipt.' }, 403);

    if (!receipt.storage_deleted_at) {
      for (const path of getReceiptPdfPathCandidates(receipt)) {
        const { data, error } = await supabase.storage.from(bucketName).createSignedUrl(path, signedUrlExpiresIn);
        if (!error && data?.signedUrl) {
          return jsonResponse({
            mode: 'signed_url',
            signedUrl: data.signedUrl,
            receiptNumber: receipt.receipt_no,
            expiresIn: signedUrlExpiresIn
          });
        }
      }
    }

    const built = await buildReceiptPdf(supabase, receipt.booking_id);
    return new Response(built.pdfBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${sanitizeFilename(receipt.receipt_no)}.pdf"`
      }
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? sanitizeError(error.message) : 'Unable to load receipt PDF.' }, 500);
  }
});

async function fetchReceipt(supabase: ReturnType<typeof createClient>, body: RequestBody) {
  let query = supabase
    .from('booking_receipts')
    .select('booking_id, receipt_no, pdf_path, storage_deleted_at');

  if (body.booking_id) query = query.eq('booking_id', body.booking_id);
  else if (body.receipt_number) query = query.eq('receipt_no', body.receipt_number);
  else throw new Error('booking_id or receipt_number is required.');

  const { data, error } = await query.order('generated_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data as ReceiptRow | null;
}

async function fetchBooking(supabase: ReturnType<typeof createClient>, bookingId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, user_id, halls(department)')
    .eq('id', bookingId)
    .maybeSingle();
  if (error) throw error;
  return data as BookingRow | null;
}

async function canViewReceipt(supabase: ReturnType<typeof createClient>, userId: string, booking: BookingRow) {
  if (booking.user_id === userId) return true;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, department')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (profile?.role === 'super_admin') return true;

  const hall = Array.isArray(booking.halls) ? booking.halls[0] : booking.halls;
  return profile?.role === 'admin' && Boolean(profile.department) && profile.department === hall?.department;
}

function getReceiptPdfPathCandidates(receipt: ReceiptRow) {
  return uniqueStrings([
    receipt.pdf_path,
    `${receipt.receipt_no}.pdf`,
    `${receipt.booking_id}/${receipt.receipt_no}.pdf`
  ]);
}

function uniqueStrings(values: string[]) {
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

function sanitizeFilename(value: string) {
  return value.replace(/[^A-Za-z0-9_.-]+/g, '_');
}

function sanitizeError(value: string) {
  return value.replace(/password|secret|token|apikey|signedUrl|signed URL/gi, '[redacted]').slice(0, 500);
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
