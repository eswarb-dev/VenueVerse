import { supabase } from '@/lib/supabase';
import { sendPushNotification } from '@/lib/notifications';
import { createNotification } from '@/services/notificationService';
import {
  AvailabilitySlot,
  BookingAvailability,
  BookingDetails,
  BookingPreview,
  BookingStats,
  BookingStatus,
  CreateBookingInput,
  TodayBookedHall
} from '@/types/venue';

type BookingRow = {
  id: string;
  event_title: string;
  status: BookingStatus;
  start_time: string;
  end_time: string;
  created_at?: string;
  halls:
    | {
        name: string;
        department?: string | null;
        venue_type?: string | null;
        location?: string | null;
      }
    | {
        name: string;
        department?: string | null;
        venue_type?: string | null;
        location?: string | null;
      }[]
    | null;
};

type BookingDetailsRow = {
  id: string;
  hall_id: string | null;
  event_title: string;
  event_type: string | null;
  department: string | null;
  faculty_coordinator: string | null;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  admin_remarks: string | null;
  created_at: string | null;
  updated_at: string | null;
  halls:
    | {
        name: string;
        block: string | null;
        floor: string | null;
        capacity: number;
        facilities: string[] | null;
        image_url: string | null;
      }
    | {
        name: string;
        block: string | null;
        floor: string | null;
        capacity: number;
        facilities: string[] | null;
        image_url: string | null;
      }[]
    | null;
  approver:
    | {
        full_name: string;
        email: string;
      }
    | {
        full_name: string;
        email: string;
      }[]
    | null;
};

type AvailabilityRow = {
  id: string;
  hall_id?: string | null;
  event_title: string;
  status: 'pending' | 'approved';
  start_time: string;
  end_time: string;
};

type TodayBookedHallRpcRow = {
  booking_id: string;
  hall_id: string | null;
  hall_name: string | null;
  department: string | null;
  venue_type: string | null;
  location: string | null;
  event_title: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'approved';
  created_at?: string | null;
};

type TodayBookedHallQueryRow = {
  id: string;
  hall_id: string | null;
  event_title: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'approved';
  created_at: string | null;
  halls:
    | {
        name: string | null;
        department: string | null;
        venue_type: string | null;
        location: string | null;
      }
    | {
        name: string | null;
        department: string | null;
        venue_type: string | null;
        location: string | null;
      }[]
    | null;
};

type CreatedBookingRow = {
  id: string;
  event_title: string;
  halls: { name: string } | { name: string }[] | null;
};

type AdminNotificationRecipientRow = {
  user_id: string;
};

export async function getUserBookingStats(userId: string): Promise<BookingStats> {
  const { data, error } = await supabase
    .from('bookings')
    .select('status')
    .eq('user_id', userId)
    .in('status', ['pending', 'approved', 'rejected']);

  if (error) throw error;

  return (data ?? []).reduce<BookingStats>(
    (stats, booking) => {
      const status = booking.status as keyof BookingStats;
      stats[status] += 1;
      return stats;
    },
    { pending: 0, approved: 0, rejected: 0 }
  );
}

export async function getUserBookingsCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) throw error;
  return count ?? 0;
}

export async function getRecentUserBookings(userId: string): Promise<BookingPreview[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, event_title, status, start_time, end_time, created_at, halls(name, department, venue_type, location)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) throw error;
  return ((data ?? []) as BookingRow[]).map((row) => {
    const hall = Array.isArray(row.halls) ? row.halls[0] : row.halls;

    return {
      id: row.id,
      eventTitle: row.event_title,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time,
      hallName: hall?.name ?? null,
      createdAt: row.created_at
    };
  });
}

export async function getTodayBookedHalls(): Promise<TodayBookedHall[]> {
  const { startIso, endIso } = getLocalDayRange();
  const { data, error } = await supabase.rpc('get_today_booked_halls', {
    day_start: startIso,
    day_end: endIso
  });

  if (!error) {
    return ((data ?? []) as TodayBookedHallRpcRow[]).map(mapTodayBookedHallRpcRow);
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from('bookings')
    .select('id, hall_id, event_title, start_time, end_time, status, created_at, halls(name, department, venue_type, location)')
    .in('status', ['pending', 'approved'])
    .gte('start_time', startIso)
    .lt('start_time', endIso)
    .order('created_at', { ascending: false });

  if (fallbackError) throw fallbackError;

  return ((fallbackData ?? []) as TodayBookedHallQueryRow[]).map((row) => {
    const hall = Array.isArray(row.halls) ? row.halls[0] : row.halls;

    return {
      bookingId: row.id,
      hallId: row.hall_id,
      hallName: hall?.name ?? 'Venue',
      department: hall?.department ?? null,
      venueType: hall?.venue_type ?? null,
      location: hall?.location ?? null,
      eventTitle: row.event_title,
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status
    };
  });
}

export async function getUserBookings(userId: string): Promise<BookingPreview[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, event_title, status, start_time, end_time, created_at, halls(name, department, venue_type, location)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as BookingRow[]).map((row) => {
    const hall = Array.isArray(row.halls) ? row.halls[0] : row.halls;

    return {
      id: row.id,
      eventTitle: row.event_title,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time,
      hallName: hall?.name ?? null,
      createdAt: row.created_at
    };
  });
}

export async function getBookingDetails(bookingId: string): Promise<BookingDetails | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, hall_id, event_title, event_type, department, faculty_coordinator, start_time, end_time, status, admin_remarks, created_at, updated_at, halls(name, block, floor, capacity, facilities, image_url), approver:approved_by(full_name, email)'
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as BookingDetailsRow;
  const hall = Array.isArray(row.halls) ? row.halls[0] : row.halls;
  const approver = Array.isArray(row.approver) ? row.approver[0] : row.approver;

  return {
    id: row.id,
    hallId: row.hall_id,
    requesterId: null,
    eventTitle: row.event_title,
    eventType: row.event_type,
    department: row.department,
    facultyCoordinator: row.faculty_coordinator,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    adminRemarks: row.admin_remarks,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hall: hall
      ? {
          name: hall.name,
          block: hall.block,
          floor: hall.floor,
          capacity: hall.capacity,
          facilities: hall.facilities ?? [],
          imageUrl: hall.image_url
        }
      : null,
    approvedBy: approver
      ? {
          fullName: approver.full_name,
          email: approver.email
        }
      : null
  };
}

export async function cancelBooking(bookingId: string): Promise<void> {
  const { data: booking, error: loadError } = await supabase
    .from('bookings')
    .select('user_id, event_title')
    .eq('id', bookingId)
    .maybeSingle();

  if (loadError) throw loadError;

  const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId);
  if (error) throw error;

  if (booking?.user_id) {
    await createNotification({
      userId: booking.user_id,
      title: 'Booking cancelled',
      message: `Your booking request "${booking.event_title}" has been cancelled.`,
      bookingId
    });
  }
}

export async function checkBookingOverlap(params: {
  hallId: string;
  startTime: string;
  endTime: string;
}): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_booking_overlap', {
    selected_hall_id: params.hallId,
    new_start_time: params.startTime,
    new_end_time: params.endTime
  });

  if (error) throw error;
  return Boolean(data);
}

export async function getHallAvailabilityForDate(params: {
  hallId: string;
  date: string;
}): Promise<AvailabilitySlot[]> {
  const startOfDay = new Date(`${params.date}T00:00:00`);
  const endOfDay = new Date(`${params.date}T23:59:59.999`);

  const { data, error } = await supabase
    .from('bookings')
    .select('id, event_title, status, start_time, end_time')
    .eq('hall_id', params.hallId)
    .in('status', ['pending', 'approved'])
    .lt('start_time', endOfDay.toISOString())
    .gt('end_time', startOfDay.toISOString())
    .order('start_time', { ascending: true });

  if (error) throw error;

  return ((data ?? []) as AvailabilityRow[]).map((row) => ({
    id: row.id,
    eventTitle: row.event_title,
    status: row.status,
    startTime: row.start_time,
    endTime: row.end_time
  }));
}

export async function getUnavailableHallIdsForSlot(params: {
  startTime: string;
  endTime: string;
}): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('bookings')
    .select('hall_id')
    .in('status', ['pending', 'approved'])
    .lt('start_time', params.endTime)
    .gt('end_time', params.startTime);

  if (error) throw error;

  return new Set((data ?? []).map((row) => row.hall_id).filter(Boolean) as string[]);
}

export async function getBookingsForDate(params: {
  startOfDay: string;
  endOfDay: string;
}): Promise<BookingAvailability[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, hall_id, start_time, end_time, status')
    .in('status', ['pending', 'approved'])
    .lt('start_time', params.endOfDay)
    .gt('end_time', params.startOfDay);

  if (error) throw error;

  return ((data ?? []) as AvailabilityRow[]).map((row) => ({
    id: row.id,
    hallId: row.hall_id ?? null,
    status: row.status,
    startTime: row.start_time,
    endTime: row.end_time
  }));
}

export async function getBookingDateKeysForRange(params: {
  startDate: string;
  endDate: string;
}): Promise<string[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('start_time')
    .in('status', ['pending', 'approved'])
    .gte('start_time', params.startDate)
    .lt('start_time', params.endDate);

  if (error) throw error;

  return Array.from(
    new Set(
      ((data ?? []) as Pick<AvailabilityRow, 'start_time'>[]).map((row) => row.start_time.slice(0, 10))
    )
  );
}

export async function createBookingRequest(input: CreateBookingInput): Promise<void> {
  const hasOverlap = await checkBookingOverlap({
    hallId: input.hallId,
    startTime: input.startTime,
    endTime: input.endTime
  });

  if (hasOverlap) {
    throw new Error('This venue is already booked or awaiting approval for the selected time.');
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      hall_id: input.hallId,
      user_id: input.userId,
      event_title: input.eventTitle.trim(),
      event_type: input.eventType.trim() || null,
      department: input.department.trim() || null,
      faculty_coordinator: input.facultyCoordinator.trim() || null,
      start_time: input.startTime,
      end_time: input.endTime,
      status: 'pending'
    })
    .select('id, event_title, halls(name)')
    .single();

  if (error) throw error;
  if (data) {
    await notifyAdminsOfNewBooking(data as CreatedBookingRow).catch(() => undefined);
  }
}

async function notifyAdminsOfNewBooking(booking: CreatedBookingRow) {
  const hall = Array.isArray(booking.halls) ? booking.halls[0] : booking.halls;
  const hallName = hall?.name ?? 'a venue';
  const body = `${booking.event_title} requested for ${hallName}`;

  const { data, error } = await supabase.rpc('create_admin_booking_notifications', {
    booking_to_notify: booking.id
  });

  if (error) throw error;

  const recipients = ((data ?? []) as AdminNotificationRecipientRow[]).map((row) => row.user_id);
  await Promise.all(
    recipients.map((userId) =>
      sendPushNotification({
        userId,
        title: 'New booking request',
        body,
        data: {
          type: 'new_booking_request',
          booking_id: booking.id
        }
      }).catch(() => undefined)
    )
  );
}

function getLocalDayRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}

function mapTodayBookedHallRpcRow(row: TodayBookedHallRpcRow): TodayBookedHall {
  return {
    bookingId: row.booking_id,
    hallId: row.hall_id,
    hallName: row.hall_name ?? 'Venue',
    department: row.department,
    venueType: row.venue_type,
    location: row.location,
    eventTitle: row.event_title,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status
  };
}
