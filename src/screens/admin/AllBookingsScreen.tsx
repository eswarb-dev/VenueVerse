import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { LoadingView } from '@/components/LoadingView';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';
import { AdminStackParamList } from '@/navigation/types';
import { getAllAdminBookings } from '@/services/adminService';
import { AdminBookingSummary, BookingStatus } from '@/types/venue';
import { AdminBookingCard } from '@/screens/admin/PendingRequestsScreen';

type Props = NativeStackScreenProps<AdminStackParamList, 'AllBookings'>;

const departmentFilters = [
  'All',
  'IT',
  'AI&DS',
  'EEE',
  'ECE',
  'BME',
  'CSE',
  'CIVIL',
  'AERO',
  'MBA',
  'NANO',
  'MECH',
  'EIE',
  'Library',
  'Administrative Office',
  'Others'
];

export function AllBookingsScreen({ navigation, route }: Props) {
  const [bookings, setBookings] = useState<AdminBookingSummary[]>([]);
  const statusFilter = route.params?.status;
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadBookings = useCallback(async () => {
    setError('');
    setBookings(await getAllAdminBookings(statusFilter));
  }, [statusFilter]);

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
      await loadBookings();
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh bookings.');
    } finally {
      setRefreshing(false);
    }
  };

  const filteredBookings = useMemo(() => {
    const nextBookings =
      selectedDepartment === 'All'
        ? bookings
        : bookings.filter((booking) => booking.resolvedDepartment === selectedDepartment);

    return [...nextBookings].sort(sortBookingsNewestFirst);
  }, [bookings, selectedDepartment]);

  if (loading) return <LoadingView message={`Loading ${getAllBookingsTitle(statusFilter).toLowerCase()}...`} />;

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
          <DepartmentFilterRow selectedDepartment={selectedDepartment} onSelect={setSelectedDepartment} />
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          title={getEmptyTitle(statusFilter, selectedDepartment)}
          message={getEmptyMessage(statusFilter, selectedDepartment)}
        />
      }
      renderItem={({ item }) => (
        <AdminBookingCard booking={item} onPress={() => navigation.navigate('BookingReview', { bookingId: item.id })} />
      )}
    />
  );
}

function DepartmentFilterRow({
  selectedDepartment,
  onSelect
}: {
  selectedDepartment: string;
  onSelect: (department: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.departmentRow}
    >
      {departmentFilters.map((department) => {
        const active = selectedDepartment === department;
        return (
          <Pressable
            key={department}
            onPress={() => onSelect(department)}
            style={[styles.departmentChip, active && styles.departmentChipActive]}
          >
            <Text style={[styles.departmentChipText, active && styles.departmentChipTextActive]}>
              {department}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function getAllBookingsTitle(status?: BookingStatus) {
  if (status === 'approved') return 'Approved Bookings';
  if (status === 'rejected') return 'Rejected Bookings';
  if (status === 'pending') return 'Pending Bookings';
  if (status === 'cancelled') return 'Cancelled Bookings';
  if (status === 'completed') return 'Completed Bookings';
  return 'All Bookings';
}

function getEmptyTitle(status?: BookingStatus, department = 'All') {
  const departmentSuffix = department === 'All' ? '' : ` for ${department}`;
  if (status === 'approved') return `No approved bookings found${departmentSuffix}.`;
  if (status === 'rejected') return `No rejected bookings found${departmentSuffix}.`;
  if (status === 'pending') return `No pending bookings found${departmentSuffix}.`;
  if (status === 'cancelled') return `No cancelled bookings found${departmentSuffix}.`;
  if (status === 'completed') return `No completed bookings found${departmentSuffix}.`;
  if (department !== 'All') return `No bookings found for ${department}.`;
  return 'No bookings found';
}

function getEmptyMessage(status?: BookingStatus, department = 'All') {
  if (status && department !== 'All') return 'Bookings matching this status and department will appear here.';
  if (status) return 'Bookings matching this status will appear here.';
  if (department !== 'All') return 'Bookings from this department will appear here.';
  return 'All submitted bookings will appear here.';
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
  departmentRow: {
    gap: spacing.sm,
    paddingRight: spacing.md
  },
  departmentChip: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface
  },
  departmentChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  departmentChipText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  departmentChipTextActive: {
    color: colors.surface
  }
});
