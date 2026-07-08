import { supabase } from '@/lib/supabase';
import { sendPushNotification } from '@/lib/notifications';
import { createNotification } from '@/services/notificationService';
import { AdminBookingSummary, AdminDashboardStats, BookingDetails, BookingStatus } from '@/types/venue';

type AdminBookingRow = {
  id: string;
  user_id?: string | null;
  event_title: string;
  event_type?: string | null;
  status: BookingStatus;
  start_time: string;
  end_time: string;
  created_at?: string;
  updated_at?: string | null;
  admin_remarks?: string | null;
  faculty_coordinator?: string | null;
  department: string | null;
  halls:
    | {
        name: string;
        department: string | null;
        venue_type: string | null;
        location: string | null;
      }
    | {
        name: string;
        department: string | null;
        venue_type: string | null;
        location: string | null;
      }[]
    | null;
  profiles:
    | {
        full_name: string;
        email?: string | null;
        department: string | null;
        role?: string | null;
      }
    | {
        full_name: string;
        email?: string | null;
        department: string | null;
        role?: string | null;
      }[]
    | null;
};

type AdminBookingDetailsRow = {
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

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const [pending, approved, rejected, activeHalls] = await Promise.all([
    countBookingsByStatus('pending'),
    countBookingsByStatus('approved'),
    countBookingsByStatus('rejected'),
    countActiveHalls()
  ]);

  return { pending, approved, rejected, activeHalls };
}

export async function getPendingRequests(): Promise<AdminBookingSummary[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, event_title, status, start_time, end_time, created_at, updated_at, department, halls(name, department, venue_type, location), profiles:user_id(full_name, department)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return ((data ?? []) as AdminBookingRow[]).map(mapAdminBooking);
}

export async function getAllAdminBookings(status?: BookingStatus): Promise<AdminBookingSummary[]> {
  let query = supabase
    .from('bookings')
    .select(
      'id, user_id, event_title, event_type, department, faculty_coordinator, start_time, end_time, status, admin_remarks, created_at, updated_at, profiles:user_id(full_name, email, department, role), halls(name, department, venue_type, location)'
    )
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return ((data ?? []) as AdminBookingRow[]).map(mapAdminBooking);
}

export async function getAdminBookingDetails(bookingId: string): Promise<BookingDetails | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, hall_id, user_id, event_title, event_type, department, faculty_coordinator, start_time, end_time, status, admin_remarks, created_at, updated_at, halls(name, block, floor, capacity, facilities, image_url), requester:user_id(full_name, email, department), approver:approved_by(full_name, email)'
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as AdminBookingDetailsRow;
  const hall = Array.isArray(row.halls) ? row.halls[0] : row.halls;
  const requester = Array.isArray(row.requester) ? row.requester[0] : row.requester;
  const approver = Array.isArray(row.approver) ? row.approver[0] : row.approver;

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
      : null,
    requester: requester
      ? {
        fullName: requester.full_name,
        email: requester.email,
        department: requester.department
      }
    : null
  };
}

export async function approveBooking(booking: BookingDetails, adminId: string, remarks: string): Promise<void> {
  if (!booking.hallId) throw new Error('Booking does not have a hall assigned.');

  const { data: hasConflict, error: overlapError } = await supabase.rpc('check_approved_booking_overlap', {
    selected_hall_id: booking.hallId,
    booking_to_ignore: booking.id,
    new_start_time: booking.startTime,
    new_end_time: booking.endTime
  });

  if (overlapError) throw overlapError;
  if (hasConflict) {
    throw new Error('This venue already has an approved booking for the selected time.');
  }

  const { error } = await supabase
    .from('bookings')
    .update({
      status: 'approved',
      approved_by: adminId,
      admin_remarks: remarks.trim() || null
    })
    .eq('id', booking.id);

  if (error) throw error;

  await notifyBookingRequester(
    booking,
    'Booking approved',
    `Your booking request "${booking.eventTitle}" has been approved.`
  );
}

export async function rejectBooking(booking: BookingDetails, remarks: string): Promise<void> {
  if (!remarks.trim()) throw new Error('Admin remarks are required to reject a booking.');

  const { error } = await supabase
    .from('bookings')
    .update({
      status: 'rejected',
      admin_remarks: remarks.trim()
    })
    .eq('id', booking.id);

  if (error) throw error;

  await notifyBookingRequester(
    booking,
    'Booking rejected',
    `Your booking request "${booking.eventTitle}" was rejected. ${remarks.trim()}`
  );
}

async function countBookingsByStatus(status: BookingStatus) {
  const { count, error } = await supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', status);
  if (error) throw error;
  return count ?? 0;
}

async function countActiveHalls() {
  const { count, error } = await supabase.from('halls').select('id', { count: 'exact', head: true }).eq('is_active', true);
  if (error) throw error;
  return count ?? 0;
}

function mapAdminBooking(row: AdminBookingRow): AdminBookingSummary {
  const hall = Array.isArray(row.halls) ? row.halls[0] : row.halls;
  const requester = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

  return {
    id: row.id,
    eventTitle: row.event_title,
    status: row.status,
    startTime: row.start_time,
    endTime: row.end_time,
    hallName: hall?.name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    requesterName: requester?.full_name ?? null,
    requesterDepartment: requester?.department ?? row.department,
    resolvedDepartment: row.department ?? requester?.department ?? hall?.department ?? null
  };
}

async function notifyBookingRequester(booking: BookingDetails, title: string, message: string) {
  const userId = booking.requesterId ?? (await getBookingUserId(booking.id));
  if (!userId) return;

  await createNotification({
    userId,
    title,
    message,
    bookingId: booking.id
  });

  await sendPushNotification({
    userId,
    title,
    body: message,
    data: {
      type: title.toLowerCase().includes('approved') ? 'booking_approved' : 'booking_rejected',
      booking_id: booking.id
    }
  }).catch(() => undefined);
}

async function getBookingUserId(bookingId: string) {
  const { data, error } = await supabase.from('bookings').select('user_id').eq('id', bookingId).maybeSingle();
  if (error) throw error;
  return data?.user_id ?? null;
}
