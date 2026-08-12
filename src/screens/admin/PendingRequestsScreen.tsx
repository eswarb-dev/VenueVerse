import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { BottomTabScreenProps, useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { memo, useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { LoadingView } from '@/components/LoadingView';
import { StatusBadge } from '@/components/StatusBadge';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';
import { EXTRA_TAB_PADDING, TOP_SAFE_AREA_PADDING } from '@/constants/layout';
import { AdminStackParamList, AdminTabParamList } from '@/navigation/types';
import { getPendingRequests } from '@/services/adminService';
import { useAuth } from '@/store/AuthContext';
import { AdminBookingSummary } from '@/types/venue';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AdminTabParamList, 'Requests'>,
  NativeStackScreenProps<AdminStackParamList>
>;

export function PendingRequestsScreen({ navigation }: Props) {
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<AdminBookingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadRequests = useCallback(async (forceRefresh = false) => {
    setError('');
    setBookings(await getPendingRequests(profile, { forceRefresh }));
  }, [profile]);
  const isSuperAdmin = profile?.role === 'super_admin';

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
      await loadRequests(true);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh pending requests.');
    } finally {
      setRefreshing(false);
    }
  };

  const renderBooking = useCallback(({ item }: { item: AdminBookingSummary }) => (
    <AdminBookingCard booking={item} readOnly={isSuperAdmin} onPress={() => navigation.navigate('BookingReview', { bookingId: item.id })} />
  ), [isSuperAdmin, navigation]);

  if (loading) return <LoadingView message={isSuperAdmin ? 'Loading global pending requests...' : 'Loading pending requests...'} />;

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
      data={bookings}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={styles.header}>
          {error ? <ErrorView message={error} onRetry={() => void onRefresh()} /> : null}
          {isSuperAdmin ? (
            <View style={styles.auditBanner}>
              <Text style={styles.auditTitle}>Global Pending Requests</Text>
              <Text style={styles.auditText}>Read-only view of pending booking requests across all departments. Department admins handle approvals.</Text>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={<EmptyState title={isSuperAdmin ? 'No global pending requests' : 'No pending requests'} message={isSuperAdmin ? 'Pending bookings across all departments will appear here.' : 'New booking requests will appear here for review.'} />}
      renderItem={renderBooking}
    />
  );
}

export const AdminBookingCard = memo(function AdminBookingCard({ booking, onPress, readOnly = false }: { booking: AdminBookingSummary; onPress: () => void; readOnly?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardHeader}>
        <Text style={styles.title}>{booking.eventTitle}</Text>
        <StatusBadge status={booking.status} />
      </View>
      <View style={styles.infoGrid}>
        <Info label="Requested by" value={booking.requesterName ?? 'Unknown'} />
        <Info label="Requester Dept" value={booking.requesterDepartment ?? 'Not provided'} />
        <Info label="Venue Dept" value={booking.resolvedDepartment ?? 'Not provided'} />
        <Info label="Hall" value={booking.hallName ?? 'Hall unavailable'} />
      </View>
      {readOnly ? <Text style={styles.auditNote}>Read-only audit view. Assigned approver: {booking.resolvedDepartment ?? 'venue department'} admin.</Text> : null}
      <Text style={styles.time}>
        {format(new Date(booking.startTime), 'dd MMM yyyy')} • {format(new Date(booking.startTime), 'h:mm a')} - {format(new Date(booking.endTime), 'h:mm a')}
      </Text>
      {booking.status === 'revoked' ? (
        <View style={styles.revokedInfo}>
          <Info label="Revoked on" value={booking.revokedAt ? format(new Date(booking.revokedAt), 'dd MMM yyyy, h:mm a') : 'Unknown'} />
          <Info label="Reason" value={booking.revocationReason ?? 'No reason provided'} />
        </View>
      ) : null}
    </Pressable>
  );
});

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
  header: {
    gap: spacing.md,
    marginBottom: spacing.sm
  },
  auditBanner: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs
  },
  auditTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '900'
  },
  auditText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    lineHeight: 20
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
  },
  revokedInfo: {
    marginTop: spacing.sm,
    gap: spacing.xs
  },
  auditNote: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: '800',
    lineHeight: 18
  }
});
