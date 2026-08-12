import { supabase } from '@/lib/supabase';
import { createNotification } from '@/services/notificationService';
import { clearCachedValue, measureAsync, withCache } from '@/utils/performanceCache';
import {
  AvailabilitySlot,
  BookingAvailability,
  BookingDetails,
  BookingPreview,
  BookingStats,
  BookingStatus,
  CreateBookingInput,
  TodayBookedHall,
  BookedHallForDate
} from '@/types/venue';

type BookingRow = {
  id: string;
  user_id?: string | null;
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
  requester?:
    | {
        full_name: string | null;
        department: string | null;
      }
    | {
        full_name: string | null;
        department: string | null;
      }[]
    | null;
};

type BookingDetailsRow = {
  id: string;
  hall_id: string | null;
  user_id: string | null;
  event_title: string;
  event_type: string | null;
  department: string | null;
  faculty_coordinator: string | null;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  admin_remarks: string | null;
  revocation_reason: string | null;
  revoked_at: string | null;
  revoked_by_name: string | null;
  revoked_by_department: string | null;
  created_at: string | null;
  updated_at: string | null;
  halls:
    | {
        name: string;
        department: string | null;
        block: string | null;
        floor: string | null;
        capacity: number;
        facilities: string[] | null;
        image_url: string | null;
      }
    | {
        name: string;
        department: string | null;
        block: string | null;
        floor: string | null;
        capacity: number;
        facilities: string[] | null;
        image_url: string | null;
      }[]
    | null;
  requester:
    | {
        full_name: string;
        email: string;
        department: string | null;
      }
    | {
        full_name: string;
        email: string;
        department: string | null;
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

type BookedSlotInfoRpcRow = {
  booking_id: string;
  hall_id: string | null;
  hall_name: string | null;
  event_title: string;
  requester_name: string | null;
  requester_department: string | null;
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
  department: string | null;
  halls: { name: string; department: string | null } | { name: string; department: string | null }[] | null;
  profiles: { full_name: string | null; department: string | null } | { full_name: string | null; department: string | null }[] | null;
};

type DepartmentBookingRpcRow = {
  id: string;
  user_id: string | null;
  requester_name: string | null;
  requester_department: string | null;
  event_title: string;
  status: BookingStatus;
  start_time: string;
  end_time: string;
  created_at: string | null;
  hall_name: string | null;
  hall_department: string | null;
  hall_venue_type: string | null;
  hall_location: string | null;
};

type VisibleBookingDetailsRpcRow = {
  id: string;
  hall_id: string | null;
  user_id: string | null;
  requester_name: string | null;
  requester_email: string | null;
  requester_department: string | null;
  event_title: string;
  event_type: string | null;
  department: string | null;
  faculty_coordinator: string | null;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  admin_remarks: string | null;
  revocation_reason: string | null;
  revoked_at: string | null;
  revoked_by_name: string | null;
  revoked_by_department: string | null;
  created_at: string | null;
  updated_at: string | null;
  hall_name: string | null;
  hall_department: string | null;
  hall_block: string | null;
  hall_floor: string | null;
  hall_capacity: number | null;
  hall_facilities: string[] | null;
  hall_image_url: string | null;
  approver_name: string | null;
  approver_email: string | null;
};

const BOOKING_LIST_CACHE_TTL_MS = 30_000;
const BOOKING_DETAILS_CACHE_TTL_MS = 20_000;
const BOOKED_HALLS_BY_DATE_CACHE_TTL_MS = 30_000;
const BOOKING_CONFLICT_MESSAGE = 'This venue session was just booked by another user. Please choose another slot.';

export async function getUserBookingStats(userId: string, options?: { forceRefresh?: boolean }): Promise<BookingStats> {
  return withCache(`booking-stats:${userId}`, 20_000, () => measureAsync('bookingService.getUserBookingStats', async () => {
    const [pending, approved, rejected] = await Promise.all([
      countUserBookingsByStatus(userId, 'pending'),
      countUserBookingsByStatus(userId, 'approved'),
      countUserBookingsByStatus(userId, 'rejected')
    ]);

    return { pending, approved, rejected };
  }), options?.forceRefresh);
}

async function countUserBookingsByStatus(userId: string, status: BookingStatus): Promise<number> {
  const { count, error } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', status);

  if (error) throw error;
  return count ?? 0;
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
  return loadBookedHallsForRange(startIso, endIso);
}

export async function getBookedHallsForDate(dateKey: string, options?: { forceRefresh?: boolean }): Promise<BookedHallForDate[]> {
  return withCache(`booked-halls:date:${dateKey}`, BOOKED_HALLS_BY_DATE_CACHE_TTL_MS, async () => {
    const { startIso, endIso } = getLocalDayRange(parseLocalDateKey(dateKey));
    return loadBookedHallsForRange(startIso, endIso);
  }, options?.forceRefresh);
}

async function loadBookedHallsForRange(startIso: string, endIso: string): Promise<TodayBookedHall[]> {
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
    .lt('start_time', endIso)
    .gt('end_time', startIso)
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

export async function getUserBookings(userId: string, options?: { forceRefresh?: boolean }): Promise<BookingPreview[]> {
  return withCache(`bookings:user:${userId}`, BOOKING_LIST_CACHE_TTL_MS, () => measureAsync('bookingService.getUserBookings', () => loadUserBookings(userId)), options?.forceRefresh);
}

async function loadUserBookings(userId: string): Promise<BookingPreview[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, user_id, event_title, status, start_time, end_time, created_at, halls(name, department, venue_type, location), requester:user_id(full_name, department)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as BookingRow[]).map((row) => {
    const hall = Array.isArray(row.halls) ? row.halls[0] : row.halls;
    const requester = Array.isArray(row.requester) ? row.requester[0] : row.requester;

    return {
      id: row.id,
      requesterId: row.user_id ?? null,
      requesterName: requester?.full_name ?? null,
      requesterDepartment: requester?.department ?? null,
      eventTitle: row.event_title,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time,
      hallName: hall?.name ?? null,
      hallDepartment: hall?.department ?? null,
      hallVenueType: hall?.venue_type ?? null,
      hallLocation: hall?.location ?? null,
      createdAt: row.created_at
    };
  });
}

export async function getMyDepartmentBookings(options?: { forceRefresh?: boolean }): Promise<BookingPreview[]> {
  return withCache('bookings:my-department', BOOKING_LIST_CACHE_TTL_MS, () => measureAsync('bookingService.getMyDepartmentBookings', loadMyDepartmentBookings), options?.forceRefresh);
}

async function loadMyDepartmentBookings(): Promise<BookingPreview[]> {
  const { data, error } = await supabase.rpc('get_my_department_bookings');

  if (error) throw error;

  return ((data ?? []) as DepartmentBookingRpcRow[]).map((row) => ({
    id: row.id,
    requesterId: row.user_id,
    requesterName: row.requester_name,
    requesterDepartment: row.requester_department,
    eventTitle: row.event_title,
    status: row.status,
    startTime: row.start_time,
    endTime: row.end_time,
    hallName: row.hall_name,
    hallDepartment: row.hall_department,
    hallVenueType: row.hall_venue_type,
    hallLocation: row.hall_location,
    createdAt: row.created_at ?? undefined
  }));
}

export async function getBookingDetails(bookingId: string, options?: { forceRefresh?: boolean }): Promise<BookingDetails | null> {
  return withCache(`booking-details:${bookingId}`, BOOKING_DETAILS_CACHE_TTL_MS, () => measureAsync('bookingService.getBookingDetails', () => loadBookingDetails(bookingId)), options?.forceRefresh);
}

async function loadBookingDetails(bookingId: string): Promise<BookingDetails | null> {
  const { data, error } = await supabase
    .rpc('get_visible_booking_details', { target_booking: bookingId })
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as VisibleBookingDetailsRpcRow;

  return {
    id: row.id,
    hallId: row.hall_id,
    requesterId: row.user_id,
    eventTitle: row.event_title,
    eventType: row.event_type,
    department: row.department,
    facultyCoordinator: row.faculty_coordinator,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    adminRemarks: row.admin_remarks,
    revocationReason: row.revocation_reason,
    revokedAt: row.revoked_at,
    revokedByName: row.revoked_by_name,
    revokedByDepartment: row.revoked_by_department,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hall: row.hall_name
      ? {
          name: row.hall_name,
          department: row.hall_department,
          block: row.hall_block,
          floor: row.hall_floor,
          capacity: row.hall_capacity ?? 0,
          facilities: row.hall_facilities ?? [],
          imageUrl: row.hall_image_url
        }
      : null,
    approvedBy: row.approver_name || row.approver_email
      ? {
          fullName: row.approver_name ?? 'Approver',
          email: row.approver_email ?? ''
        }
      : null,
    requester: row.requester_name || row.requester_email || row.requester_department
      ? {
          fullName: row.requester_name ?? 'Requester',
          email: row.requester_email ?? '',
          department: row.requester_department
        }
      : null
  };
}

export async function cancelBooking(bookingId: string): Promise<void> {
  const { data: booking, error: loadError } = await supabase
    .from('bookings')
    .select('user_id, event_title, halls(name, department), profiles:user_id(full_name)')
    .eq('id', bookingId)
    .maybeSingle();

  if (loadError) throw loadError;

  const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId);
  if (error) throw error;
  clearBookingCaches(bookingId, booking?.user_id ?? undefined);

  if (booking) {
    await notifyDepartmentAdminsOfBookingCancellation(bookingId, booking as CancelledBookingRow).catch(() => undefined);
  }
}

type CancelledBookingRow = {
  user_id: string | null;
  event_title: string;
  halls: { name: string | null; department: string | null } | { name: string | null; department: string | null }[] | null;
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
};

async function notifyDepartmentAdminsOfBookingCancellation(bookingId: string, booking: CancelledBookingRow) {
  const hall = Array.isArray(booking.halls) ? booking.halls[0] : booking.halls;
  const requester = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles;
  if (!hall?.department) return;

  const { data: admins, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .eq('department', hall.department);

  if (error) throw error;

  await Promise.all(
    (admins ?? []).map((admin) =>
      createNotification({
        userId: admin.id,
        title: 'Booking cancelled',
        message: `${requester?.full_name ?? 'A user'} cancelled the booking request for ${hall.name ?? 'the venue'}.`,
        bookingId,
        type: 'booking_cancelled',
        data: {
          venue_name: hall.name ?? '',
          event_title: booking.event_title
        }
      }).catch(() => undefined)
    )
  );
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

  const data = await getHallBookedSlotsForRange({
    hallId: params.hallId,
    startTime: startOfDay.toISOString(),
    endTime: endOfDay.toISOString()
  });

  return data.map((row) => ({
    id: row.id,
    eventTitle: row.event_title,
    status: row.status,
    startTime: row.start_time,
    endTime: row.end_time,
    requesterName: row.requester_name,
    requesterDepartment: row.requester_department,
    hallName: row.hall_name
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
  hallId?: string | null;
}): Promise<BookingAvailability[]> {
  if (params.hallId) {
    const data = await getHallBookedSlotsForRange({
      hallId: params.hallId,
      startTime: params.startOfDay,
      endTime: params.endOfDay
    });

    return data.map((row) => ({
      id: row.id,
      hallId: row.hall_id,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time,
      eventTitle: row.event_title,
      requesterName: row.requester_name,
      requesterDepartment: row.requester_department,
      hallName: row.hall_name
    }));
  }

  let query = supabase
    .from('bookings')
    .select('id, hall_id, start_time, end_time, status')
    .in('status', ['pending', 'approved'])
    .lt('start_time', params.endOfDay)
    .gt('end_time', params.startOfDay);

  if (params.hallId) {
    query = query.eq('hall_id', params.hallId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return ((data ?? []) as AvailabilityRow[]).map((row) => ({
    id: row.id,
    hallId: row.hall_id ?? null,
    status: row.status,
    startTime: row.start_time,
    endTime: row.end_time
  }));
}

async function getHallBookedSlotsForRange(params: {
  hallId: string;
  startTime: string;
  endTime: string;
}) {
  const { data, error } = await supabase.rpc('get_hall_booked_slots_for_range', {
    p_hall_id: params.hallId,
    p_start: params.startTime,
    p_end: params.endTime
  });

  if (error) throw error;

  return ((data ?? []) as BookedSlotInfoRpcRow[]).map((row) => ({
    id: row.booking_id,
    hall_id: row.hall_id,
    hall_name: row.hall_name,
    event_title: row.event_title,
    requester_name: row.requester_name,
    requester_department: row.requester_department,
    status: row.status,
    start_time: row.start_time,
    end_time: row.end_time
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
    throw new Error(BOOKING_CONFLICT_MESSAGE);
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
    .select('id, event_title, department, halls(name, department), profiles:user_id(full_name, department)')
    .single();

  if (error) {
    if (isBookingConflictError(error)) {
      clearBookingCaches(null, input.userId);
      throw new Error(BOOKING_CONFLICT_MESSAGE);
    }
    throw error;
  }
  clearBookingCaches(data?.id, input.userId);
  if (data) {
    await notifyDepartmentApproverOfNewBooking(data as CreatedBookingRow).catch(() => undefined);
  }
}

function clearBookingCaches(bookingId?: string | null, userId?: string | null) {
  clearCachedValue('bookings:my-department');
  clearCachedValue('booking-stats:');
  if (userId) clearCachedValue(`bookings:user:${userId}`);
  if (bookingId) clearCachedValue(`booking-details:${bookingId}`);
}

async function notifyDepartmentApproverOfNewBooking(booking: CreatedBookingRow) {
  const { error } = await supabase.rpc('notify_department_approver', {
    booking_to_notify: booking.id
  });

  if (error) throw error;
}

function getLocalDayRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString()
  };
}

function parseLocalDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 0, 0, 0, 0);
}

function isBookingConflictError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { code?: string; message?: string; details?: string };
  const message = `${maybeError.message ?? ''} ${maybeError.details ?? ''}`.toLowerCase();

  return maybeError.code === '23P01'
    || maybeError.code === '23514'
    || message.includes('bookings_no_active_overlap')
    || message.includes('already booked or awaiting approval');
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
