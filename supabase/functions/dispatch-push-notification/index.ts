import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type NotificationRecord = {
  id: string;
  user_id: string;
  title: string;
  message?: string;
  body?: string;
  type?: string | null;
  data?: Record<string, unknown> | null;
  booking_id: string | null;
};

type WebhookPayload = {
  type: string;
  table: string;
  schema: string;
  record?: NotificationRecord;
};

type PushTokenRow = {
  id: string;
  expo_push_token: string;
};

type ExpoTicket = {
  status?: string;
  id?: string;
  details?: {
    error?: string;
  };
  message?: string;
};

type ExpoReceipt = {
  status?: string;
  details?: {
    error?: string;
  };
  message?: string;
};

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
    console.log('[push] webhook received', {
      notificationId: notification.id,
      targetUserId: notification.user_id
    });

    const notificationBody = notification.message ?? notification.body ?? '';
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
      .from('device_push_tokens')
      .select('id, expo_push_token')
      .eq('user_id', notification.user_id)
      .eq('is_active', true);

    if (tokenError) throw tokenError;

    const pushTokens = ((tokenRows ?? []) as PushTokenRow[]).filter((row) => isValidExpoPushToken(row.expo_push_token));
    if (pushTokens.length === 0) {
      return jsonResponse({ success: true, sent: 0, reason: 'no_active_tokens' });
    }

    const messageType =
      notification.type ??
      getStringData(notification.data, 'type') ??
      inferNotificationType(notification.title);
    const bookingId =
      notification.booking_id ??
      getStringData(notification.data, 'booking_id');

    const messages = pushTokens.map((row) => ({
      to: row.expo_push_token,
      title: notification.title,
      body: notificationBody,
      sound: 'default',
      priority: 'high',
      channelId: 'default',
      data: {
        notification_id: notification.id,
        type: messageType,
        ...(bookingId ? { booking_id: bookingId } : {})
      }
    }));

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json'
    };

    const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
    if (expoAccessToken) {
      headers.Authorization = `Bearer ${expoAccessToken}`;
    }

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers,
      body: JSON.stringify(messages)
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Expo push request failed: ${JSON.stringify(result)}`);
    }

    const tickets = (Array.isArray(result.data) ? result.data : [result.data]) as ExpoTicket[];
    await disableUnregisteredTicketTokens(admin, tickets, pushTokens);

    checkExpoReceipts({
      tickets,
      tokenRows: pushTokens,
      headers,
      admin
    }).then((receiptSummary) => {
      console.log('[push] receipts', {
        notificationId: notification.id,
        receiptStatuses: receiptSummary
      });
    }).catch((receiptError) => {
      console.error('[push] receipt check failed', {
        notificationId: notification.id,
        message: receiptError instanceof Error ? receiptError.message : 'Receipt check failed.'
      });
    });

    const ticketStatuses = summarizeTicketStatuses(tickets);
    console.log('[push]', {
      notificationId: notification.id,
      targetUserId: notification.user_id,
      activeTokenCount: pushTokens.length,
      ticketStatuses
    });

    return jsonResponse({
      success: true,
      sent: pushTokens.length,
      token_count: pushTokens.length,
      ticket_statuses: ticketStatuses
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Push dispatch failed.';
    console.error('[push] dispatch failed', { message });
    return jsonResponse({ error: message }, 500);
  }
});

function isValidExpoPushToken(token: string) {
  return token.startsWith('ExpoPushToken[') || token.startsWith('ExponentPushToken[');
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

function getStringData(data: Record<string, unknown> | null | undefined, key: string) {
  const value = data?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function summarizeTicketStatuses(tickets: ExpoTicket[]) {
  return tickets.reduce<Record<string, number>>((summary, ticket) => {
    const status = ticket?.details?.error ?? ticket?.status ?? 'unknown';
    summary[status] = (summary[status] ?? 0) + 1;
    return summary;
  }, {});
}

async function disableUnregisteredTicketTokens(
  admin: ReturnType<typeof createClient>,
  tickets: ExpoTicket[],
  tokenRows: PushTokenRow[]
) {
  await Promise.all(
    tickets.map((ticket, index) => {
      if (ticket?.details?.error !== 'DeviceNotRegistered') return Promise.resolve();
      return admin
        .from('device_push_tokens')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', tokenRows[index].id)
        .then(() => undefined);
    })
  );
}

async function checkExpoReceipts(params: {
  tickets: ExpoTicket[];
  tokenRows: PushTokenRow[];
  headers: Record<string, string>;
  admin: ReturnType<typeof createClient>;
}) {
  const receiptIds = params.tickets
    .map((ticket) => ticket?.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  if (receiptIds.length === 0) return {};

  await new Promise((resolve) => setTimeout(resolve, 1200));

  const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
    method: 'POST',
    headers: params.headers,
    body: JSON.stringify({ ids: receiptIds })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.data || typeof result.data !== 'object') {
    return { unavailable: 1 };
  }

  const summary: Record<string, number> = {};
  await Promise.all(
    params.tickets.map((ticket, index) => {
      if (!ticket.id) return Promise.resolve();
      const receipt = (result.data as Record<string, ExpoReceipt>)[ticket.id];
      const status = receipt?.details?.error ?? receipt?.status ?? 'unknown';
      summary[status] = (summary[status] ?? 0) + 1;

      if (receipt?.details?.error !== 'DeviceNotRegistered') return Promise.resolve();
      return params.admin
        .from('device_push_tokens')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', params.tokenRows[index].id)
        .then(() => undefined);
    })
  );

  return summary;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
