import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  clearFirebaseAccessTokenCache,
  getFirebaseAccessToken,
  getFirebaseProjectId
} from '../_shared/firebase-auth.ts';

type NotificationRecord = {
  id: string;
  user_id: string;
  title: string;
  message?: string;
  body?: string;
  type?: string | null;
  data?: Record<string, unknown> | null;
  booking_id?: string | null;
};

type WebhookPayload = {
  type: string;
  table: string;
  schema: string;
  record?: NotificationRecord;
};

type FcmTokenRow = {
  id: string;
  fcm_token: string;
};

type DeliveryStatus = 'pending' | 'sent' | 'retryable_error' | 'permanent_error' | 'skipped';

const MAX_ATTEMPTS = 3;
const CONCURRENCY = 5;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  try {
    const expectedSecret = Deno.env.get('PUSH_WEBHOOK_SECRET');
    const suppliedSecret = req.headers.get('x-push-webhook-secret');
    if (!expectedSecret || suppliedSecret !== expectedSecret) {
      return jsonResponse({ error: 'Unauthorized webhook.' }, 401);
    }

    const payload = (await req.json()) as WebhookPayload;
    if (payload.type !== 'INSERT' || payload.schema !== 'public' || payload.table !== 'notifications' || !payload.record) {
      return jsonResponse({ success: true, skipped: true });
    }

    const notification = payload.record;
    const notificationBody = notification.message ?? notification.body ?? '';
    if (!notification.user_id || !notification.title || !notificationBody) {
      return jsonResponse({ error: 'Invalid notification payload.' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Supabase environment variables are missing.' }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false
      }
    });

    const { data: tokenRows, error: tokenError } = await admin
      .from('device_fcm_tokens')
      .select('id, fcm_token')
      .eq('user_id', notification.user_id)
      .eq('is_active', true);

    if (tokenError) throw tokenError;

    const activeTokens = ((tokenRows ?? []) as FcmTokenRow[]).filter((row) => row.fcm_token.trim().length > 0);
    if (activeTokens.length === 0) {
      return jsonResponse({
        success: true,
        notification_id: notification.id,
        target_user_id: notification.user_id,
        active_token_count: 0,
        sent: 0,
        failed: 0,
        reason: 'no_active_tokens'
      });
    }

    const accessToken = await getFirebaseAccessToken();
    const batches = chunk(activeTokens, CONCURRENCY);
    const allResults: SendResult[] = [];

    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map((tokenRow) =>
          sendWithDeliveryAttempt({
            admin,
            notification,
            notificationBody,
            tokenRow,
            accessToken
          })
        )
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allResults.push(result.value);
          return;
        }

        allResults.push({
          tokenId: batch[index].id,
          status: 'retryable_error',
          errorCode: 'UNHANDLED_EXCEPTION',
          deactivated: false
        });
      });
    }

    const sent = allResults.filter((result) => result.status === 'sent').length;
    const deactivated = allResults.filter((result) => result.deactivated).length;
    const failed = allResults.length - sent;

    console.log('[fcm-dispatch]', {
      notificationId: notification.id,
      targetUserId: notification.user_id,
      activeTokenCount: activeTokens.length,
      sent,
      failed,
      deactivated,
      statusSummary: summarizeStatuses(allResults)
    });

    return jsonResponse({
      success: true,
      notification_id: notification.id,
      target_user_id: notification.user_id,
      active_token_count: activeTokens.length,
      sent,
      failed,
      deactivated
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'FCM dispatch failed.';
    console.error('[fcm-dispatch] failed', { message });
    return jsonResponse({ error: message }, 500);
  }
});

type SendResult = {
  tokenId: string;
  status: DeliveryStatus;
  providerMessageId?: string | null;
  errorCode?: string | null;
  deactivated: boolean;
};

async function sendWithDeliveryAttempt(params: {
  admin: ReturnType<typeof createClient>;
  notification: NotificationRecord;
  notificationBody: string;
  tokenRow: FcmTokenRow;
  accessToken: string;
}): Promise<SendResult> {
  const attempt = await claimDeliveryAttempt(params.admin, params.notification.id, params.tokenRow.id);
  if (attempt.status === 'sent') {
    return { tokenId: params.tokenRow.id, status: 'skipped', deactivated: false };
  }

  let lastResult: FcmSendResponse | null = null;

  for (let attemptNumber = attempt.attemptCount + 1; attemptNumber <= MAX_ATTEMPTS; attemptNumber++) {
    const accessToken = attemptNumber === attempt.attemptCount + 1 ? params.accessToken : await getFirebaseAccessToken();
    lastResult = await sendFcmMessage({
      notification: params.notification,
      notificationBody: params.notificationBody,
      fcmToken: params.tokenRow.fcm_token,
      accessToken
    });

    if (lastResult.status === 'sent') {
      await updateDeliveryAttempt(params.admin, {
        notificationId: params.notification.id,
        tokenId: params.tokenRow.id,
        status: 'sent',
        providerMessageId: lastResult.providerMessageId,
        errorCode: null,
        errorMessage: null,
        attemptCount: attemptNumber
      });

      return {
        tokenId: params.tokenRow.id,
        status: 'sent',
        providerMessageId: lastResult.providerMessageId,
        deactivated: false
      };
    }

    if (lastResult.errorCode === 'UNAUTHENTICATED' && attemptNumber === attempt.attemptCount + 1) {
      clearFirebaseAccessTokenCache();
      continue;
    }

    if (!lastResult.retryable) break;
    await sleep(200 * attemptNumber);
  }

  const errorCode = lastResult?.errorCode ?? 'UNKNOWN';
  const permanent = isPermanentError(errorCode);
  const status: DeliveryStatus = permanent ? 'permanent_error' : 'retryable_error';
  const deactivated = errorCode === 'UNREGISTERED';

  if (deactivated) {
    await params.admin
      .from('device_fcm_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', params.tokenRow.id);
  }

  await updateDeliveryAttempt(params.admin, {
    notificationId: params.notification.id,
    tokenId: params.tokenRow.id,
    status,
    providerMessageId: null,
    errorCode,
    errorMessage: sanitizeErrorMessage(lastResult?.errorMessage),
    attemptCount: Math.max(attempt.attemptCount + 1, MAX_ATTEMPTS)
  });

  return {
    tokenId: params.tokenRow.id,
    status,
    errorCode,
    deactivated
  };
}

async function claimDeliveryAttempt(
  admin: ReturnType<typeof createClient>,
  notificationId: string,
  tokenId: string
) {
  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await admin
    .from('push_delivery_attempts')
    .select('status, attempt_count')
    .eq('notification_id', notificationId)
    .eq('token_id', tokenId)
    .eq('provider', 'fcm')
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) {
    return {
      status: existing.status as DeliveryStatus,
      attemptCount: Number(existing.attempt_count ?? 0)
    };
  }

  const { data, error } = await admin
    .from('push_delivery_attempts')
    .insert({
      notification_id: notificationId,
      token_id: tokenId,
      provider: 'fcm',
      status: 'pending',
      updated_at: now
    })
    .select('status, attempt_count')
    .single();

  if (error) throw error;

  return {
    status: data.status as DeliveryStatus,
    attemptCount: Number(data.attempt_count ?? 0)
  };
}

async function updateDeliveryAttempt(
  admin: ReturnType<typeof createClient>,
  params: {
    notificationId: string;
    tokenId: string;
    status: DeliveryStatus;
    providerMessageId: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    attemptCount: number;
  }
) {
  const { error } = await admin
    .from('push_delivery_attempts')
    .update({
      status: params.status,
      provider_message_id: params.providerMessageId,
      error_code: params.errorCode,
      error_message: params.errorMessage,
      attempt_count: params.attemptCount,
      updated_at: new Date().toISOString()
    })
    .eq('notification_id', params.notificationId)
    .eq('token_id', params.tokenId)
    .eq('provider', 'fcm');

  if (error) throw error;
}

type FcmSendResponse = {
  status: 'sent' | 'error';
  providerMessageId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  retryable?: boolean;
};

async function sendFcmMessage(params: {
  notification: NotificationRecord;
  notificationBody: string;
  fcmToken: string;
  accessToken: string;
}): Promise<FcmSendResponse> {
  const projectId = getFirebaseProjectId();
  const fcmType =
    params.notification.type ??
    getStringData(params.notification.data, 'type') ??
    inferNotificationType(params.notification.title);
  const fcmBookingId =
    params.notification.booking_id ??
    getStringData(params.notification.data, 'booking_id');

  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: {
        token: params.fcmToken,
        notification: {
          title: params.notification.title,
          body: params.notificationBody
        },
        data: {
          ...stringifyData(params.notification.data ?? {}),
          notification_id: params.notification.id,
          type: fcmType,
          ...(fcmBookingId ? { booking_id: fcmBookingId } : {})
        },
        android: {
          priority: 'HIGH',
          notification: {
            channel_id: 'default',
            sound: 'default',
            notification_priority: 'PRIORITY_HIGH',
            default_vibrate_timings: true
          }
        }
      }
    })
  });

  const result = await response.json().catch(() => ({}));
  if (response.ok && typeof result.name === 'string') {
    return {
      status: 'sent',
      providerMessageId: result.name
    };
  }

  const errorCode = getFirebaseErrorCode(result, response.status);
  return {
    status: 'error',
    errorCode,
    errorMessage: getFirebaseErrorMessage(result),
    retryable: isRetryableError(errorCode)
  };
}

function stringifyData(data: Record<string, unknown>) {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!/^[A-Za-z0-9_.-]+$/.test(key)) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === 'string') output[key] = value;
    else if (typeof value === 'number' || typeof value === 'boolean') output[key] = String(value);
  }
  return output;
}

function getStringData(data: Record<string, unknown> | null | undefined, key: string) {
  const value = data?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function getFirebaseErrorCode(result: unknown, httpStatus: number) {
  const error = typeof result === 'object' && result !== null && 'error' in result
    ? (result as { error?: { status?: string; details?: unknown[] } }).error
    : null;

  const detailCode = error?.details
    ?.map((detail) => {
      if (typeof detail !== 'object' || detail === null) return null;
      const maybeErrorCode = detail as { errorCode?: string };
      return typeof maybeErrorCode.errorCode === 'string' ? maybeErrorCode.errorCode : null;
    })
    .find(Boolean);

  return detailCode ?? error?.status ?? `HTTP_${httpStatus}`;
}

function getFirebaseErrorMessage(result: unknown) {
  const error = typeof result === 'object' && result !== null && 'error' in result
    ? (result as { error?: { message?: string } }).error
    : null;
  return sanitizeErrorMessage(error?.message);
}

function isPermanentError(errorCode: string) {
  return ['UNREGISTERED', 'SENDER_ID_MISMATCH', 'PERMISSION_DENIED', 'INVALID_ARGUMENT'].includes(errorCode);
}

function isRetryableError(errorCode: string) {
  return ['UNAUTHENTICATED', 'QUOTA_EXCEEDED', 'UNAVAILABLE', 'INTERNAL'].includes(errorCode) || errorCode.startsWith('HTTP_5');
}

function sanitizeErrorMessage(message: unknown) {
  if (typeof message !== 'string') return null;
  return message.replace(/[A-Za-z0-9_-]{80,}/g, '[redacted]').slice(0, 240);
}

function inferNotificationType(title: string) {
  const normalized = title.toLowerCase();
  if (normalized.includes('approved')) return 'booking_approved';
  if (normalized.includes('rejected')) return 'booking_rejected';
  if (normalized.includes('receipt')) return 'receipt_email_sent';
  if (normalized.includes('cancelled')) return 'booking_cancelled';
  if (normalized.includes('booking')) return 'booking_request';
  return 'app_notification';
}

function summarizeStatuses(results: SendResult[]) {
  return results.reduce<Record<string, number>>((summary, result) => {
    const key = result.errorCode ?? result.status;
    summary[key] = (summary[key] ?? 0) + 1;
    return summary;
  }, {});
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
