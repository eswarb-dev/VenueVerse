import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { AppTextInput } from '@/components/AppTextInput';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { formatLocation } from '@/components/HallCard';
import { LoadingView } from '@/components/LoadingView';
import { RevokeBookingDialog } from '@/components/RevokeBookingDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';
import { AdminStackParamList } from '@/navigation/types';
import { approveBooking, getAdminBookingDetails, rejectBooking, revokeApprovedBooking } from '@/services/adminService';
import { useAuth } from '@/store/AuthContext';
import { BookingDetails } from '@/types/venue';

type Props = NativeStackScreenProps<AdminStackParamList, 'BookingReview'>;

export function BookingReviewScreen({ route, navigation }: Props) {
  const { profile, user } = useAuth();
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [revokeDialogVisible, setRevokeDialogVisible] = useState(false);
  const [error, setError] = useState('');

  const loadBooking = useCallback(async () => {
    setError('');
    const nextBooking = await getAdminBookingDetails(route.params.bookingId);
    setBooking(nextBooking);
    setRemarks(nextBooking?.adminRemarks ?? '');
  }, [route.params.bookingId]);

  useEffect(() => {
    setLoading(true);
    loadBooking()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load booking.'))
      .finally(() => setLoading(false));
  }, [loadBooking]);

  const onApprove = async () => {
    if (!booking) return;
    const adminId = profile?.id ?? user?.id;
    if (!adminId) {
      setError('Admin session is not ready. Please sign in again.');
      return;
    }

    try {
      setSubmitting('approve');
      await approveBooking(booking, adminId, remarks);
      Alert.alert(
        'Approved',
        'Booking approved. Receipt will be generated for in-app viewing.'
      );
      navigation.goBack();
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : 'Unable to approve booking.');
    } finally {
      setSubmitting(null);
    }
  };

  const onReject = async () => {
    if (!booking) return;
    if (remarks.trim().length < 3) {
      setError('Please enter a rejection reason.');
      return;
    }

    try {
      setSubmitting('reject');
      await rejectBooking(booking, remarks);
      Alert.alert(
        'Rejected',
        'Booking rejected. The rejection reason is saved in booking details.'
      );
      navigation.goBack();
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : 'Unable to reject booking.');
    } finally {
      setSubmitting(null);
    }
  };


  const onRevoke = async (reason: string) => {
    if (!booking) return;

    try {
      setRevoking(true);
      await revokeApprovedBooking(booking.id, reason);
      Alert.alert('Booking revoked', 'The booking has been revoked and the requester has been notified.');
      setRevokeDialogVisible(false);
      await loadBooking();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Couldn’t revoke the booking. Please try again.');
    } finally {
      setRevoking(false);
    }
  };
  if (loading) return <LoadingView message="Loading booking review..." />;
  if (error && !booking) return <View style={styles.screen}><ErrorView message={error} onRetry={() => void loadBooking()} /></View>;
  if (!booking) return <View style={styles.screen}><EmptyState title="Booking not found" message="This booking may no longer exist." /></View>;

  const canReview = profile?.role === 'admin' && booking.status === 'pending' && profile.department === booking.hall?.department;
  const canRevoke = profile?.role === 'admin' && booking.status === 'approved' && profile.department === booking.hall?.department;
  const isSuperAdmin = profile?.role === 'super_admin';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {error ? <ErrorView message={error} onRetry={() => void loadBooking()} /> : null}

      <View style={styles.panel}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{booking.eventTitle}</Text>
          <StatusBadge status={booking.status} />
        </View>
        <Text style={styles.meta}>
          {format(new Date(booking.startTime), 'dd MMM yyyy')} • {format(new Date(booking.startTime), 'h:mm a')} - {format(new Date(booking.endTime), 'h:mm a')}
        </Text>
      </View>

      <Section title="Requester profile">
        <Detail label="Name" value={booking.requester?.fullName} />
        <Detail label="Email" value={booking.requester?.email} />
        <Detail label="Department" value={booking.requester?.department} />
      </Section>

      <Section title="Event details">
        <Detail label="Event type" value={booking.eventType} />
        <Detail label="Department" value={booking.department} />
        <Detail label="Faculty coordinator" value={booking.facultyCoordinator} />
      </Section>

      <Section title="Hall details">
        <Detail label="Hall" value={booking.hall?.name} />
        <Detail label="Location" value={booking.hall ? formatLocation(booking.hall.block, booking.hall.floor) : undefined} />
        <Detail label="Capacity" value={booking.hall?.capacity.toString()} />
        <Detail label="Facilities" value={booking.hall?.facilities.join(', ')} />
      </Section>

      {booking.status === 'revoked' ? (
        <Section title="Revocation details">
          <Detail label="Reason" value={booking.revocationReason} />
          <Detail label="Revoked on" value={booking.revokedAt ? format(new Date(booking.revokedAt), 'dd MMM yyyy, h:mm a') : null} />
          <Detail label="Revoked by" value={booking.revokedByDepartment ? `${booking.revokedByDepartment} Admin` : null} />
        </Section>
      ) : null}

      <AppTextInput
        label={booking.status === 'pending' ? 'Approval note optional / rejection reason required' : 'Admin remarks'}
        value={remarks}
        onChangeText={(value) => {
          setRemarks(value);
          setError('');
        }}
        multiline
        style={styles.remarks}
        placeholder="Optional for approval. Required for rejection."
      />

      {canReview ? (
        <View style={styles.actionRow}>
          <View style={styles.action}>
            <AppButton title="Approve" loading={submitting === 'approve'} disabled={Boolean(submitting)} onPress={onApprove} />
          </View>
          <View style={styles.action}>
            <AppButton title="Reject" variant="secondary" loading={submitting === 'reject'} disabled={Boolean(submitting)} onPress={onReject} />
          </View>
        </View>
      ) : (
        <Text style={styles.closedText}>
          {isSuperAdmin && booking.status === 'pending'
            ? `Read-only global audit view. Venue Department Admin: ${booking.hall?.department ?? 'Not assigned'}.`
            : 'This request has already been reviewed.'}
        </Text>
      )}
      {canRevoke ? (
        <AppButton title="Revoke Booking" variant="secondary" loading={revoking} disabled={revoking} onPress={() => setRevokeDialogVisible(true)} />
      ) : null}
      <RevokeBookingDialog
        visible={revokeDialogVisible}
        submitting={revoking}
        onCancel={() => setRevokeDialogVisible(false)}
        onConfirm={(reason) => void onRevoke(reason)}
      />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || 'Not provided'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background
  },
  screen: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.background
  },
  content: {
    padding: spacing.md,
    gap: spacing.md
  },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: fontSizes.xl,
    fontWeight: '900'
  },
  meta: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '900'
  },
  detail: {
    gap: spacing.xs
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  detailValue: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '700',
    lineHeight: 22
  },
  remarks: {
    minHeight: 104,
    paddingTop: spacing.md,
    textAlignVertical: 'top'
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md
  },
  action: {
    flex: 1
  },
  closedText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '800',
    textAlign: 'center'
  }
});
