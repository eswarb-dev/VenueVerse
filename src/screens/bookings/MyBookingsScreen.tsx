import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps, useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { LoadingView } from '@/components/LoadingView';
import { StatusBadge } from '@/components/StatusBadge';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';
import { EXTRA_TAB_PADDING, TOP_SAFE_AREA_PADDING } from '@/constants/layout';
import { AppStackParamList, UserTabParamList } from '@/navigation/types';
import { getMyDepartmentBookings, getUserBookings } from '@/services/bookingService';
import { debounceRealtimeRefresh, subscribeToBookingChanges } from '@/services/bookingRealtimeService';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/AuthContext';
import { BookingPreview, BookingStatus } from '@/types/venue';

type Props = CompositeScreenProps<
  BottomTabScreenProps<UserTabParamList, 'Bookings'>,
  NativeStackScreenProps<AppStackParamList>
>;
type Filter = 'all' | BookingStatus;
type BookingScope = 'mine' | 'department';

const filters: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Revoked', value: 'revoked' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Completed', value: 'completed' }
];

export function MyBookingsScreen({ navigation }: Props) {
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const { profile, user } = useAuth();
  const [myBookings, setMyBookings] = useState<BookingPreview[]>([]);
  const [departmentBookings, setDepartmentBookings] = useState<BookingPreview[]>([]);
  const [loadedScopes, setLoadedScopes] = useState<Record<BookingScope, boolean>>({ mine: false, department: false });
  const [activeScope, setActiveScope] = useState<BookingScope>('mine');
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadBookings = useCallback(async (scope: BookingScope, forceRefresh = false) => {
    const userId = profile?.id ?? user?.id;
    if (!userId) return;

    setError('');
    if (scope === 'mine') {
      setMyBookings(await getUserBookings(userId, { forceRefresh }));
    } else {
      setDepartmentBookings(await getMyDepartmentBookings({ forceRefresh }));
    }
    setLoadedScopes((current) => ({ ...current, [scope]: true }));
  }, [profile?.id, user?.id]);

  useEffect(() => {
    if (loadedScopes[activeScope]) return;
    setLoading(true);
    loadBookings(activeScope)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load bookings.'))
      .finally(() => setLoading(false));
  }, [activeScope, loadBookings, loadedScopes]);

  useEffect(() => {
    const userId = profile?.id ?? user?.id;
    if (!userId) return;

    const refreshBookings = debounceRealtimeRefresh(() => {
      void loadBookings(activeScope, true).catch((loadError) => {
        if (__DEV__) console.log('[realtime] bookings refresh failed', loadError);
      });
    });

    const channel = subscribeToBookingChanges({
      channelName: `bookings:list:${userId}:${activeScope}`,
      onChange: () => refreshBookings.schedule()
    });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (__DEV__) console.log('[app-state] active refresh');
      refreshBookings.schedule();
    });

    return () => {
      refreshBookings.cancel();
      appStateSubscription.remove();
      supabase.removeChannel(channel);
    };
  }, [activeScope, loadBookings, profile?.id, user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadBookings(activeScope, true);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh bookings.');
    } finally {
      setRefreshing(false);
    }
  };

  const bookings = activeScope === 'mine' ? myBookings : departmentBookings;

  const filteredBookings = useMemo(() => {
    if (activeFilter === 'all') return bookings;
    return bookings.filter((booking) => booking.status === activeFilter);
  }, [activeFilter, bookings]);

  const renderBooking = useCallback(({ item }: { item: BookingPreview }) => (
    <BookingCard
      booking={item}
      currentUserId={profile?.id ?? user?.id ?? null}
      showRequester={activeScope === 'department'}
      onPress={() => navigation.navigate('BookingDetails', { bookingId: item.id })}
    />
  ), [activeScope, navigation, profile?.id, user?.id]);

  if (loading) return <LoadingView message={activeScope === 'mine' ? 'Loading your bookings...' : 'Loading department bookings...'} />;

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + TOP_SAFE_AREA_PADDING,
          paddingBottom: tabBarHeight + EXTRA_TAB_PADDING
        }
      ]}
      data={filteredBookings}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={styles.header}>
          {error ? <ErrorView message={error} onRetry={() => void onRefresh()} /> : null}
          <View style={styles.scopeTabs}>
            <ScopeTab label="My Bookings" active={activeScope === 'mine'} onPress={() => setActiveScope('mine')} />
            <ScopeTab label="Department Bookings" active={activeScope === 'department'} onPress={() => setActiveScope('department')} />
          </View>
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
          title={activeScope === 'mine' ? 'No bookings yet' : 'No department bookings yet'}
          message={
            activeFilter === 'all'
              ? activeScope === 'mine'
                ? 'Your booking requests will appear here.'
                : 'Bookings created by your department users will appear here.'
              : 'No bookings match this status.'
          }
        />
      }
      renderItem={renderBooking}
    />
  );
}

function ScopeTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.scopeTab, active && styles.scopeTabActive]}>
      <Text style={[styles.scopeTabText, active && styles.scopeTabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const BookingCard = memo(function BookingCard({
  booking,
  currentUserId,
  showRequester,
  onPress
}: {
  booking: BookingPreview;
  currentUserId: string | null;
  showRequester: boolean;
  onPress: () => void;
}) {
  const requesterLabel = booking.requesterId === currentUserId
    ? `You${booking.requesterDepartment ? ` • ${booking.requesterDepartment}` : ''}`
    : `${booking.requesterName ?? 'Unknown requester'}${booking.requesterDepartment ? ` • ${booking.requesterDepartment}` : ''}`;
  const venueLabel = `${booking.hallName ?? 'Hall not available'}${booking.hallDepartment ? ` • ${booking.hallDepartment}` : ''}`;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardHeader}>
        <Text style={styles.title}>{booking.eventTitle}</Text>
        <StatusBadge status={booking.status} />
      </View>
      {showRequester ? <Text style={styles.meta}>Requester: {requesterLabel}</Text> : null}
      <Text style={styles.meta}>Venue: {venueLabel}</Text>
      <Text style={styles.time}>{format(new Date(booking.startTime), 'dd MMM yyyy')}</Text>
      <Text style={styles.meta}>
        {format(new Date(booking.startTime), 'h:mm a')} - {format(new Date(booking.endTime), 'h:mm a')}
      </Text>
      {booking.createdAt ? <Text style={styles.created}>Created {format(new Date(booking.createdAt), 'dd MMM yyyy, h:mm a')}</Text> : null}
    </Pressable>
  );
});

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
  scopeTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 4,
    gap: 4
  },
  scopeTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  scopeTabActive: {
    backgroundColor: colors.primary
  },
  scopeTabText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '900',
    textAlign: 'center'
  },
  scopeTabTextActive: {
    color: colors.surface
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
