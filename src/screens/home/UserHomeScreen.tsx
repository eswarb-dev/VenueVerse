import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps, useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/AppButton';
import { AppLogoMark } from '@/components/AppLogoMark';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { LoadingView } from '@/components/LoadingView';
import { RejectReasonDialog } from '@/components/RejectReasonDialog';
import { StatusBadge } from '@/components/StatusBadge';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';
import { EXTRA_TAB_PADDING, TOP_SAFE_AREA_PADDING } from '@/constants/layout';
import { normalizeVenueType } from '@/constants/venueTypes';
import { useNotifications } from '@/hooks/useNotifications';
import { AppStackParamList, UserTabParamList } from '@/navigation/types';
import { approveBookingRequest, getDepartmentPendingApprovalRequests, rejectBookingRequest } from '@/services/bookingApprovalService';
import { getTodayBookedHalls, getUserBookingStats } from '@/services/bookingService';
import { debounceRealtimeRefresh, subscribeToBookingChanges } from '@/services/bookingRealtimeService';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/AuthContext';
import { BookingStats, DepartmentApprovalRequest, TodayBookedHall } from '@/types/venue';

const VENUEVERSE_SUPER_ADMIN_EMAIL = 'venueverse.srec@gmail.com';

type Props = CompositeScreenProps<
  BottomTabScreenProps<UserTabParamList, 'Home'>,
  NativeStackScreenProps<AppStackParamList>
>;

export function UserHomeScreen({ navigation }: Props) {
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const { profile, user } = useAuth();
  const { unreadCount, fetchUnreadCount } = useNotifications();
  const canUseAdminArea = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isVenueVerseAccount = isVenueVerseEmail(profile?.email);
  const [stats, setStats] = useState<BookingStats>({ pending: 0, approved: 0, rejected: 0 });
  const [todayBookedHalls, setTodayBookedHalls] = useState<TodayBookedHall[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<DepartmentApprovalRequest[]>([]);
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [reviewingBookingId, setReviewingBookingId] = useState<string | null>(null);
  const [rejectRequest, setRejectRequest] = useState<DepartmentApprovalRequest | null>(null);
  const [todayBookingsLoading, setTodayBookingsLoading] = useState(true);
  const [todayBookingsError, setTodayBookingsError] = useState('');
  const [todayModalVisible, setTodayModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadTodayBookedHalls = useCallback(async () => {
    setTodayBookingsError('');
    setTodayBookingsLoading(true);
    try {
      setTodayBookedHalls(await getTodayBookedHalls());
    } catch (todayError) {
      setTodayBookingsError(todayError instanceof Error ? todayError.message : 'Failed to load today\'s booked halls.');
      setTodayBookedHalls([]);
    } finally {
      setTodayBookingsLoading(false);
    }
  }, []);

  const loadHome = useCallback(async (forceRefresh = false, includeToday = true) => {
    const userId = profile?.id ?? user?.id;
    if (!userId) return;

    setError('');
    const [nextStats, nextApprovalRequests] = await Promise.all([
      getUserBookingStats(userId, { forceRefresh }),
      profile?.role === 'admin' ? getDepartmentPendingApprovalRequests().catch(() => []) : Promise.resolve([])
    ]);
    setStats(nextStats);
    setApprovalRequests(nextApprovalRequests);
    if (includeToday) void loadTodayBookedHalls();
  }, [loadTodayBookedHalls, profile?.id, profile?.role, user?.id]);

  useEffect(() => {
    setLoading(true);
    loadHome()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard.'))
      .finally(() => setLoading(false));
  }, [loadHome]);

  useEffect(() => {
    const userId = profile?.id ?? user?.id;
    if (!userId) return;

    const refreshHome = debounceRealtimeRefresh(() => {
      void loadHome(true, false).catch((loadError) => {
        if (__DEV__) console.log('[realtime] home refresh failed', loadError);
      });
    });

    const channel = subscribeToBookingChanges({
      channelName: `bookings:home:${userId}`,
      onChange: () => refreshHome.schedule()
    });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (__DEV__) console.log('[app-state] active refresh');
      refreshHome.schedule();
    });

    return () => {
      refreshHome.cancel();
      appStateSubscription.remove();
      supabase.removeChannel(channel);
    };
  }, [loadHome, profile?.id, user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadHome(true, false), loadTodayBookedHalls()]);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh dashboard.');
    } finally {
      setRefreshing(false);
    }
  };

  const reviewRequest = async (request: DepartmentApprovalRequest, action: 'approve' | 'reject', rejectionReason?: string) => {
    setReviewingBookingId(request.id);
    try {
      if (action === 'approve') {
        await approveBookingRequest({
          bookingId: request.id,
          requesterId: request.requesterId,
          eventTitle: request.eventTitle
        });
      } else {
        await rejectBookingRequest({
          bookingId: request.id,
          remarks: rejectionReason ?? '',
          requesterId: request.requesterId,
          eventTitle: request.eventTitle
        });
      }
      await loadHome();
      setRejectRequest(null);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Unable to review booking request.');
    } finally {
      setReviewingBookingId(null);
    }
  };

  if (loading) return <LoadingView message="Loading your dashboard..." />;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + TOP_SAFE_AREA_PADDING,
          paddingBottom: tabBarHeight + EXTRA_TAB_PADDING
        }
      ]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('Profile')}
        style={({ pressed }) => [styles.hero, pressed && styles.heroPressed]}
      >
        <View style={styles.heroText}>
          <View style={styles.heroBrandRow}>
            {isVenueVerseAccount ? (
              <AppLogoMark size={34} contained={false} />
            ) : (
              <View style={styles.heroAvatar}>
                <Text style={styles.heroAvatarText}>{getInitial(profile?.fullName)}</Text>
              </View>
            )}
            <Text style={styles.eyebrow}>Welcome</Text>
          </View>
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

      {profile?.role === 'admin' && approvalRequests.length > 0 ? (
        <PendingApprovalRequestsCard
          requests={approvalRequests}
          reviewingBookingId={reviewingBookingId}
          onApprove={(request) => reviewRequest(request, 'approve')}
          onReject={setRejectRequest}
          onViewAll={() => setApprovalModalVisible(true)}
        />
      ) : null}

      <PendingApprovalRequestsModal
        visible={profile?.role === 'admin' && approvalModalVisible}
        requests={approvalRequests}
        reviewingBookingId={reviewingBookingId}
        onApprove={(request) => reviewRequest(request, 'approve')}
        onReject={setRejectRequest}
        onClose={() => setApprovalModalVisible(false)}
      />

      <RejectReasonDialog
        visible={Boolean(rejectRequest)}
        eventTitle={rejectRequest?.eventTitle}
        venueName={rejectRequest?.hallName}
        loading={Boolean(rejectRequest && reviewingBookingId === rejectRequest.id)}
        onCancel={() => {
          if (!reviewingBookingId) setRejectRequest(null);
        }}
        onSubmit={(reason) => {
          if (rejectRequest) void reviewRequest(rejectRequest, 'reject', reason);
        }}
      />

      <AppButton title="Book a Venue" onPress={() => navigation.navigate('Book')} />

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

      <VenueScheduleSummary onPress={() => navigation.navigate('VenueSchedule')} />

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
    </ScrollView>
  );
}

function PendingApprovalRequestsCard({
  requests,
  reviewingBookingId,
  onApprove,
  onReject,
  onViewAll
}: {
  requests: DepartmentApprovalRequest[];
  reviewingBookingId: string | null;
  onApprove: (request: DepartmentApprovalRequest) => void;
  onReject: (request: DepartmentApprovalRequest) => void;
  onViewAll: () => void;
}) {
  const visibleRequests = requests.slice(0, 2);

  return (
    <View style={styles.approvalCard}>
      <View style={styles.approvalHeader}>
        <View style={styles.approvalHeaderCopy}>
          <Text style={styles.approvalEyebrow}>Department Requests</Text>
          <Text style={styles.sectionTitle}>Pending Approval Requests</Text>
          <Text style={styles.infoText}>{requests.length} {requests.length === 1 ? 'request needs' : 'requests need'} your action</Text>
        </View>
        {requests.length > 2 ? (
          <Pressable onPress={onViewAll} style={styles.viewAllButton}>
            <Text style={styles.sectionLink}>View all</Text>
          </Pressable>
        ) : null}
      </View>
      {visibleRequests.map((request) => (
        <ApprovalRequestCard
          key={request.id}
          request={request}
          reviewing={reviewingBookingId === request.id}
          onApprove={() => onApprove(request)}
          onReject={() => onReject(request)}
        />
      ))}
    </View>
  );
}

function PendingApprovalRequestsModal({
  visible,
  requests,
  reviewingBookingId,
  onApprove,
  onReject,
  onClose
}: {
  visible: boolean;
  requests: DepartmentApprovalRequest[];
  reviewingBookingId: string | null;
  onApprove: (request: DepartmentApprovalRequest) => void;
  onReject: (request: DepartmentApprovalRequest) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.todaySheet}>
          <View style={styles.todaySheetHeader}>
            <Text style={styles.todaySheetTitle}>Pending Approval Requests</Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.todaySheetList} contentContainerStyle={styles.todaySheetListContent}>
            {requests.map((request) => (
              <ApprovalRequestCard
                key={request.id}
                request={request}
                reviewing={reviewingBookingId === request.id}
                onApprove={() => onApprove(request)}
                onReject={() => onReject(request)}
              />
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ApprovalRequestCard({
  request,
  reviewing,
  onApprove,
  onReject
}: {
  request: DepartmentApprovalRequest;
  reviewing: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <View style={styles.approvalRequestCard}>
      <View style={styles.bookingHeader}>
        <Text style={styles.bookingTitle}>{request.eventTitle}</Text>
        <StatusBadge status={request.status} />
      </View>
      <Text style={styles.approvalRoute}>
        {`${request.requesterDepartment ?? 'Requester'} -> ${request.hallName ?? 'Venue'}`}
      </Text>
      <Text style={styles.bookingMeta}>Venue department: {request.hallDepartment ?? 'Not set'}</Text>
      <Text style={styles.bookingMeta}>Requester: {request.requesterName ?? 'Unknown requester'}</Text>
      <Text style={styles.todayTime}>{formatRecentBookingTime(request.startTime, request.endTime)}</Text>
      <View style={styles.approvalActions}>
        <View style={styles.approvalActionButton}>
          <AppButton title="Approve" loading={reviewing} disabled={reviewing} onPress={onApprove} />
        </View>
        <View style={styles.approvalActionButton}>
          <AppButton title="Reject" variant="secondary" loading={reviewing} disabled={reviewing} onPress={onReject} />
        </View>
      </View>
    </View>
  );
}

function isVenueVerseEmail(email?: string | null) {
  return email?.trim().toLowerCase() === VENUEVERSE_SUPER_ADMIN_EMAIL;
}

function getInitial(name?: string | null) {
  return name?.trim().charAt(0).toUpperCase() || 'V';
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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

function VenueScheduleSummary({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.todaySummaryCard, pressed && styles.pressedCard]}>
      <View style={styles.todaySummaryHeader}>
        <View style={styles.todaySummaryCopy}>
          <Text style={styles.sectionTitle}>Venue Schedule</Text>
          <Text style={styles.infoText}>Choose a date to view booked venues</Text>
        </View>
        <Ionicons name="calendar-number-outline" size={24} color={colors.primary} />
      </View>
      <Text style={styles.todaySummaryAction}>View schedule</Text>
    </Pressable>
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
  const venueType = normalizeVenueType(booking.venueType);
  if (booking.department === 'Library') return 'Library Seminar Hall';
  if (booking.department === 'Others' && venueType === 'Auditorium') return 'Others Auditorium';
  if (booking.department && venueType) return `${booking.department} ${venueType}`;
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
    borderRadius: 18,
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
  heroBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  heroAvatar: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: colors.surface
  },
  heroAvatarText: {
    color: colors.primary,
    fontSize: fontSizes.md,
    fontWeight: '900'
  },
  eyebrow: {
    color: colors.surface,
    fontSize: fontSizes.xs,
    fontWeight: '700',
    opacity: 0.85,
    textTransform: 'uppercase'
  },
  title: {
    color: colors.surface,
    fontSize: fontSizes.xl,
    fontWeight: '800'
  },
  subtitle: {
    color: '#D7E7F7',
    fontSize: fontSizes.sm,
    lineHeight: 20
  },
  profileHint: {
    color: colors.surface,
    fontSize: fontSizes.xs,
    fontWeight: '700',
    marginTop: spacing.xs
  },
  notificationButton: {
    width: 42,
    height: 42,
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
  approvalCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: colors.borderSoft,
    borderLeftColor: colors.status.pending,
    borderRadius: radius.lg,
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.card
  },
  approvalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  approvalHeaderCopy: {
    flex: 1,
    gap: spacing.xs
  },
  approvalEyebrow: {
    color: colors.status.pending,
    fontSize: fontSizes.xs,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  viewAllButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  approvalRequestCard: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    gap: spacing.xs,
    padding: spacing.md
  },
  approvalRoute: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '900',
    lineHeight: 20
  },
  approvalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  approvalActionButton: {
    flex: 1
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
    backgroundColor: colors.overlay
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
