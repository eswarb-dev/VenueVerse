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
  app_variant: string | null;
  application_id: string | null;
};

type ExpoTicket = {
  status?: string;
  id?: string;
  message?: string;
  details?: {
    error?: string;
  };
};

type ExpoReceipt = {
  status?: string;
  message?: string;
  details?: {
    error?: string;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('VENUEVERSE_ALLOWED_WEB_ORIGIN') ?? '',
  'Vary': 'Origin',
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
    .select('id, expo_push_token, app_variant, application_id')
    .eq('user_id', payload.user_id)
    .eq('is_active', true);

  if (tokensError) {
    return jsonResponse({ error: tokensError.message }, 500);
  }

  const pushTokens = ((tokens ?? []) as PushTokenRow[]).filter((row) =>
    row.expo_push_token.startsWith('ExponentPushToken[') || row.expo_push_token.startsWith('ExpoPushToken[')
  );
  const tokenSummary = summarizeTokens(pushTokens);
  console.log('[push-send] target token count', pushTokens.length, tokenSummary);

  if (pushTokens.length === 0) {
    return jsonResponse({ ok: true, sent: 0, tokenSummary });
  }

  let sent = 0;
  const ticketIds: string[] = [];
  const ticketTokenIds = new Map<string, string>();
  const invalidTokenIds = new Set<string>();

  for (const chunk of chunkArray(pushTokens, 100)) {
    const messages = chunk.map((row) => ({
      to: row.expo_push_token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      priority: 'high',
      channelId: 'default',
      data: {
        ...(payload.data ?? {}),
        type: typeof payload.data?.type === 'string' ? payload.data.type : 'app_notification'
      }
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

    const tickets = (Array.isArray(result.data) ? result.data : [result.data]) as ExpoTicket[];
    console.log('[push] Expo ticket received', tickets.length);
    console.log('[push-send] ticket status', summarizeTicketStatuses(tickets));

    tickets.forEach((ticket, index) => {
      if (ticket?.id) {
        ticketIds.push(ticket.id);
        ticketTokenIds.set(ticket.id, chunk[index].id);
      }
      if (ticket?.details?.error === 'DeviceNotRegistered') {
        invalidTokenIds.add(chunk[index].id);
      }
    });

    sent += chunk.length;
  }

  const receiptSummary = await checkExpoReceipts(ticketIds);
  console.log('[push] Expo receipt checked', receiptSummary.checked);
  console.log('[push-send] receipt status', receiptSummary.statuses);

  for (const ticketId of receiptSummary.invalidTicketIds) {
    const tokenId = ticketTokenIds.get(ticketId);
    if (tokenId) invalidTokenIds.add(tokenId);
  }

  await deactivateInvalidTokens(supabase, [...invalidTokenIds]);

  return jsonResponse({
    ok: true,
    sent,
    tickets: ticketIds.length,
    receiptsChecked: receiptSummary.checked,
    disabledTokens: invalidTokenIds.size,
    tokenSummary,
    receiptStatuses: receiptSummary.statuses
  });
});

async function checkExpoReceipts(ticketIds: string[]) {
  const invalidTicketIds: string[] = [];
  const statuses: Record<string, number> = {};
  let checked = 0;

  for (const chunk of chunkArray(ticketIds, 300)) {
    if (chunk.length === 0) continue;

    await new Promise((resolve) => setTimeout(resolve, 1200));
    const expoResponse = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids: chunk })
    });

    const result = await expoResponse.json().catch(() => ({}));
    if (!expoResponse.ok || !result.data) continue;

    chunk.forEach((ticketId) => {
      const receipt = result.data[ticketId] as ExpoReceipt | undefined;
      if (!receipt) return;
      checked += 1;
      const status = receipt.status ?? receipt.details?.error ?? 'unknown';
      statuses[status] = (statuses[status] ?? 0) + 1;
      if (receipt.details?.error === 'DeviceNotRegistered') {
        invalidTicketIds.push(ticketId);
      }
    });
  }

  return { checked, invalidTicketIds, statuses };
}

function summarizeTicketStatuses(tickets: ExpoTicket[]) {
  return tickets.reduce<Record<string, number>>((summary, ticket) => {
    const status = ticket.status ?? ticket.details?.error ?? 'unknown';
    summary[status] = (summary[status] ?? 0) + 1;
    return summary;
  }, {});
}

function summarizeTokens(tokens: PushTokenRow[]) {
  return tokens.reduce<Record<string, number>>((summary, token) => {
    const variant = token.app_variant ?? 'unknown';
    const applicationId = token.application_id ?? 'unknown';
    const key = `${variant}:${applicationId}`;
    summary[key] = (summary[key] ?? 0) + 1;
    return summary;
  }, {});
}

async function deactivateInvalidTokens(supabase: ReturnType<typeof createClient>, tokenIds: string[]) {
  if (tokenIds.length === 0) return;

  await Promise.all(
    tokenIds.map((tokenId) =>
      supabase
        .from('push_tokens')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', tokenId)
        .then(() => undefined)
    )
  );
}

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

  const callerProfile = await getUserProfile(supabase, callerId);

  const bookingId = typeof data.booking_id === 'string' ? data.booking_id : null;
  const type = typeof data.type === 'string' ? data.type : null;
  if (!bookingId) return false;

  const { data: booking } = await supabase
    .from('bookings')
    .select('user_id, halls(department)')
    .eq('id', bookingId)
    .maybeSingle();

  const hall = Array.isArray(booking?.halls) ? booking.halls[0] : booking?.halls;
  const hallDepartment = hall?.department;

  if (callerProfile?.role === 'admin') {
    if (callerProfile.department !== hallDepartment) return false;
    if (['booking_approved', 'booking_rejected'].includes(type ?? '')) {
      return booking?.user_id === targetUserId;
    }

    if (['new_booking_request', 'booking_request'].includes(type ?? '')) {
      const targetProfile = await getUserProfile(supabase, targetUserId);
      return targetProfile?.role === 'admin' && targetProfile.department === hallDepartment;
    }

    return false;
  }

  if (callerProfile?.role === 'super_admin') {
    return false;
  }

  if (booking?.user_id !== callerId) return false;
  if (!['new_booking_request', 'booking_request'].includes(type ?? '')) return false;
  if (!hallDepartment) return false;

  const targetProfile = await getUserProfile(supabase, targetUserId);
  return targetProfile?.role === 'admin' && targetProfile.department === hallDepartment;
}

async function getUserProfile(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data } = await supabase.from('profiles').select('role, department').eq('id', userId).maybeSingle();
  return data ?? null;
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
