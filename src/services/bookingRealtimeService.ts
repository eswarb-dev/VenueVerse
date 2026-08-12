import { supabase } from '@/lib/supabase';

type BookingRealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export function subscribeToBookingChanges({
  channelName,
  onChange,
  onStatus
}: {
  channelName: string;
  onChange: (event: BookingRealtimeEvent, bookingId: string | null) => void;
  onStatus?: (status: string) => void;
}) {
  return supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookings'
      },
      (payload) => {
        const row = (payload.new && Object.keys(payload.new).length > 0 ? payload.new : payload.old) as { id?: string } | null;
        const bookingId = typeof row?.id === 'string' ? row.id : null;
        if (__DEV__) console.log('[realtime] booking change received', payload.eventType, bookingId);
        onChange(payload.eventType as BookingRealtimeEvent, bookingId);
      }
    )
    .subscribe((status) => {
      if (__DEV__) console.log('[realtime] bookings status', status);
      onStatus?.(status);
    });
}

export function debounceRealtimeRefresh(callback: () => void, delayMs = 500) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return {
    schedule() {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        timeout = null;
        callback();
      }, delayMs);
    },
    cancel() {
      if (!timeout) return;
      clearTimeout(timeout);
      timeout = null;
    }
  };
}
