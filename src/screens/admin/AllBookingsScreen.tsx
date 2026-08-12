import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { BottomTabScreenProps, useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { LoadingView } from '@/components/LoadingView';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';
import { EXTRA_TAB_PADDING, TOP_SAFE_AREA_PADDING } from '@/constants/layout';
import { AdminStackParamList, AdminTabParamList } from '@/navigation/types';
import { getAllAdminBookings } from '@/services/adminService';
import { useAuth } from '@/store/AuthContext';
import { AdminBookingSummary, BookingStatus } from '@/types/venue';
import { AdminBookingCard } from '@/screens/admin/PendingRequestsScreen';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AdminTabParamList, 'Bookings'>,
  NativeStackScreenProps<AdminStackParamList>
>;

export function AllBookingsScreen({ navigation, route }: Props) {
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const [bookings, setBookings] = useState<AdminBookingSummary[]>([]);
  const statusFilter = route.params?.status;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  const loadBookings = useCallback(async (forceRefresh = false) => {
    setError('');
    setBookings(await getAllAdminBookings(statusFilter, profile, { forceRefresh }));
  }, [profile, statusFilter]);

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ title: getAllBookingsTitle(statusFilter) });
      setLoading(true);
      loadBookings()
        .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load bookings.'))
        .finally(() => setLoading(false));
    }, [loadBookings, navigation, statusFilter])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadBookings(true);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh bookings.');
    } finally {
      setRefreshing(false);
    }
  };

  const filteredBookings = useMemo(() => [...bookings].sort(sortBookingsNewestFirst), [bookings]);
  const renderBooking = useCallback(({ item }: { item: AdminBookingSummary }) => (
    <AdminBookingCard booking={item} onPress={() => navigation.navigate('BookingReview', { bookingId: item.id })} />
  ), [navigation]);

  if (loading) return <LoadingView message={`Loading ${getAllBookingsTitle(statusFilter).toLowerCase()}...`} />;

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
          <Text style={styles.scopeText}>{isSuperAdmin ? 'Showing bookings across all departments.' : 'Showing bookings for venues in your department.'}</Text>
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          title={getEmptyTitle(statusFilter)}
          message={getEmptyMessage(statusFilter)}
        />
      }
      renderItem={renderBooking}
    />
  );
}

function getAllBookingsTitle(status?: BookingStatus) {
  if (status === 'approved') return 'Approved Bookings';
  if (status === 'rejected') return 'Rejected Bookings';
  if (status === 'revoked') return 'Revoked Bookings';
  if (status === 'pending') return 'Pending Bookings';
  if (status === 'cancelled') return 'Cancelled Bookings';
  if (status === 'completed') return 'Completed Bookings';
  return 'All Bookings';
}

function getEmptyTitle(status?: BookingStatus) {
  if (status === 'approved') return 'No approved bookings found.';
  if (status === 'rejected') return 'No rejected bookings found.';
  if (status === 'revoked') return 'No revoked bookings found.';
  if (status === 'pending') return 'No pending bookings found.';
  if (status === 'cancelled') return 'No cancelled bookings found.';
  if (status === 'completed') return 'No completed bookings found.';
  return 'No bookings found';
}

function getEmptyMessage(status?: BookingStatus) {
  if (status) return 'Bookings matching this status for your department venues will appear here.';
  return 'Bookings for your department venues will appear here.';
}

function sortBookingsNewestFirst(a: AdminBookingSummary, b: AdminBookingSummary) {
  return getSortTime(b) - getSortTime(a);
}

function getSortTime(booking: AdminBookingSummary) {
  const value = booking.createdAt ?? booking.updatedAt ?? booking.startTime;
  return new Date(value).getTime();
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
    gap: spacing.md,
    marginBottom: spacing.md
  },
  scopeText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '800'
  }
});
