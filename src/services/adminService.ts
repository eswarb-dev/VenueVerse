import { supabase } from '@/lib/supabase';
import { triggerBookingReceiptGeneration } from '@/services/receiptService';
import { Profile } from '@/types/auth';
import { AdminBookingSummary, AdminDashboardStats, BookingDetails, BookingStatus } from '@/types/venue';
import { clearCachedValue, measureAsync, withCache } from '@/utils/performanceCache';

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
  revocation_reason: string | null;
  revoked_at: string | null;
  revoked_by_profile:
    | {
        full_name: string | null;
        department: string | null;
      }
    | {
        full_name: string | null;
        department: string | null;
      }[]
    | null;
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

export type BookingDecisionResult = {
  receiptTriggered: boolean;
};

type AdminContext = {
  department: string;
  isSuperAdmin: boolean;
};

const ADMIN_CACHE_TTL_MS = 20_000;

export async function getAdminDashboardStats(profile?: Profile | null, options?: { forceRefresh?: boolean }): Promise<AdminDashboardStats> {
  const adminContext = await getCurrentAdminContext(profile);
  const cacheKey = `admin-stats:${adminContext.isSuperAdmin ? 'super' : adminContext.department}`;
  return withCache(cacheKey, ADMIN_CACHE_TTL_MS, () => measureAsync('adminService.getAdminDashboardStats', () => loadAdminDashboardStats(adminContext)), options?.forceRefresh);
}

async function loadAdminDashboardStats(adminContext: AdminContext): Promise<AdminDashboardStats> {
  const adminDepartment = adminContext.department;
  const [pending, approved, rejected, revoked, activeHalls] = await Promise.all([
    countBookingsByStatus('pending', adminDepartment),
    countBookingsByStatus('approved', adminDepartment),
    countBookingsByStatus('rejected', adminDepartment),
    countBookingsByStatus('revoked', adminDepartment),
    countActiveHalls(adminDepartment)
  ]);

  return { pending, approved, rejected, revoked, activeHalls };
}

export async function getPendingRequests(profile?: Profile | null, options?: { forceRefresh?: boolean }): Promise<AdminBookingSummary[]> {
  const adminContext = await getCurrentAdminContext(profile);
  const cacheKey = `admin-pending:${adminContext.isSuperAdmin ? 'super' : adminContext.department}`;
  return withCache(cacheKey, ADMIN_CACHE_TTL_MS, () => measureAsync('adminService.getPendingRequests', () => loadPendingRequests(adminContext)), options?.forceRefresh);
}

async function loadPendingRequests(adminContext: AdminContext): Promise<AdminBookingSummary[]> {
  if (adminContext.isSuperAdmin) {
    const { data, error } = await supabase.rpc('get_global_admin_bookings', {
      target_status: 'pending'
    });

    if (error) throw error;
    return ((data ?? []) as {
      id: string;
      user_id: string | null;
      event_title: string;
      status: BookingStatus;
      start_time: string;
      end_time: string;
      created_at?: string;
      updated_at?: string | null;
      hall_name: string | null;
      hall_department: string | null;
      requester_name: string | null;
      requester_department: string | null;
    }[]).map((row) => ({
      id: row.id,
      eventTitle: row.event_title,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time,
      hallName: row.hall_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      requesterName: row.requester_name,
      requesterDepartment: row.requester_department,
      resolvedDepartment: row.hall_department
    }));
  }

  const { data, error } = await supabase
    .rpc('get_department_pending_requests');

  if (error) throw error;
  return ((data ?? []) as {
    id: string;
    user_id: string | null;
    event_title: string;
    status: BookingStatus;
    start_time: string;
    end_time: string;
    created_at?: string;
    hall_name: string | null;
    hall_department: string | null;
    hall_venue_type: string | null;
    hall_location: string | null;
    requester_name: string | null;
    requester_department: string | null;
  }[]).map((row) => ({
    id: row.id,
    eventTitle: row.event_title,
    status: row.status,
    startTime: row.start_time,
    endTime: row.end_time,
    hallName: row.hall_name,
    createdAt: row.created_at,
    requesterName: row.requester_name,
    requesterDepartment: row.requester_department,
    resolvedDepartment: row.hall_department
  }));
}

export async function getAllAdminBookings(status?: BookingStatus, profile?: Profile | null, options?: { forceRefresh?: boolean }): Promise<AdminBookingSummary[]> {
  const adminContext = await getCurrentAdminContext(profile);
  const cacheKey = `admin-bookings:${adminContext.isSuperAdmin ? 'super' : adminContext.department}:${status ?? 'all'}`;
  return withCache(cacheKey, ADMIN_CACHE_TTL_MS, () => measureAsync('adminService.getAllAdminBookings', () => loadAllAdminBookings(status, adminContext)), options?.forceRefresh);
}

async function loadAllAdminBookings(status: BookingStatus | undefined, adminContext: AdminContext): Promise<AdminBookingSummary[]> {
  if (adminContext.isSuperAdmin) {
    const { data, error } = await supabase.rpc('get_global_admin_bookings', {
      target_status: status ?? null
    });
    if (error) throw error;
    return ((data ?? []) as {
      id: string;
      user_id: string | null;
      event_title: string;
      status: BookingStatus;
      start_time: string;
      end_time: string;
      created_at?: string;
      updated_at?: string | null;
      hall_name: string | null;
      hall_department: string | null;
      requester_name: string | null;
      requester_department: string | null;
      revocation_reason?: string | null;
      revoked_at?: string | null;
      revoked_by_department?: string | null;
    }[]).map((row) => ({
      id: row.id,
      eventTitle: row.event_title,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time,
      hallName: row.hall_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      requesterName: row.requester_name,
      requesterDepartment: row.requester_department,
      resolvedDepartment: row.hall_department,
      revocationReason: (row as any).revocation_reason ?? null,
      revokedAt: (row as any).revoked_at ?? null,
      revokedByDepartment: (row as any).revoked_by_department ?? null
    }));
  }

  const adminDepartment = adminContext.department;
  let query = supabase
    .from('bookings')
    .select(
      'id, user_id, event_title, event_type, department, faculty_coordinator, start_time, end_time, status, admin_remarks, revocation_reason, revoked_at, revoked_by_profile:revoked_by(full_name, department), created_at, updated_at, profiles:user_id(full_name, email, department, role), halls!inner(name, department, venue_type, location)'
    )
    .eq('halls.department', adminDepartment)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return ((data ?? []) as AdminBookingRow[]).map((row) => {
    const mapped = mapAdminBooking(row);
    const revoker = (row as any).revoked_by_profile;
    mapped.revocationReason = (row as any).revocation_reason ?? null;
    mapped.revokedAt = (row as any).revoked_at ?? null;
    if (revoker) {
      const r = Array.isArray(revoker) ? revoker[0] : revoker;
      mapped.revokedByDepartment = r?.department ?? null;
    }
    return mapped;
  });
}

export async function getAdminBookingDetails(bookingId: string, profile?: Profile | null, options?: { forceRefresh?: boolean }): Promise<BookingDetails | null> {
  const adminContext = await getCurrentAdminContext(profile);
  const cacheKey = `admin-booking-details:${adminContext.isSuperAdmin ? 'super' : adminContext.department}:${bookingId}`;
  return withCache(cacheKey, ADMIN_CACHE_TTL_MS, () => measureAsync('adminService.getAdminBookingDetails', () => loadAdminBookingDetails(bookingId, adminContext)), options?.forceRefresh);
}

async function loadAdminBookingDetails(bookingId: string, adminContext: AdminContext): Promise<BookingDetails | null> {
  let query = supabase
    .from('bookings')
    .select(
      'id, hall_id, user_id, event_title, event_type, department, faculty_coordinator, start_time, end_time, status, admin_remarks, revocation_reason, revoked_at, created_at, updated_at, halls!inner(name, department, block, floor, capacity, facilities, image_url), requester:user_id(full_name, email, department), approver:approved_by(full_name, email), revoked_by_profile:revoked_by(full_name, department)'
    )
    .eq('id', bookingId);

  if (!adminContext.isSuperAdmin) {
    query = query.eq('halls.department', adminContext.department);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as AdminBookingDetailsRow;
  const hall = Array.isArray(row.halls) ? row.halls[0] : row.halls;
  const requester = Array.isArray(row.requester) ? row.requester[0] : row.requester;
  const approver = Array.isArray(row.approver) ? row.approver[0] : row.approver;
  const revoker = Array.isArray(row.revoked_by_profile) ? row.revoked_by_profile[0] : row.revoked_by_profile;

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
    revokedByName: revoker?.full_name ?? null,
    revokedByDepartment: revoker?.department ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hall: hall
      ? {
          name: hall.name,
          department: hall.department,
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

export async function approveBooking(booking: BookingDetails, adminId: string, remarks: string): Promise<BookingDecisionResult> {
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

  const { error } = await supabase.rpc('approve_booking', {
    target_booking_id: booking.id,
    approval_remarks: remarks.trim() || null
  });

  if (error) {
    throw error;
  }

  clearAdminCaches(booking.id);
  triggerBookingReceiptGeneration(booking.id);
  return { receiptTriggered: true };
}

export async function rejectBooking(booking: BookingDetails, remarks: string): Promise<BookingDecisionResult> {
  if (!remarks.trim()) throw new Error('Admin remarks are required to reject a booking.');

  const { error } = await supabase.rpc('reject_booking', {
    target_booking_id: booking.id,
    rejection_remarks: remarks.trim()
  });

  if (error) {
    throw error;
  }

  clearAdminCaches(booking.id);
  triggerBookingReceiptGeneration(booking.id);
  return { receiptTriggered: true };
}

export async function revokeApprovedBooking(bookingId: string, reason: string): Promise<void> {
  const trimmedReason = reason.trim();
  if (trimmedReason.length < 5) throw new Error('Please enter a valid revoke reason.');

  const { error } = await supabase.rpc('revoke_booking', {
    p_booking_id: bookingId,
    p_reason: trimmedReason
  });

  if (error) throw error;
  clearAdminCaches(bookingId);
}

async function countBookingsByStatus(status: BookingStatus, department: string) {
  let query = supabase
    .from('bookings')
    .select('id, halls!inner(department)', { count: 'exact', head: true })
    .eq('status', status);
  if (department) query = query.eq('halls.department', department);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function countActiveHalls(department: string) {
  let query = supabase.from('halls').select('id', { count: 'exact', head: true }).eq('is_active', true);
  if (department) query = query.eq('department', department);
  const { count, error } = await query;
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
    resolvedDepartment: hall?.department ?? null
  };
}

async function getCurrentAdminContext(profile?: Profile | null): Promise<AdminContext> {
  if (profile?.role === 'super_admin') return { department: '', isSuperAdmin: true };
  if (profile?.role === 'admin') {
    if (!profile.department) throw new Error('Admin department is not assigned.');
    return { department: profile.department, isSuperAdmin: false };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error('Admin session is not ready. Please sign in again.');

  const { data, error } = await supabase.from('profiles').select('department, role').eq('id', userId).maybeSingle();
  if (error) throw error;
  if (data?.role === 'super_admin') return { department: '', isSuperAdmin: true };
  if (data?.role !== 'admin') throw new Error('Only admins can access this section.');
  if (!data.department) throw new Error('Admin department is not assigned.');
  return { department: data.department, isSuperAdmin: false };
}

function clearAdminCaches(bookingId?: string | null) {
  clearCachedValue('admin-stats:');
  clearCachedValue('admin-pending:');
  clearCachedValue('admin-bookings:');
  if (bookingId) clearCachedValue('admin-booking-details:');
}
