import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { LoadingView } from '@/components/LoadingView';
import { StatusBadge } from '@/components/StatusBadge';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';
import { AdminStackParamList } from '@/navigation/types';
import { getProfileById, getUserBookingHistory, updateUserRole } from '@/services/profileService';
import { useAuth } from '@/store/AuthContext';
import { Profile, UserRole } from '@/types/auth';
import { BookingPreview } from '@/types/venue';

type Props = NativeStackScreenProps<AdminStackParamList, 'UserDetails'>;

const roles: UserRole[] = ['user', 'admin', 'super_admin'];

export function UserDetailsScreen({ route }: Props) {
  const { profile: currentProfile, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bookings, setBookings] = useState<BookingPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [error, setError] = useState('');

  const canManageRoles = currentProfile?.role === 'super_admin';

  const loadDetails = useCallback(async () => {
    setError('');
    const [nextProfile, nextBookings] = await Promise.all([
      getProfileById(route.params.userId),
      getUserBookingHistory(route.params.userId)
    ]);
    setProfile(nextProfile);
    setBookings(nextBookings);
  }, [route.params.userId]);

  useEffect(() => {
    setLoading(true);
    loadDetails()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load user details.'))
      .finally(() => setLoading(false));
  }, [loadDetails]);

  const confirmRoleChange = (nextRole: UserRole) => {
    if (!profile || profile.role === nextRole || !canManageRoles) return;

    Alert.alert(
      'Change user role?',
      `This will change ${profile.fullName}'s role from ${profile.role} to ${nextRole}. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change Role',
          style: 'destructive',
          onPress: async () => {
            try {
              setUpdatingRole(true);
              await updateUserRole(profile.id, nextRole);
              await loadDetails();
              if (currentProfile?.id === profile.id) {
                await refreshProfile();
              }
              Alert.alert('Role updated', 'The user role has been updated.');
            } catch (roleError) {
              setError(roleError instanceof Error ? roleError.message : 'Unable to update role.');
            } finally {
              setUpdatingRole(false);
            }
          }
        }
      ]
    );
  };

  if (!canManageRoles) {
    return <View style={styles.screen}><EmptyState title="Access restricted" message="Only super_admin users can view and change user roles." /></View>;
  }

  if (loading) return <LoadingView message="Loading user details..." />;
  if (error && !profile) return <View style={styles.screen}><ErrorView message={error} onRetry={() => void loadDetails()} /></View>;
  if (!profile) return <View style={styles.screen}><EmptyState title="User not found" message="This profile may no longer exist." /></View>;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {error ? <ErrorView message={error} onRetry={() => void loadDetails()} /> : null}

      <View style={styles.panel}>
        <Text style={styles.name}>{profile.fullName}</Text>
        <Detail label="Email" value={profile.email} />
        <Detail label="Department" value={profile.department} />
        <Detail label="Current role" value={profile.role.replace('_', ' ')} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Role management</Text>
        <Text style={styles.note}>Select a role only when you are certain. A confirmation dialog will appear before saving.</Text>
        <View style={styles.roleRow}>
          {roles.map((role) => {
            const active = profile.role === role;
            return (
              <Pressable
                key={role}
                disabled={updatingRole || active}
                onPress={() => confirmRoleChange(role)}
                style={[styles.roleChip, active && styles.roleChipActive]}
              >
                <Text style={[styles.roleText, active && styles.roleTextActive]}>{role.replace('_', ' ').toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Booking history</Text>
        {bookings.length === 0 ? (
          <EmptyState title="No bookings" message="This user has not submitted booking requests." />
        ) : (
          bookings.map((booking) => <BookingHistoryCard key={booking.id} booking={booking} />)
        )}
      </View>
    </ScrollView>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || 'Not provided'}</Text>
    </View>
  );
}

function BookingHistoryCard({ booking }: { booking: BookingPreview }) {
  return (
    <View style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        <Text style={styles.bookingTitle}>{booking.eventTitle}</Text>
        <StatusBadge status={booking.status} />
      </View>
      <Text style={styles.bookingMeta}>{booking.hallName ?? 'Hall unavailable'}</Text>
      <Text style={styles.bookingMeta}>
        {format(new Date(booking.startTime), 'dd MMM yyyy, h:mm a')} - {format(new Date(booking.endTime), 'h:mm a')}
      </Text>
    </View>
  );
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
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md
  },
  name: {
    color: colors.text,
    fontSize: fontSizes.xl,
    fontWeight: '900'
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '900'
  },
  note: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    lineHeight: 20
  },
  detail: {
    gap: spacing.xs
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  detailValue: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '700'
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  roleChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface
  },
  roleChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  roleText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  roleTextActive: {
    color: colors.surface
  },
  bookingCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.background
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
    fontWeight: '700'
  }
});
