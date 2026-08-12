import { supabase } from '@/lib/supabase';
import { clearCachedValue, measureAsync, withCache } from '@/utils/performanceCache';
import { AppNotification } from '@/types/notification';

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean | null;
  booking_id: string | null;
  created_at: string;
};

type NotificationBookingDetailsRow = {
  id: string;
  event_title: string;
  start_time: string;
  end_time: string;
  profiles: { full_name: string | null; department: string | null } | { full_name: string | null; department: string | null }[] | null;
  halls: { name: string; department: string | null } | { name: string; department: string | null }[] | null;
};

export type NotificationBookingDetails = {
  bookedHall: string;
  venueDepartment: string | null;
  requesterName: string | null;
  requesterDepartment: string | null;
  sessionName: string;
  startTime: string;
  endTime: string;
};

const NOTIFICATION_CACHE_TTL_MS = 20_000;

export async function getUnreadNotificationCount(userId: string, options?: { forceRefresh?: boolean }): Promise<number> {
  return withCache(
    `notifications:unread:${userId}`,
    NOTIFICATION_CACHE_TTL_MS,
    () => measureAsync('notificationService.getUnreadNotificationCount', () => loadUnreadNotificationCount(userId)),
    options?.forceRefresh
  );
}

async function loadUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
  return count ?? 0;
}

export async function getUserNotifications(userId: string, options?: { forceRefresh?: boolean }): Promise<AppNotification[]> {
  return withCache(
    `notifications:list:${userId}`,
    NOTIFICATION_CACHE_TTL_MS,
    () => measureAsync('notificationService.getUserNotifications', () => loadUserNotifications(userId)),
    options?.forceRefresh
  );
}

async function loadUserNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, title, message, type, data, is_read, booking_id, created_at')
    .eq('user_id', userId)
    .order('is_read', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapNotification);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
  if (error) throw error;
  clearCachedValue('notifications:');
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
  clearCachedValue('notifications:');
}

export async function createNotification(params: {
  userId: string;
  title: string;
  message: string;
  bookingId?: string | null;
  type?: string | null;
  data?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    user_id: params.userId,
    title: params.title,
    message: params.message,
    booking_id: params.bookingId ?? null,
    type: params.type ?? null,
    data: sanitizeNotificationData({
      ...(params.data ?? {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.bookingId ? { booking_id: params.bookingId } : {})
    }),
    is_read: false
  });

  if (error) throw error;
  clearCachedValue('notifications:');
}

export async function getNotificationBookingDetails(bookingId: string): Promise<NotificationBookingDetails | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, event_title, start_time, end_time, profiles:user_id(full_name, department), halls(name, department)')
    .eq('id', bookingId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as NotificationBookingDetailsRow;
  const hall = Array.isArray(row.halls) ? row.halls[0] : row.halls;
  const requester = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

  return {
    bookedHall: hall?.name ?? 'Venue unavailable',
    venueDepartment: hall?.department ?? null,
    requesterName: requester?.full_name ?? null,
    requesterDepartment: requester?.department ?? null,
    sessionName: row.event_title,
    startTime: row.start_time,
    endTime: row.end_time
  };
}

export function subscribeToNotifications(
  userId: string,
  handlers: {
    onInsert: (notification: AppNotification) => void;
    onUpdate: (notification: AppNotification) => void;
    onStatus?: (status: string) => void;
  }
) {
  return supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => handlers.onInsert(mapNotification(payload.new as NotificationRow))
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => handlers.onUpdate(mapNotification(payload.new as NotificationRow))
    )
    .subscribe((status) => handlers.onStatus?.(status));
}

function mapNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    message: row.message,
    type: row.type,
    data: row.data ?? {},
    isRead: row.is_read ?? false,
    bookingId: row.booking_id,
    createdAt: row.created_at
  };
}

function sanitizeNotificationData(data: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) =>
      value === null ||
      ['string', 'number', 'boolean'].includes(typeof value)
    )
  );
}
