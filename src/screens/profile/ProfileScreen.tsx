import { Ionicons } from '@expo/vector-icons';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps, useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/AppButton';
import { AboutCard } from '@/components/AboutCard';
import { EmptyState } from '@/components/EmptyState';
import { LoadingView } from '@/components/LoadingView';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';
import { EXTRA_TAB_PADDING, TOP_SAFE_AREA_PADDING } from '@/constants/layout';
import { AppStackParamList, UserTabParamList } from '@/navigation/types';
import { useAuth } from '@/store/AuthContext';
import { UserRole } from '@/types/auth';

type Props = CompositeScreenProps<
  BottomTabScreenProps<UserTabParamList, 'Profile'>,
  NativeStackScreenProps<AppStackParamList>
>;

export function ProfileScreen({ navigation }: Props) {
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const { profile, loading, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const confirmLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoggingOut(true);
            setLogoutError('');
            await logout();
          } catch {
            setLogoutError('Failed to log out. Please try again.');
          } finally {
            setLoggingOut(false);
          }
        }
      }
    ]);
  };

  if (loading) return <LoadingView message="Loading profile..." />;

  if (!profile) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Profile information unavailable." message="Your profile details could not be loaded right now." />
      </View>
    );
  }

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
    >
      <View style={styles.headerCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitial(profile.fullName)}</Text>
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.name}>{profile.fullName || 'VenueVerse User'}</Text>
          <Text style={styles.email}>{profile.email}</Text>
          <View style={styles.badgeRow}>
            <RoleBadge role={profile.role} />
            <Badge icon="business-outline" label={profile.department ?? 'Department not set'} />
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account</Text>
        <ActionRow
          icon="person-outline"
          title="Edit Profile"
          subtitle="Update your name and department"
          onPress={() => navigation.navigate('EditProfile')}
        />
        <ActionRow
          icon="lock-closed-outline"
          title="Change Password"
          subtitle="Update your account password"
          onPress={() => navigation.navigate('ChangePassword')}
        />
        <ActionRow
          icon="settings-outline"
          title="Preferences"
          subtitle="Notifications"
          onPress={() => navigation.navigate('Settings')}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Tools</Text>
        <ActionRow
          icon="qr-code-outline"
          title="Scan Receipt QR"
          subtitle="Verify VenueVerse booking receipts"
          onPress={() => navigation.navigate('ScanReceiptQR')}
        />
      </View>

      <AboutCard />

      {logoutError ? <Text style={styles.errorText}>{logoutError}</Text> : null}
      <AppButton
        title={loggingOut ? 'Logging out...' : 'Log Out'}
        icon="log-out-outline"
        variant="destructive"
        loading={loggingOut}
        disabled={loggingOut}
        onPress={confirmLogout}
      />
    </ScrollView>
  );
}

function ActionRow({
  icon,
  title,
  subtitle,
  onPress
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const isPrivileged = role === 'admin' || role === 'super_admin';
  const label = role === 'super_admin' ? 'SUPER ADMIN' : role.toUpperCase();
  return <Badge icon={isPrivileged ? 'shield-checkmark-outline' : 'person-circle-outline'} label={label} tone={isPrivileged ? 'admin' : 'user'} />;
}

function Badge({ icon, label, tone = 'user' }: { icon: keyof typeof Ionicons.glyphMap; label: string; tone?: 'admin' | 'user' }) {
  return (
    <View style={[styles.badge, tone === 'admin' && styles.adminBadge]}>
      <Ionicons name={icon} size={14} color={tone === 'admin' ? colors.primary : colors.textMuted} />
      <Text style={[styles.badgeText, tone === 'admin' && styles.adminBadgeText]}>{label}</Text>
    </View>
  );
}

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || 'V';
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
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.card
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  avatarText: {
    color: colors.primary,
    fontSize: fontSizes.title,
    fontWeight: '900'
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs
  },
  name: {
    color: colors.surface,
    fontSize: fontSizes.xl,
    fontWeight: '900'
  },
  email: {
    color: colors.onPrimarySubtle,
    fontSize: fontSizes.sm,
    fontWeight: '700'
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  adminBadge: {
    backgroundColor: colors.primaryLight
  },
  badgeText: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: '900'
  },
  adminBadgeText: {
    color: colors.primary
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '900',
    marginBottom: spacing.xs
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 68,
    borderRadius: radius.md,
    paddingVertical: spacing.sm
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight
  },
  actionCopy: {
    flex: 1,
    gap: spacing.xs
  },
  actionTitle: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '900'
  },
  actionSubtitle: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700'
  },
  pressed: {
    opacity: 0.65
  },
  errorText: {
    color: colors.status.rejected,
    backgroundColor: colors.errorSurface,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSizes.sm,
    fontWeight: '700'
  }
});
