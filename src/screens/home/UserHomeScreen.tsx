import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { LoadingView } from '@/components/LoadingView';
import { StatusBadge } from '@/components/StatusBadge';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';
import { useNotifications } from '@/hooks/useNotifications';
import { AppStackParamList } from '@/navigation/types';
import { getRecentUserBookings, getTodayBookedHalls, getUserBookingStats } from '@/services/bookingService';
import { useAuth } from '@/store/AuthContext';
import { BookingPreview, BookingStats, TodayBookedHall } from '@/types/venue';

type Props = NativeStackScreenProps<AppStackParamList, 'Home'>;

export function UserHomeScreen({ navigation }: Props) {
  const { profile, user } = useAuth();
  const { unreadCount, fetchUnreadCount } = useNotifications();
  const canUseAdminArea = profile?.role === 'admin' || profile?.role === 'super_admin';
  const [stats, setStats] = useState<BookingStats>({ pending: 0, approved: 0, rejected: 0 });
  const [recentBookings, setRecentBookings] = useState<BookingPreview[]>([]);
  const [todayBookedHalls, setTodayBookedHalls] = useState<TodayBookedHall[]>([]);
  const [todayBookingsLoading, setTodayBookingsLoading] = useState(true);
  const [todayBookingsError, setTodayBookingsError] = useState('');
  const [todayModalVisible, setTodayModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadHome = useCallback(async () => {
    const userId = profile?.id ?? user?.id;
    if (!userId) return;

    setError('');
    setTodayBookingsError('');
    setTodayBookingsLoading(true);
    try {
      const [nextStats, nextRecentBookings, nextTodayBookedHalls] = await Promise.all([
        getUserBookingStats(userId),
        getRecentUserBookings(userId),
        getTodayBookedHalls().catch((todayError) => {
          setTodayBookingsError(todayError instanceof Error ? todayError.message : 'Failed to load today\'s booked halls.');
          return [];
        }),
        fetchUnreadCount()
      ]);
      setStats(nextStats);
      setRecentBookings(nextRecentBookings);
      setTodayBookedHalls(nextTodayBookedHalls);
    } finally {
      setTodayBookingsLoading(false);
    }
  }, [fetchUnreadCount, profile?.id, user?.id]);

  useEffect(() => {
    setLoading(true);
    loadHome()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard.'))
      .finally(() => setLoading(false));
  }, [loadHome]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadHome();
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh dashboard.');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) return <LoadingView message="Loading your dashboard..." />;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('Profile')}
        style={({ pressed }) => [styles.hero, pressed && styles.heroPressed]}
      >
        <View style={styles.heroText}>
          <Text style={styles.eyebrow}>Welcome</Text>
          <Text style={styles.title}>{profile?.fullName ?? 'Campus Member'}</Text>
          <Text style={styles.subtitle}>Manage venue requests and stay current with approvals.</Text>
          <Text style={styles.profileHint}>Tap to view profile</Text>
        </View>
        <Pressable
          style={styles.notificationButton}
          accessibilityRole="button"
          onPress={(event) => {
            event.stopPropagation();
            navigation.navigate('Notifications');
          }}
        >
          <Ionicons name="notifications-outline" size={24} color={colors.primary} />
          {unreadCount > 0 ? <Text style={styles.notificationCount}>{unreadCount}</Text> : null}
        </Pressable>
      </Pressable>

      {error ? <ErrorView message={error} onRetry={() => void onRefresh()} /> : null}

      <View style={styles.statsGrid}>
        <StatCard label="Pending" value={stats.pending} color={colors.status.pending} />
        <StatCard label="Approved" value={stats.approved} color={colors.status.approved} />
        <StatCard label="Rejected" value={stats.rejected} color={colors.status.rejected} />
      </View>

      <AppButton title="Book a Venue" onPress={() => navigation.navigate('Halls')} />

      <TodayBookedHallsSummary
        count={todayBookedHalls.length}
        loading={todayBookingsLoading}
        error={Boolean(todayBookingsError)}
        onPress={() => setTodayModalVisible(true)}
      />

      <TodayBookedHallsModal
        visible={todayModalVisible}
        bookings={todayBookedHalls}
        loading={todayBookingsLoading}
        error={Boolean(todayBookingsError)}
        onClose={() => setTodayModalVisible(false)}
      />

      {canUseAdminArea ? (
        <View style={styles.adminCard}>
          <View style={styles.adminCopy}>
            <Text style={styles.adminEyebrow}>Administration</Text>
            <Text style={styles.adminTitle}>Venue operations</Text>
            <Text style={styles.adminBody}>Review requests and manage institutional booking controls.</Text>
          </View>
          <AppButton title="Open Admin Area" variant="secondary" onPress={() => navigation.navigate('AdminArea')} />
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent bookings</Text>
        <Pressable onPress={() => navigation.navigate('Bookings')}>
          <Text style={styles.sectionLink}>View all</Text>
        </Pressable>
      </View>

      {recentBookings.length === 0 ? (
        <EmptyState title="No recent bookings" message="Your venue requests will appear here once submitted." />
      ) : (
        recentBookings.map((booking) => <RecentBookingCard key={booking.id} booking={booking} />)
      )}
    </ScrollView>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RecentBookingCard({ booking }: { booking: BookingPreview }) {
  return (
    <View style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        <Text style={styles.bookingTitle}>{booking.eventTitle}</Text>
        <StatusBadge status={booking.status} />
      </View>
      <Text style={styles.bookingMeta}>{booking.hallName ?? 'Venue pending'}</Text>
      <Text style={styles.bookingMeta}>{formatRecentBookingTime(booking.startTime, booking.endTime)}</Text>
    </View>
  );
}

function TodayBookedHallsSummary({
  count,
  loading,
  error,
  onPress
}: {
  count: number;
  loading: boolean;
  error: boolean;
  onPress: () => void;
}) {
  const subtitle = loading
    ? 'Loading today\'s bookings...'
    : error
      ? 'Failed to load today\'s booked halls.'
      : count === 0
        ? 'No halls booked today'
        : `${count} ${count === 1 ? 'venue' : 'venues'} booked today`;
  const body = loading || error
    ? 'Tap to refresh the latest schedule after loading completes.'
    : count === 0
      ? 'All venues are currently free for today\'s sessions.'
      : 'Tap to view today\'s schedule';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.todaySummaryCard, pressed && styles.pressedCard]}>
      <View style={styles.todaySummaryHeader}>
        <View style={styles.todaySummaryCopy}>
          <Text style={styles.sectionTitle}>Today's Booked Halls</Text>
          <Text style={[styles.todaySummarySubtitle, error && styles.errorText]}>{subtitle}</Text>
          <Text style={styles.infoText}>{body}</Text>
        </View>
        <Ionicons name="calendar-outline" size={24} color={colors.primary} />
      </View>
      <Text style={styles.todaySummaryAction}>View booked halls</Text>
    </Pressable>
  );
}

function TodayBookedHallsModal({
  visible,
  bookings,
  loading,
  error,
  onClose
}: {
  visible: boolean;
  bookings: TodayBookedHall[];
  loading: boolean;
  error: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.todaySheet}>
          <View style={styles.todaySheetHeader}>
            <Text style={styles.todaySheetTitle}>Today's Booked Halls</Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.todaySheetList} contentContainerStyle={styles.todaySheetListContent}>
            {loading ? (
              <View style={styles.infoCard}>
                <Text style={styles.infoText}>Loading today's booked halls...</Text>
              </View>
            ) : error ? (
              <View style={styles.infoCard}>
                <Text style={styles.errorText}>Failed to load today's booked halls.</Text>
              </View>
            ) : bookings.length === 0 ? (
              <EmptyState title="No halls booked today" message="All venues are currently free for today's sessions." />
            ) : (
              bookings.map((booking) => <TodayBookedHallCard key={booking.bookingId} booking={booking} />)
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TodayBookedHallCard({ booking }: { booking: TodayBookedHall }) {
  const displayName = getTodayBookedHallDisplayName(booking);

  return (
    <View style={styles.todayCard}>
      <View style={styles.bookingHeader}>
        <Text style={styles.bookingTitle}>{displayName}</Text>
        <StatusBadge status={booking.status} />
      </View>
      <Text style={styles.todayTime}>{formatTimeRange(booking.startTime, booking.endTime)}</Text>
      <Text style={styles.bookingMeta}>{booking.eventTitle}</Text>
      <Text style={styles.bookingMeta}>{booking.location || booking.department || 'Campus venue'}</Text>
    </View>
  );
}

function formatTimeRange(startTime: string, endTime: string) {
  return `${format(new Date(startTime), 'h:mm a')} - ${format(new Date(endTime), 'h:mm a')}`;
}

function formatRecentBookingTime(startTime: string, endTime: string) {
  return `${format(new Date(startTime), 'dd MMM yyyy')}, ${formatTimeRange(startTime, endTime)}`;
}

function getTodayBookedHallDisplayName(booking: TodayBookedHall) {
  if (booking.department === 'Library') return 'Library Seminar Hall';
  if (booking.department === 'Others' && booking.venueType === 'Auditorium') return 'Others Auditorium';
  if (booking.department && booking.venueType) return `${booking.department} ${booking.venueType}`;
  return booking.hallName;
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
  hero: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.card
  },
  heroPressed: {
    opacity: 0.88
  },
  heroText: {
    flex: 1,
    gap: spacing.xs
  },
  eyebrow: {
    color: colors.onPrimaryMuted,
    fontSize: fontSizes.xs,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  title: {
    color: colors.surface,
    fontSize: fontSizes.xl,
    fontWeight: '900'
  },
  subtitle: {
    color: colors.onPrimarySubtle,
    fontSize: fontSizes.sm,
    lineHeight: 20
  },
  profileHint: {
    color: colors.onPrimaryMuted,
    fontSize: fontSizes.xs,
    fontWeight: '800',
    marginTop: spacing.xs
  },
  notificationButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface
  },
  notificationCount: {
    position: 'absolute',
    top: -4,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.status.rejected,
    color: colors.surface,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center'
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
    ...shadows.card
  },
  statValue: {
    fontSize: fontSizes.xl,
    fontWeight: '900'
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: '800'
  },
  adminCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.card
  },
  adminCopy: {
    gap: spacing.xs
  },
  adminEyebrow: {
    color: colors.primary,
    fontSize: fontSizes.xs,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  adminTitle: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '900'
  },
  adminBody: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    lineHeight: 20
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '900'
  },
  sectionLink: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.card
  },
  infoText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700'
  },
  errorText: {
    color: colors.status.rejected,
    fontSize: fontSizes.sm,
    fontWeight: '800'
  },
  todaySummaryCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card
  },
  todaySummaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  todaySummaryCopy: {
    flex: 1,
    gap: spacing.xs
  },
  todaySummarySubtitle: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  todaySummaryAction: {
    alignSelf: 'flex-start',
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  bookingCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
    ...shadows.card
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  bookingTitle: {
    flex: 1,
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '900'
  },
  bookingMeta: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '600'
  },
  todayCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
    ...shadows.card
  },
  pressedCard: {
    opacity: 0.75
  },
  todayTime: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(16, 24, 40, 0.35)'
  },
  todaySheet: {
    maxHeight: '82%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden'
  },
  todaySheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  todaySheetTitle: {
    color: colors.text,
    flex: 1,
    fontSize: fontSizes.lg,
    fontWeight: '900'
  },
  closeButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  closeText: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  todaySheetList: {
    maxHeight: '100%'
  },
  todaySheetListContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl
  }
});
