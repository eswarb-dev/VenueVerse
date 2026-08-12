import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type CleanupRequest = {
  limit?: number;
  older_than_days?: number;
};

type ReceiptRow = {
  id: string;
  booking_id: string;
  receipt_no: string;
  pdf_path: string;
  created_at: string;
};

const bucketName = 'booking-receipts';
const RECEIPT_STORAGE_RETENTION_DAYS = 30;
const maxLimit = 50;
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('VENUEVERSE_ALLOWED_WEB_ORIGIN') ?? '',
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cleanup-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const startedAt = Date.now();
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Supabase environment variables are missing.' }, 500);
    if (!isAuthorized(req)) return jsonResponse({ error: 'Unauthorized.' }, 401);

    const payload = (await req.json().catch(() => ({}))) as CleanupRequest;
    const olderThanDays = Math.max(1, Number(payload.older_than_days ?? RECEIPT_STORAGE_RETENTION_DAYS));
    const limit = Math.max(1, Math.min(Number(payload.limit ?? 10), maxLimit));
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const { data, error } = await supabase
      .from('booking_receipts')
      .select('id, booking_id, receipt_no, pdf_path, created_at')
      .not('pdf_path', 'is', null)
      .is('storage_deleted_at', null)
      .lt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;

    const receipts = (data ?? []) as ReceiptRow[];
    let deleted = 0;
    let failed = 0;
    for (const receipt of receipts) {
      try {
        const { error: removeError } = await supabase.storage.from(bucketName).remove([receipt.pdf_path]);
        if (removeError) throw removeError;

        const deletedAt = new Date().toISOString();
        const { error: updateError } = await supabase
          .from('booking_receipts')
          .update({ storage_deleted_at: deletedAt })
          .eq('id', receipt.id);
        if (updateError) throw updateError;

        deleted += 1;
        console.log(`[receipt-cleanup] receipt_id=${receipt.id} path=${receipt.pdf_path} deleted_storage=true`);
      } catch (itemError) {
        failed += 1;
        const safeError = sanitizeError(itemError instanceof Error ? itemError.message : String(itemError));
        console.warn(`[receipt-cleanup] receipt_id=${receipt.id} path=${receipt.pdf_path} failed:`, safeError);
      }
    }

    return jsonResponse({
      success: true,
      scanned: receipts.length,
      deleted,
      failed,
      ms: Date.now() - startedAt
    });
  } catch (error) {
    return jsonResponse({ success: false, error: error instanceof Error ? sanitizeError(error.message) : 'Receipt cleanup failed.' }, 500);
  }
});

function isAuthorized(req: Request) {
  const cleanupSecret = Deno.env.get('RECEIPT_CLEANUP_SECRET');
  const providedSecret = req.headers.get('x-cleanup-secret');
  return Boolean(cleanupSecret && providedSecret === cleanupSecret);
}

function sanitizeError(value: string) {
  return value.replace(/password|secret|token|apikey/gi, '[redacted]').slice(0, 500);
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
