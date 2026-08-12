import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type RegisterPushTokenPayload = {
  expo_push_token?: string;
  platform?: string;
  app_variant?: string;
  application_id?: string | null;
  device_name?: string | null;
  is_active?: boolean;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('VENUEVERSE_ALLOWED_WEB_ORIGIN') ?? '',
  Vary: 'Origin',
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

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      return jsonResponse({ error: 'Missing authorization.' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({ error: 'Supabase environment variables are missing.' }, 500);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: { Authorization: authorization }
      },
      auth: {
        persistSession: false
      }
    });

    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ error: 'Unauthorized.' }, 401);
    }

    const payload = (await req.json().catch(() => ({}))) as RegisterPushTokenPayload;
    const expoPushToken = String(payload.expo_push_token ?? '').trim();
    if (!isValidExpoPushToken(expoPushToken)) {
      return jsonResponse({ error: 'Invalid Expo push token.' }, 400);
    }

    const platform = payload.platform === 'ios' ? 'ios' : 'android';
    const appVariant = sanitizeText(payload.app_variant) || 'release';
    const now = new Date().toISOString();

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false
      }
    });

    const { error } = await admin.from('device_push_tokens').upsert(
      {
        user_id: userData.user.id,
        expo_push_token: expoPushToken,
        platform,
        app_variant: appVariant,
        application_id: sanitizeText(payload.application_id),
        device_name: sanitizeText(payload.device_name),
        is_active: payload.is_active !== false,
        updated_at: now,
        last_registered_at: now
      },
      { onConflict: 'expo_push_token' }
    );

    if (error) throw error;

    console.log('[push-register] token upserted', {
      userId: userData.user.id,
      platform,
      appVariant,
      applicationId: sanitizeText(payload.application_id) ?? 'unknown'
    });

    return jsonResponse({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Push registration failed.';
    console.error('[push-register] failed', { message });
    return jsonResponse({ error: message }, 500);
  }
});

function isValidExpoPushToken(token: string) {
  return token.startsWith('ExpoPushToken[') || token.startsWith('ExponentPushToken[');
}

function sanitizeText(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 160) : null;
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
