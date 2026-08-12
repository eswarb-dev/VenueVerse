import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type RegisterFcmTokenPayload = {
  fcm_token?: string;
  installation_id?: string;
  device_id?: string | null;
  platform?: string;
  app_variant?: string;
  application_id?: string | null;
  app_version?: string | null;
  is_active?: boolean;
  user_id?: string;
  email?: string;
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

    const payload = (await req.json().catch(() => ({}))) as RegisterFcmTokenPayload;
    if (payload.user_id || payload.email) {
      return jsonResponse({ error: 'Token registration uses authenticated session only. Do not send email or user_id.' }, 400);
    }

    const fcmToken = sanitizeToken(payload.fcm_token);
    const installationId = sanitizeInstallationId(payload.installation_id);
    const platform = payload.platform === 'ios' ? 'ios' : 'android';
    const appVariant = sanitizeEnum(payload.app_variant, ['development', 'preview', 'production']) ?? 'production';
    const isActive = payload.is_active !== false;

    if (!installationId) {
      return jsonResponse({ error: 'Invalid installation id.' }, 400);
    }

    if (platform !== 'android') {
      return jsonResponse({ error: 'Only Android FCM registration is supported.' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false
      }
    });

    const now = new Date().toISOString();

    if (!isActive) {
      const { data, error } = await admin
        .from('device_fcm_tokens')
        .update({ is_active: false, updated_at: now })
        .eq('user_id', userData.user.id)
        .eq('installation_id', installationId)
        .select('id, platform, is_active')
        .maybeSingle();

      if (error) throw error;

      return jsonResponse({
        success: true,
        registration_id: data?.id ?? null,
        platform,
        is_active: false
      });
    }

    if (!fcmToken) {
      return jsonResponse({ error: 'Invalid FCM token.' }, 400);
    }

    await admin
      .from('device_fcm_tokens')
      .update({ is_active: false, updated_at: now })
      .eq('installation_id', installationId)
      .neq('user_id', userData.user.id);

    await admin
      .from('device_fcm_tokens')
      .update({ is_active: false, updated_at: now })
      .eq('fcm_token', fcmToken)
      .neq('user_id', userData.user.id);

    const { data: existingByInstallation, error: existingError } = await admin
      .from('device_fcm_tokens')
      .select('id')
      .eq('user_id', userData.user.id)
      .eq('installation_id', installationId)
      .maybeSingle();

    if (existingError) throw existingError;

    const row = {
      user_id: userData.user.id,
      installation_id: installationId,
      fcm_token: fcmToken,
      platform,
      device_id: sanitizeText(payload.device_id, 120),
      app_variant: appVariant,
      application_id: sanitizeText(payload.application_id, 120),
      app_version: sanitizeText(payload.app_version, 80),
      is_active: isActive,
      updated_at: now,
      last_registered_at: now
    };

    const result = existingByInstallation?.id
      ? await admin.from('device_fcm_tokens').update(row).eq('id', existingByInstallation.id).select('id, platform, is_active').single()
      : await admin.from('device_fcm_tokens').insert(row).select('id, platform, is_active').single();

    if (result.error) throw result.error;

    console.log('[fcm-register] token registered', {
      userId: userData.user.id,
      registrationId: result.data.id,
      platform,
      appVariant
    });

    return jsonResponse({
      success: true,
      registration_id: result.data.id,
      platform: result.data.platform,
      is_active: result.data.is_active
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'FCM registration failed.';
    console.error('[fcm-register] failed', { message });
    return jsonResponse({ error: message }, 500);
  }
});

function sanitizeToken(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length < 20 || trimmed.length > 4096) return null;
  if (trimmed.startsWith('ExpoPushToken[') || trimmed.startsWith('ExponentPushToken[')) return null;
  return trimmed;
}

function sanitizeInstallationId(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(trimmed)) return null;
  return trimmed;
}

function sanitizeEnum(value: unknown, allowed: string[]) {
  if (typeof value !== 'string') return null;
  return allowed.includes(value) ? value : null;
}

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
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
