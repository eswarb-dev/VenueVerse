import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { formatLocation } from '@/components/HallCard';
import { LoadingView } from '@/components/LoadingView';
import { StatusBadge } from '@/components/StatusBadge';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';
import { AppStackParamList } from '@/navigation/types';
import { cancelBooking, getBookingDetails } from '@/services/bookingService';
import { BookingDetails } from '@/types/venue';

type Props = NativeStackScreenProps<AppStackParamList, 'BookingDetails'>;

export function BookingDetailsScreen({ route, navigation }: Props) {
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  const loadBooking = useCallback(async () => {
    setError('');
    setBooking(await getBookingDetails(route.params.bookingId));
  }, [route.params.bookingId]);

  useEffect(() => {
    setLoading(true);
    loadBooking()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load booking details.'))
      .finally(() => setLoading(false));
  }, [loadBooking]);

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

  if (loading) return <LoadingView message="Loading booking details..." />;
  if (error && !booking) return <View style={styles.screen}><ErrorView message={error} onRetry={() => void loadBooking()} /></View>;
  if (!booking) return <View style={styles.screen}><EmptyState title="Booking not found" message="This request may no longer exist." /></View>;

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

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Event details</Text>
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
        <DetailRow label="Created" value={booking.createdAt ? format(new Date(booking.createdAt), 'dd MMM yyyy, h:mm a') : null} />
        <DetailRow label="Updated" value={booking.updatedAt ? format(new Date(booking.updatedAt), 'dd MMM yyyy, h:mm a') : null} />
      </View>

      {booking.status === 'pending' ? (
        <AppButton title="Cancel Booking" variant="secondary" loading={cancelling} disabled={cancelling} onPress={onCancel} />
      ) : (
        <Text style={styles.lockedText}>Approved, rejected, cancelled, and completed bookings cannot be edited.</Text>
      )}
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
  lockedText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 20
  }
});
