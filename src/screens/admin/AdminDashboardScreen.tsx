import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { BottomTabScreenProps, useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppLogoMark } from '@/components/AppLogoMark';
import { ErrorView } from '@/components/ErrorView';
import { LoadingView } from '@/components/LoadingView';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';
import { EXTRA_TAB_PADDING, TOP_SAFE_AREA_PADDING } from '@/constants/layout';
import { AdminStackParamList, AdminTabParamList } from '@/navigation/types';
import { getAdminDashboardStats } from '@/services/adminService';
import { useAuth } from '@/store/AuthContext';
import { AdminDashboardStats } from '@/types/venue';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AdminTabParamList, 'Dashboard'>,
  NativeStackScreenProps<AdminStackParamList>
>;

export function AdminDashboardScreen({ navigation }: Props) {
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const { profile, logout } = useAuth();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const hasFocusedOnce = useRef(false);
  const role = profile?.role;
  const isAdmin = role === 'admin';
  const isSuperAdmin = role === 'super_admin';
  const canAccessAdminDashboard = isAdmin || isSuperAdmin;

  const goBackToHome = useCallback(() => {
    const adminTabs = navigation.getParent();
    const appStack = adminTabs?.getParent();

    if (appStack?.canGoBack()) {
      appStack.goBack();
      return;
    }

    adminTabs?.goBack();
  }, [navigation]);

  const loadStats = useCallback(async (forceRefresh = false) => {
    setError('');
    setStats(await getAdminDashboardStats(profile, { forceRefresh }));
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        goBackToHome();
        return true;
      });

      return () => subscription.remove();
    }, [goBackToHome])
  );

  useFocusEffect(
    useCallback(() => {
      setLoading(!hasFocusedOnce.current);
      loadStats()
        .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to refresh admin dashboard.'))
        .finally(() => {
          hasFocusedOnce.current = true;
          setLoading(false);
        });
    }, [loadStats])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadStats(true);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh dashboard.');
    } finally {
      setRefreshing(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout }
    ]);
  };

  if (!canAccessAdminDashboard) {
    return (
      <View style={styles.centeredState}>
        <Text style={styles.deniedTitle}>Access denied.</Text>
        <Text style={styles.deniedMessage}>This section is available only for admin users.</Text>
      </View>
    );
  }

  if (loading) return <LoadingView message="Loading admin dashboard..." />;

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
      <Pressable accessibilityRole="button" onPress={goBackToHome} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
        <Text style={styles.backButtonText}>‹ Back to Home</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>{isSuperAdmin ? 'Super Admin Console' : 'Administration'}</Text>
            <Text style={styles.title}>{isSuperAdmin ? 'Global Admin Dashboard' : `${profile?.department ?? 'Department'} Admin Dashboard`}</Text>
            <Text style={styles.subtitle}>{profile?.fullName ?? 'Admin'} • {formatRole(role)}</Text>
          </View>
          <AppLogoMark size={46} />
        </View>
      </View>

      {error ? <ErrorView message={error} onRetry={() => void onRefresh()} /> : null}

      <SectionTitle title="Overview" />
      <View style={styles.statsGrid}>
        <AdminStatCard label="Pending Requests" value={stats?.pending ?? 0} accentColor={colors.warning} onPress={() => navigation.navigate('Requests')} />
        <AdminStatCard label="Approved Bookings" value={stats?.approved ?? 0} accentColor={colors.success} onPress={() => navigation.navigate('Bookings', { status: 'approved' })} />
        <AdminStatCard label="Rejected Bookings" value={stats?.rejected ?? 0} accentColor={colors.danger} onPress={() => navigation.navigate('Bookings', { status: 'rejected' })} />
        <AdminStatCard label="Revoked Bookings" value={stats?.revoked ?? 0} accentColor={colors.status.revoked} onPress={() => navigation.navigate('Bookings', { status: 'revoked' })} />
        <AdminStatCard
          label={isSuperAdmin ? 'Active Halls' : 'Active Department Halls'}
          value={stats?.activeHalls ?? 0}
          accentColor={colors.primary}
          disabled={!canAccessAdminDashboard}
          onPress={() => navigation.navigate('Venues', { isActive: true })}
        />
      </View>

      <SectionTitle title="Quick Actions" />
      <View style={styles.actionGrid}>
        <AdminActionCard
          title="Pending Requests"
          subtitle="Review booking approvals"
          badge={stats?.pending ? String(stats.pending) : undefined}
          onPress={() => navigation.navigate('Requests')}
        />
        {canAccessAdminDashboard ? (
          <AdminActionCard title="Manage Venues" subtitle={isSuperAdmin ? 'Add or edit halls/labs across departments' : `Add or edit ${profile?.department ?? 'department'} halls/labs`} onPress={() => navigation.navigate('Venues')} />
        ) : null}
        <AdminActionCard title="All Bookings" subtitle={isSuperAdmin ? 'View global booking history' : 'View department venue history'} onPress={() => navigation.navigate('Bookings')} />
        {canAccessAdminDashboard ? (
          <AdminActionCard title="Users" subtitle="Manage roles and accounts" onPress={() => navigation.navigate('Users')} />
        ) : null}
      </View>

      <View style={styles.accountArea}>
        <Text style={styles.accountLabel}>Account</Text>
        <Pressable accessibilityRole="button" onPress={confirmLogout} style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function AdminStatCard({
  label,
  value,
  accentColor,
  onPress,
  disabled = false
}: {
  label: string;
  value: number;
  accentColor: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.statCard, pressed && styles.pressed, disabled && styles.statCardDisabled]}
    >
      <View style={[styles.statAccent, { backgroundColor: accentColor }]} />
      <Text style={styles.statValue}>{value}</Text>
      <View style={styles.statFooter}>
        <Text style={styles.statLabel}>{label}</Text>
        {!disabled ? <Text style={styles.statViewHint}>View ›</Text> : null}
      </View>
    </Pressable>
  );
}

function AdminActionCard({
  title,
  subtitle,
  onPress,
  badge
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
  badge?: string;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}>
      <View style={styles.actionHeader}>
        <Text style={styles.actionTitle}>{title}</Text>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : (
          <Text style={styles.chevron}>›</Text>
        )}
      </View>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

function formatRole(role?: string) {
  if (role === 'super_admin') return 'Super Admin';
  if (role === 'admin') return 'Admin';
  return 'User';
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg
  },
  deniedTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '900',
    textAlign: 'center'
  },
  deniedMessage: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    marginTop: spacing.sm,
    textAlign: 'center'
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  backButtonText: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  header: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: colors.borderSoft,
    borderLeftColor: colors.primary,
    borderRadius: radius.lg,
    padding: 20,
    gap: spacing.xs
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs
  },
  eyebrow: {
    color: colors.primary,
    fontSize: fontSizes.xs,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  title: {
    color: colors.text,
    fontSize: fontSizes.xl,
    fontWeight: '900'
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700'
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '900',
    marginTop: spacing.xs
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  statCard: {
    flexBasis: '48.8%',
    minHeight: 110,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    justifyContent: 'space-between'
  },
  statAccent: {
    width: 34,
    height: 4,
    borderRadius: radius.pill
  },
  statValue: {
    color: colors.primary,
    fontSize: fontSizes.title,
    fontWeight: '900'
  },
  statLabel: {
    flex: 1,
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '800'
  },
  statFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  statViewHint: {
    color: colors.primary,
    fontSize: fontSizes.xs,
    fontWeight: '900'
  },
  statCardDisabled: {
    opacity: 0.72
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  actionCard: {
    flexBasis: '48.8%',
    minHeight: 104,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    justifyContent: 'space-between'
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  actionTitle: {
    flex: 1,
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  actionSubtitle: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: '700',
    lineHeight: 17
  },
  chevron: {
    color: colors.primary,
    fontSize: fontSizes.lg,
    fontWeight: '900'
  },
  badge: {
    minWidth: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.xs
  },
  badgeText: {
    color: colors.primary,
    fontSize: fontSizes.xs,
    fontWeight: '900'
  },
  accountArea: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.md,
    gap: spacing.sm
  },
  accountLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  logoutButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    backgroundColor: colors.surface
  },
  logoutText: {
    color: colors.status.rejected,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  pressed: {
    opacity: 0.72
  }
});
