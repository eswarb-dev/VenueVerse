import { supabase } from '@/lib/supabase';
import { AppNotification } from '@/types/notification';

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean | null;
  booking_id: string | null;
  created_at: string;
};

type NotificationBookingDetailsRow = {
  id: string;
  event_title: string;
  halls: { name: string } | { name: string }[] | null;
};

export type NotificationBookingDetails = {
  bookedHall: string;
  sessionName: string;
};

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
  return count ?? 0;
}

export async function getUserNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, title, message, is_read, booking_id, created_at')
    .eq('user_id', userId)
    .order('is_read', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapNotification);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
}

export async function createNotification(params: {
  userId: string;
  title: string;
  message: string;
  bookingId?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    user_id: params.userId,
    title: params.title,
    message: params.message,
    booking_id: params.bookingId ?? null,
    is_read: false
  });

  if (error) throw error;
}

export async function getNotificationBookingDetails(bookingId: string): Promise<NotificationBookingDetails | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, event_title, halls(name)')
    .eq('id', bookingId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as NotificationBookingDetailsRow;
  const hall = Array.isArray(row.halls) ? row.halls[0] : row.halls;

  return {
    bookedHall: hall?.name ?? 'Venue unavailable',
    sessionName: row.event_title
  };
}

export function subscribeToNotifications(userId: string, onInsert: () => void) {
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
      () => onInsert()
    )
    .subscribe();
}

function mapNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    message: row.message,
    isRead: row.is_read ?? false,
    bookingId: row.booking_id,
    createdAt: row.created_at
  };
}
