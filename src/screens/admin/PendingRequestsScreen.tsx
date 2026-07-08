import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { LoadingView } from '@/components/LoadingView';
import { StatusBadge } from '@/components/StatusBadge';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';
import { AdminStackParamList } from '@/navigation/types';
import { getPendingRequests } from '@/services/adminService';
import { AdminBookingSummary } from '@/types/venue';

type Props = NativeStackScreenProps<AdminStackParamList, 'PendingRequests'>;

export function PendingRequestsScreen({ navigation }: Props) {
  const [bookings, setBookings] = useState<AdminBookingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadRequests = useCallback(async () => {
    setError('');
    setBookings(await getPendingRequests());
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadRequests()
        .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load pending requests.'))
        .finally(() => setLoading(false));
    }, [loadRequests])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadRequests();
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh pending requests.');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) return <LoadingView message="Loading pending requests..." />;

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={styles.content}
      data={bookings}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={error ? <ErrorView message={error} onRetry={() => void onRefresh()} /> : null}
      ListEmptyComponent={<EmptyState title="No pending requests" message="New booking requests will appear here for review." />}
      renderItem={({ item }) => (
        <AdminBookingCard booking={item} onPress={() => navigation.navigate('BookingReview', { bookingId: item.id })} />
      )}
    />
  );
}

export function AdminBookingCard({ booking, onPress }: { booking: AdminBookingSummary; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardHeader}>
        <Text style={styles.title}>{booking.eventTitle}</Text>
        <StatusBadge status={booking.status} />
      </View>
      <View style={styles.infoGrid}>
        <Info label="Requested by" value={booking.requesterName ?? 'Unknown'} />
        <Info label="Department" value={booking.resolvedDepartment ?? 'Not provided'} />
        <Info label="Hall" value={booking.hallName ?? 'Hall unavailable'} />
      </View>
      <Text style={styles.time}>
        {format(new Date(booking.startTime), 'dd MMM yyyy')} • {format(new Date(booking.startTime), 'h:mm a')} - {format(new Date(booking.endTime), 'h:mm a')}
      </Text>
    </Pressable>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: spacing.md,
    gap: spacing.md
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md
  },
  pressed: {
    opacity: 0.75
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '900'
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md
  },
  infoItem: {
    width: '47%'
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  infoValue: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '800',
    marginTop: spacing.xs
  },
  time: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  }
});
