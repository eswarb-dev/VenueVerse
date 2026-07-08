import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { LoadingView } from '@/components/LoadingView';
import { StatusBadge } from '@/components/StatusBadge';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';
import { AppStackParamList } from '@/navigation/types';
import { getUserBookings } from '@/services/bookingService';
import { useAuth } from '@/store/AuthContext';
import { BookingPreview, BookingStatus } from '@/types/venue';

type Props = NativeStackScreenProps<AppStackParamList, 'Bookings'>;
type Filter = 'all' | BookingStatus;

const filters: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Completed', value: 'completed' }
];

export function MyBookingsScreen({ navigation }: Props) {
  const { profile, user } = useAuth();
  const [bookings, setBookings] = useState<BookingPreview[]>([]);
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadBookings = useCallback(async () => {
    const userId = profile?.id ?? user?.id;
    if (!userId) return;

    setError('');
    setBookings(await getUserBookings(userId));
  }, [profile?.id, user?.id]);

  useEffect(() => {
    setLoading(true);
    loadBookings()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load bookings.'))
      .finally(() => setLoading(false));
  }, [loadBookings]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadBookings();
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh bookings.');
    } finally {
      setRefreshing(false);
    }
  };

  const filteredBookings = useMemo(() => {
    if (activeFilter === 'all') return bookings;
    return bookings.filter((booking) => booking.status === activeFilter);
  }, [activeFilter, bookings]);

  if (loading) return <LoadingView message="Loading your bookings..." />;

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={styles.content}
      data={filteredBookings}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={styles.header}>
          {error ? <ErrorView message={error} onRetry={() => void onRefresh()} /> : null}
          <FlatList
            horizontal
            data={filters}
            keyExtractor={(item) => item.value}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setActiveFilter(item.value)}
                style={[styles.filterChip, activeFilter === item.value && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, activeFilter === item.value && styles.filterTextActive]}>{item.label}</Text>
              </Pressable>
            )}
          />
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          title="No bookings found"
          message={activeFilter === 'all' ? 'Your booking requests will appear here.' : 'No bookings match this status.'}
        />
      }
      renderItem={({ item }) => (
        <BookingCard booking={item} onPress={() => navigation.navigate('BookingDetails', { bookingId: item.id })} />
      )}
    />
  );
}

function BookingCard({ booking, onPress }: { booking: BookingPreview; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardHeader}>
        <Text style={styles.title}>{booking.eventTitle}</Text>
        <StatusBadge status={booking.status} />
      </View>
      <Text style={styles.meta}>{booking.hallName ?? 'Hall not available'}</Text>
      <Text style={styles.time}>{format(new Date(booking.startTime), 'dd MMM yyyy')}</Text>
      <Text style={styles.meta}>
        {format(new Date(booking.startTime), 'h:mm a')} - {format(new Date(booking.endTime), 'h:mm a')}
      </Text>
      {booking.createdAt ? <Text style={styles.created}>Created {format(new Date(booking.createdAt), 'dd MMM yyyy, h:mm a')}</Text> : null}
    </Pressable>
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
  header: {
    gap: spacing.md
  },
  filters: {
    gap: spacing.sm
  },
  filterChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  filterText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '800'
  },
  filterTextActive: {
    color: colors.surface
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs
  },
  pressed: {
    opacity: 0.75
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '900'
  },
  meta: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700'
  },
  time: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  created: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: '700'
  }
});
