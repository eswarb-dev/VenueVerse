import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { BookingProgressTracker } from '@/components/BookingProgressTracker';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { formatLocation } from '@/components/HallCard';
import { LoadingView } from '@/components/LoadingView';
import { ReceiptViewerModal } from '@/components/receipts/ReceiptViewerModal';
import { StatusBadge } from '@/components/StatusBadge';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';
import { AppStackParamList } from '@/navigation/types';
import { cancelBooking, getBookingDetails } from '@/services/bookingService';
import { debounceRealtimeRefresh, subscribeToBookingChanges } from '@/services/bookingRealtimeService';
import { BookingReceipt, emailReceiptPdfCopy, generateBookingReceipt, getBookingReceipt } from '@/services/receiptService';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/AuthContext';
import { BookingDetails } from '@/types/venue';

type Props = NativeStackScreenProps<AppStackParamList, 'BookingDetails'>;

export function BookingDetailsScreen({ route, navigation }: Props) {
  const { profile } = useAuth();
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [receipt, setReceipt] = useState<BookingReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [receiptViewerVisible, setReceiptViewerVisible] = useState(false);
  const [emailReceiptLoading, setEmailReceiptLoading] = useState(false);
  const [emailPdfCopyLoading, setEmailPdfCopyLoading] = useState(false);
  const [error, setError] = useState('');

  const loadBooking = useCallback(async () => {
    setError('');
    const nextBooking = await getBookingDetails(route.params.bookingId);
    setBooking(nextBooking);
    const canLoadReceipt = nextBooking?.requesterId === profile?.id || profile?.role === 'admin' || profile?.role === 'super_admin';
    if (canLoadReceipt && (nextBooking?.status === 'approved' || nextBooking?.status === 'rejected' || nextBooking?.status === 'revoked')) {
      setReceipt(await getBookingReceipt(nextBooking.id));
    } else {
      setReceipt(null);
    }
  }, [profile?.id, profile?.role, route.params.bookingId]);

  useEffect(() => {
    setLoading(true);
    loadBooking()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load booking details.'))
      .finally(() => setLoading(false));
  }, [loadBooking]);

  useEffect(() => {
    const refreshDetails = debounceRealtimeRefresh(() => {
      void loadBooking().catch((loadError) => {
        if (__DEV__) console.log('[realtime] booking details refresh failed', loadError);
      });
    });

    const channel = subscribeToBookingChanges({
      channelName: `bookings:details:${route.params.bookingId}`,
      onChange: (_event, bookingId) => {
        if (bookingId === route.params.bookingId) refreshDetails.schedule();
      }
    });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (__DEV__) console.log('[app-state] active refresh');
      refreshDetails.schedule();
    });

    return () => {
      refreshDetails.cancel();
      appStateSubscription.remove();
      supabase.removeChannel(channel);
    };
  }, [loadBooking, route.params.bookingId]);

  const onCancel = () => {
    if (!booking || booking.status !== 'pending') return;

    Alert.alert('Cancel booking?', 'This will mark your pending booking request as cancelled.', [
      { text: 'Keep Booking', style: 'cancel' },
      {
        text: 'Cancel Booking',
        style: 'destructive',
        onPress: async () => {
          try {
            setCancelling(true);
            await cancelBooking(booking.id);
            Alert.alert('Booking cancelled', 'Your booking request has been cancelled.');
            await loadBooking();
            navigation.setParams({ bookingId: booking.id });
          } catch (cancelError) {
            setError(cancelError instanceof Error ? cancelError.message : 'Unable to cancel booking.');
          } finally {
            setCancelling(false);
          }
        }
      }
    ]);
  };

  const viewReceipt = async () => {
    if (!receipt) return;
    setReceiptViewerVisible(true);
  };

  const generateReceipt = async () => {
    if (!booking) return;
    try {
      setEmailReceiptLoading(true);
      await generateBookingReceipt(booking.id, { queueEmail: false });
      setReceipt(await getBookingReceipt(booking.id));
      Alert.alert('Receipt generated', 'The receipt is ready in VenueVerse.');
    } catch (receiptError) {
      setError(receiptError instanceof Error ? receiptError.message : 'Unable to generate receipt.');
    } finally {
      setEmailReceiptLoading(false);
    }
  };

  const sendReceiptPdfCopy = async () => {
    if (!receipt) return;
    try {
      setEmailPdfCopyLoading(true);
      Alert.alert('Sending PDF...', 'Sending the receipt PDF copy to your email.');
      await emailReceiptPdfCopy(receipt);
      setReceipt(await getBookingReceipt(receipt.bookingId));
      Alert.alert('PDF copy sent', 'PDF copy sent to your email.');
    } catch (receiptError) {
      Alert.alert('Failed to send PDF copy', receiptError instanceof Error ? receiptError.message : 'Failed to send PDF copy. Try again.');
    } finally {
      setEmailPdfCopyLoading(false);
    }
  };

  if (loading) return <LoadingView message="Loading booking details..." />;
  if (error && !booking) return <View style={styles.screen}><ErrorView message={error} onRetry={() => void loadBooking()} /></View>;
  if (!booking) return <View style={styles.screen}><EmptyState title="Booking not found" message="This request may no longer exist." /></View>;

  const isOwner = booking.requesterId === profile?.id;
  const isAdmin = profile?.role === 'admin';
  const isSuperAdmin = profile?.role === 'super_admin';
  const isSameRequesterDepartment = Boolean(profile?.department && booking.requester?.department === profile.department);
  const canView = isOwner || isAdmin || isSuperAdmin || isSameRequesterDepartment;
  const canCancel = isOwner && booking.status === 'pending';
  const canUseReceiptActions = isOwner || isAdmin || isSuperAdmin;

  if (!canView) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Access denied" message="You can view only your own bookings or bookings requested by users in your department." />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {error ? <ErrorView message={error} onRetry={() => void loadBooking()} /> : null}

      <View style={styles.panel}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{booking.eventTitle}</Text>
          <StatusBadge status={booking.status} />
        </View>
        <Text style={styles.meta}>{format(new Date(booking.startTime), 'dd MMM yyyy')}</Text>
        <Text style={styles.meta}>
          {format(new Date(booking.startTime), 'h:mm a')} - {format(new Date(booking.endTime), 'h:mm a')}
        </Text>
      </View>

      <BookingProgressTracker status={booking.status} />

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Event details</Text>
        {booking.requester ? (
          <DetailRow
            label="Requester"
            value={`${isOwner ? 'You' : booking.requester.fullName}${booking.requester.department ? ` • ${booking.requester.department}` : ''}`}
          />
        ) : null}
        <DetailRow label="Event type" value={booking.eventType} />
        <DetailRow label="Department" value={booking.department} />
        <DetailRow label="Faculty coordinator" value={booking.facultyCoordinator} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Hall details</Text>
        {booking.hall?.imageUrl ? <Image source={{ uri: booking.hall.imageUrl }} style={styles.image} /> : null}
        <DetailRow label="Hall" value={booking.hall?.name ?? null} />
        <DetailRow label="Location" value={booking.hall ? formatLocation(booking.hall.block, booking.hall.floor) : null} />
        <DetailRow label="Capacity" value={booking.hall?.capacity.toString() ?? null} />
        <DetailRow label="Facilities" value={booking.hall?.facilities.join(', ') || null} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Approval information</Text>
        {booking.status === 'rejected' ? <DetailRow label="Admin remarks" value={booking.adminRemarks} emphasize /> : null}
        {booking.status === 'approved' ? <DetailRow label="Approved by" value={booking.approvedBy?.fullName ?? null} emphasize /> : null}
        {booking.status === 'revoked' ? <DetailRow label="Revocation reason" value={booking.revocationReason} emphasize /> : null}
        {booking.status === 'revoked' ? <DetailRow label="Revoked on" value={booking.revokedAt ? format(new Date(booking.revokedAt), 'dd MMM yyyy, h:mm a') : null} /> : null}
        {booking.status === 'revoked' ? <DetailRow label="Revoked by" value={booking.revokedByDepartment ? `${booking.revokedByDepartment} Admin` : null} /> : null}
        <DetailRow label="Created" value={booking.createdAt ? format(new Date(booking.createdAt), 'dd MMM yyyy, h:mm a') : null} />
        <DetailRow label="Updated" value={booking.updatedAt ? format(new Date(booking.updatedAt), 'dd MMM yyyy, h:mm a') : null} />
      </View>

      {canUseReceiptActions && (booking.status === 'approved' || booking.status === 'rejected' || booking.status === 'revoked') ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Official receipt</Text>
          {booking.status === 'revoked' ? <Text style={styles.revokedNotice}>This receipt is no longer valid because the booking has been revoked.</Text> : null}
          {receipt ? (
            <>
              <DetailRow label="Receipt No" value={receipt.receiptNo} emphasize />
              <DetailRow label="Email status" value={formatReceiptEmailStatus(receipt)} />
              <AppButton title="View Receipt" onPress={viewReceipt} />
              <AppButton title="Email PDF Copy" variant="secondary" loading={emailPdfCopyLoading} disabled={emailPdfCopyLoading} onPress={() => void sendReceiptPdfCopy()} />
            </>
          ) : (
            <>
              <Text style={styles.receiptHint}>Receipt is being generated. Please check again shortly.</Text>
              {profile?.role === 'admin' ? (
                <AppButton title="Generate Receipt" variant="secondary" loading={emailReceiptLoading} disabled={emailReceiptLoading} onPress={generateReceipt} />
              ) : null}
            </>
          )}
        </View>
      ) : null}

      {canCancel ? (
        <AppButton title="Cancel Booking" variant="secondary" loading={cancelling} disabled={cancelling} onPress={onCancel} />
      ) : (
        <Text style={styles.lockedText}>
          {isOwner ? 'Approved, rejected, revoked, cancelled, and completed bookings cannot be edited.' : 'Department bookings are read-only unless you created them.'}
        </Text>
      )}
      <ReceiptViewerModal visible={receiptViewerVisible} receipt={receipt} onClose={() => setReceiptViewerVisible(false)} />
    </ScrollView>
  );
}

function DetailRow({ label, value, emphasize }: { label: string; value: string | null | undefined; emphasize?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, emphasize && styles.emphasizedValue]}>{value || 'Not provided'}</Text>
    </View>
  );
}

function formatReceiptEmailStatus(receipt: BookingReceipt) {
  if (receipt.emailStatus === 'manual_sent') return `Manual PDF sent to ${receipt.emailedTo ?? 'requester'}`;
  if (receipt.emailStatus === 'manual_failed') return receipt.emailError ? `Manual PDF failed: ${receipt.emailError}` : 'Manual PDF failed';
  if (receipt.emailedAt) return `Sent to ${receipt.emailedTo ?? 'requester'}`;
  if (receipt.emailStatus === 'not_requested') return 'Email not requested';
  if (receipt.emailStatus === 'queued') return 'Email queued';
  if (receipt.emailStatus === 'pending' || receipt.emailStatus === 'sending' || receipt.emailStatus === 'processing') return 'Email sending';
  if (receipt.emailStatus === 'failed') return receipt.emailError ? `Email failed: ${receipt.emailError}` : 'Email failed';
  return 'Email not sent';
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
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: fontSizes.xl,
    fontWeight: '900'
  },
  meta: {
    color: colors.textMuted,
    fontSize: fontSizes.md,
    fontWeight: '700'
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '900'
  },
  image: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight
  },
  detailRow: {
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
  emphasizedValue: {
    color: colors.primary
  },
  revokedNotice: {
    color: colors.danger,
    fontSize: fontSizes.sm,
    fontWeight: '900',
    lineHeight: 20
  },
  receiptHint: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    lineHeight: 20
  },
  lockedText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 20
  }
});
