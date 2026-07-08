import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type PushRequest = {
  user_id?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
};

type PushTokenRow = {
  id: string;
  expo_push_token: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Supabase environment variables are missing.' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace('Bearer ', '');
  const { data: authData, error: authError } = await supabase.auth.getUser(jwt);

  if (authError || !authData.user) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  const payload = (await req.json().catch(() => ({}))) as PushRequest;
  if (!payload.user_id || !payload.title || !payload.body) {
    return jsonResponse({ error: 'user_id, title, and body are required.' }, 400);
  }

  const targetRateLimited = await checkRateLimit({
    supabase,
    key: `send-push-notification:target:${payload.user_id}`,
    maxRequests: 20,
    windowSeconds: 300
  });

  const callerRateLimited = await checkRateLimit({
    supabase,
    key: `send-push-notification:caller:${authData.user.id}`,
    maxRequests: 60,
    windowSeconds: 300
  });

  if (targetRateLimited || callerRateLimited) {
    return jsonResponse({ error: 'Push notification rate limit exceeded. Please try again later.' }, 429);
  }

  const allowed = await canSendNotification({
    supabase,
    callerId: authData.user.id,
    targetUserId: payload.user_id,
    data: payload.data ?? {}
  });

  if (!allowed) {
    return jsonResponse({ error: 'Not allowed to send this notification.' }, 403);
  }

  const { data: tokens, error: tokensError } = await supabase
    .from('push_tokens')
    .select('id, expo_push_token')
    .eq('user_id', payload.user_id);

  if (tokensError) {
    return jsonResponse({ error: tokensError.message }, 500);
  }

  const pushTokens = ((tokens ?? []) as PushTokenRow[]).filter((row) =>
    row.expo_push_token.startsWith('ExponentPushToken[') || row.expo_push_token.startsWith('ExpoPushToken[')
  );

  if (pushTokens.length === 0) {
    return jsonResponse({ ok: true, sent: 0 });
  }

  let sent = 0;
  for (const chunk of chunkArray(pushTokens, 100)) {
    const messages = chunk.map((row) => ({
      to: row.expo_push_token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {}
    }));

    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messages)
    });

    const result = await expoResponse.json().catch(() => ({}));
    if (!expoResponse.ok) {
      return jsonResponse({ error: 'Expo Push API request failed.', details: result }, 502);
    }

    const receipts = Array.isArray(result.data) ? result.data : [result.data];
    await Promise.all(
      receipts.map((receipt, index) => {
        if (receipt?.details?.error !== 'DeviceNotRegistered') return Promise.resolve();
        return supabase.from('push_tokens').delete().eq('id', chunk[index].id).then(() => undefined);
      })
    );

    sent += chunk.length;
  }

  return jsonResponse({ ok: true, sent });
});

async function canSendNotification({
  supabase,
  callerId,
  targetUserId,
  data
}: {
  supabase: ReturnType<typeof createClient>;
  callerId: string;
  targetUserId: string;
  data: Record<string, unknown>;
}) {
  if (callerId === targetUserId) return true;

  const callerRole = await getUserRole(supabase, callerId);
  const callerIsAdmin = callerRole === 'admin' || callerRole === 'super_admin';
  if (callerIsAdmin) return true;

  const bookingId = typeof data.booking_id === 'string' ? data.booking_id : null;
  const type = typeof data.type === 'string' ? data.type : null;
  if (!bookingId || type !== 'new_booking_request') return false;

  const { data: booking } = await supabase
    .from('bookings')
    .select('user_id')
    .eq('id', bookingId)
    .maybeSingle();

  if (booking?.user_id !== callerId) return false;

  const targetRole = await getUserRole(supabase, targetUserId);
  return targetRole === 'admin' || targetRole === 'super_admin';
}

async function getUserRole(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  return data?.role ?? null;
}

async function checkRateLimit({
  supabase,
  key,
  maxRequests,
  windowSeconds
}: {
  supabase: ReturnType<typeof createClient>;
  key: string;
  maxRequests: number;
  windowSeconds: number;
}) {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    rate_key: key,
    max_requests: maxRequests,
    window_seconds: windowSeconds
  });

  if (error) {
    throw error;
  }

  return !data;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}
