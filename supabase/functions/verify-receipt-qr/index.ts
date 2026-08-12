import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type VerifyRequest = {
  token?: string;
  payload?: string;
};

type ReceiptResult = {
  receipt_no: string;
  status: 'approved' | 'rejected';
  generated_at: string;
  bookings: {
    id: string;
    event_title: string;
    department: string | null;
    start_time: string;
    end_time: string;
    status: string;
    revoked_at: string | null;
    revocation_reason: string | null;
    halls: {
      name: string | null;
      department: string | null;
    } | { name: string | null; department: string | null }[] | null;
    revoked_by_profile: {
      department: string | null;
    } | { department: string | null }[] | null;
  } | {
    id: string;
    event_title: string;
    department: string | null;
    start_time: string;
    end_time: string;
    status: string;
    revoked_at: string | null;
    revocation_reason: string | null;
    halls: {
      name: string | null;
      department: string | null;
    } | { name: string | null; department: string | null }[] | null;
    revoked_by_profile: {
      department: string | null;
    } | { department: string | null }[] | null;
  }[] | null;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('VENUEVERSE_ALLOWED_WEB_ORIGIN') ?? '',
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ valid: false, error: 'Method not allowed.' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ valid: false, error: 'Supabase environment variables are missing.' }, 500);
    }

    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: authData, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !authData.user) return jsonResponse({ valid: false, error: 'Unauthorized.' }, 401);

    const payload = (await req.json().catch(() => ({}))) as VerifyRequest;
    const token = payload.token ?? extractToken(payload.payload ?? '');
    if (!token) return jsonResponse({ valid: false, error: 'Invalid receipt QR.' }, 400);

    const { data, error } = await supabase
      .from('booking_receipts')
      .select('receipt_no, status, generated_at, bookings(id, event_title, department, start_time, end_time, status, revoked_at, revocation_reason, halls(name, department), revoked_by_profile:revoked_by(department))')
      .eq('verification_token', token)
      .maybeSingle();
    if (error) throw error;
    if (!data) return jsonResponse({ valid: false, error: 'Invalid receipt QR.' });

    const receipt = data as ReceiptResult;
    const booking = single(receipt.bookings);
    const hall = single(booking?.halls);
    const revoker = single(booking?.revoked_by_profile);
    const isRevoked = booking?.status === 'revoked';
    const bookingYear = booking?.start_time ? new Date(booking.start_time).getFullYear() : new Date(receipt.generated_at).getFullYear();
    const bookingRef = booking?.id ? `VV-${bookingYear}-${booking.id.slice(0, 8).toUpperCase()}` : null;

    return jsonResponse({
      valid: true,
      receipt_no: receipt.receipt_no,
      booking_id: bookingRef,
      status: receipt.status,
      receipt_status: receipt.status,
      live_booking_status: booking?.status ?? null,
      is_revoked: isRevoked,
      revoked_at: booking?.revoked_at ?? null,
      revoked_on: booking?.revoked_at ? formatDateTime(booking.revoked_at) : null,
      revocation_reason: booking?.revocation_reason ?? null,
      revoked_by_department: revoker?.department ?? hall?.department ?? null,
      event_title: booking?.event_title ?? null,
      venue: hall?.name ?? null,
      department: booking?.department ?? null,
      date: booking?.start_time ? formatDate(booking.start_time) : null,
      time_slot: booking?.start_time && booking?.end_time ? `${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}` : null,
      generated_at: receipt.generated_at
    });
  } catch (error) {
    return jsonResponse({ valid: false, error: error instanceof Error ? error.message : 'Unable to verify receipt QR.' }, 500);
  }
});

function extractToken(payload: string) {
  if (!payload) return '';
  const deepLinkPrefix = 'venueverse://receipt/verify/';
  if (payload.startsWith(deepLinkPrefix)) return payload.slice(deepLinkPrefix.length).trim();
  try {
    const parsed = new URL(payload);
    return parsed.searchParams.get('token') ?? parsed.pathname.split('/').filter(Boolean).pop() ?? '';
  } catch {
    return payload.trim();
  }
}

function single<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value));
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
