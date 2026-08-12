import { supabase } from '@/lib/supabase';
import { createNotification } from '@/services/notificationService';
import { triggerBookingReceiptGeneration } from '@/services/receiptService';
import { DepartmentApprovalRequest } from '@/types/venue';

type DepartmentApprovalRequestRow = {
  id: string;
  user_id: string | null;
  event_title: string;
  event_type: string | null;
  requester_department: string | null;
  start_time: string;
  end_time: string;
  status: 'pending';
  created_at: string;
  hall_id: string | null;
  hall_name: string | null;
  hall_department: string | null;
  hall_venue_type: string | null;
  hall_location: string | null;
  requester_name: string | null;
  requester_email: string | null;
};

export type DepartmentBookingDecisionResult = {
  receiptTriggered: boolean;
};

export async function getDepartmentPendingApprovalRequests(): Promise<DepartmentApprovalRequest[]> {
  const { data, error } = await supabase.rpc('get_department_pending_requests');

  if (error) throw toBookingApprovalError(error, 'Unable to load pending approval requests.');
  return ((data ?? []) as DepartmentApprovalRequestRow[]).map(mapDepartmentApprovalRequest);
}

export async function approveBookingRequest(params: {
  bookingId: string;
  remarks?: string;
  requesterId?: string | null;
  eventTitle?: string | null;
}): Promise<DepartmentBookingDecisionResult> {
  const { error } = await supabase.rpc('approve_booking', {
    target_booking_id: params.bookingId,
    approval_remarks: params.remarks?.trim() || null
  });

  if (error) {
    if (!isMissingApprovalRpcError(error)) throw toBookingApprovalError(error, 'Unable to approve booking request.');
    await approveBookingDirectly(params);
  }

  triggerBookingReceiptGeneration(params.bookingId);
  return { receiptTriggered: true };
}

export async function rejectBookingRequest(params: {
  bookingId: string;
  remarks: string;
  requesterId?: string | null;
  eventTitle?: string | null;
}): Promise<DepartmentBookingDecisionResult> {
  const remarks = params.remarks.trim();
  if (remarks.length < 3) throw new Error('Please enter a rejection reason.');

  const { error } = await supabase.rpc('reject_booking', {
    target_booking_id: params.bookingId,
    rejection_remarks: remarks
  });

  if (error) {
    if (!isMissingApprovalRpcError(error)) throw toBookingApprovalError(error, 'Unable to reject booking request.');
    await rejectBookingDirectly({ ...params, remarks });
  }

  triggerBookingReceiptGeneration(params.bookingId);
  return { receiptTriggered: true };
}

async function approveBookingDirectly(params: {
  bookingId: string;
  remarks?: string;
  requesterId?: string | null;
  eventTitle?: string | null;
}) {
  const reviewerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('bookings')
    .update({
      status: 'approved',
      approved_by: reviewerId,
      admin_remarks: params.remarks?.trim() || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', params.bookingId)
    .eq('status', 'pending')
    .select('id, user_id, event_title, status')
    .single();

  if (error) {
    console.log('Approve booking update error:', error);
    throw error;
  }
  if (!data) {
    throw new Error('Booking could not be approved. It may have already been reviewed.');
  }

  if (data.user_id) {
    await createNotification({
      userId: data.user_id,
      title: 'Booking approved',
      message: `Your booking request "${data.event_title}" has been approved.`,
      bookingId: params.bookingId,
      type: 'booking_approved',
      data: {
        event_title: data.event_title ?? ''
      }
    }).catch(() => undefined);
  }
}

async function rejectBookingDirectly(params: {
  bookingId: string;
  remarks: string;
  requesterId?: string | null;
  eventTitle?: string | null;
}) {
  const reviewerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('bookings')
    .update({
      status: 'rejected',
      approved_by: reviewerId,
      admin_remarks: params.remarks,
      updated_at: new Date().toISOString()
    })
    .eq('id', params.bookingId)
    .eq('status', 'pending')
    .select('id, user_id, event_title, status')
    .single();

  if (error) {
    console.log('Reject booking update error:', error);
    throw error;
  }
  if (!data) {
    throw new Error('Booking could not be rejected. It may have already been reviewed.');
  }

  if (data.user_id) {
    await createNotification({
      userId: data.user_id,
      title: 'Booking rejected',
      message: `Your booking request "${data.event_title}" was rejected. Reason: ${truncateReason(params.remarks)}`,
      bookingId: params.bookingId,
      type: 'booking_rejected',
      data: {
        event_title: data.event_title ?? '',
        reason: truncateReason(params.remarks)
      }
    }).catch(() => undefined);
  }
}

function truncateReason(reason: string) {
  const trimmed = reason.trim();
  return trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error('Session is not ready. Please sign in again.');
  return data.user.id;
}

function isMissingApprovalRpcError(error: unknown) {
  const message = getErrorMessage(error);
  return (
    message.includes('approve_booking') ||
    message.includes('reject_booking') ||
    message.includes('function') ||
    message.includes('schema cache')
  );
}

function toBookingApprovalError(error: unknown, fallbackMessage: string) {
  return new Error(getErrorMessage(error) || fallbackMessage);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
}

function mapDepartmentApprovalRequest(row: DepartmentApprovalRequestRow): DepartmentApprovalRequest {
  return {
    id: row.id,
    requesterId: row.user_id,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    requesterDepartment: row.requester_department,
    eventTitle: row.event_title,
    eventType: row.event_type,
    hallId: row.hall_id,
    hallName: row.hall_name,
    hallDepartment: row.hall_department,
    hallVenueType: row.hall_venue_type,
    hallLocation: row.hall_location,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    createdAt: row.created_at
  };
}
