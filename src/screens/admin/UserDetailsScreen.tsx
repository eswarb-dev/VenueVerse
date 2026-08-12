import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { LoadingView } from '@/components/LoadingView';
import { StatusBadge } from '@/components/StatusBadge';
import { DEPARTMENT_OPTIONS } from '@/constants/departments';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';
import { AdminStackParamList } from '@/navigation/types';
import { deleteManagedUser, getProfileById, getUserBookingHistory, getUserBookingHistoryForVenueDepartment, updateUserDepartmentAndRole, updateUserRole } from '@/services/profileService';
import { useAuth } from '@/store/AuthContext';
import { Profile, UserRole } from '@/types/auth';
import { BookingPreview } from '@/types/venue';

type Props = NativeStackScreenProps<AdminStackParamList, 'UserDetails'>;

const roles: UserRole[] = ['user', 'admin', 'super_admin'];

const SUPER_ADMIN_EMAIL = 'venueverse.srec@gmail.com';

export function UserDetailsScreen({ route, navigation }: Props) {
  const { profile: currentProfile, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bookings, setBookings] = useState<BookingPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [removingUser, setRemovingUser] = useState(false);
  const [error, setError] = useState('');

  const adminDepartment = currentProfile?.department ?? '';
  const isSuperAdmin = currentProfile?.role === 'super_admin';
  const canManageRoles = isSuperAdmin || (currentProfile?.role === 'admin' && Boolean(adminDepartment));

  const loadDetails = useCallback(async () => {
    setError('');
    const [nextProfile, nextBookings] = await Promise.all([
      getProfileById(route.params.userId),
      isSuperAdmin
        ? getUserBookingHistory(route.params.userId)
        : adminDepartment
          ? getUserBookingHistoryForVenueDepartment(route.params.userId, adminDepartment)
          : Promise.resolve([])
    ]);
    setProfile(nextProfile);
    setBookings(nextBookings);
  }, [adminDepartment, isSuperAdmin, route.params.userId]);

  useEffect(() => {
    setLoading(true);
    loadDetails()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load user details.'))
      .finally(() => setLoading(false));
  }, [loadDetails]);

  const confirmRoleChange = (nextRole: UserRole) => {
    if (!profile || profile.role === nextRole || !canManageRoles) return;
    if (!canUpdateTargetRole(profile, nextRole, currentProfile)) return;
    if (nextRole === 'super_admin' && profile.email.toLowerCase() !== SUPER_ADMIN_EMAIL) {
      setError('Only venueverse.srec@gmail.com can be Super Admin.');
      return;
    }

    Alert.alert(
      'Change User Role?',
      `Change ${profile.fullName}'s role from ${profile.role} to ${nextRole}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update Role',
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

  const confirmRemoveUser = () => {
    if (!profile || !canRemoveTarget(profile, currentProfile)) return;
    const removeCopy = getRemoveUserCopy(isSuperAdmin);
    Alert.alert(
      removeCopy.confirmTitle,
      removeCopy.confirmMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: removeCopy.confirmAction,
          style: 'destructive',
          onPress: async () => {
            try {
              setRemovingUser(true);
              const result = await deleteManagedUser(profile.id);
              const successCopy = getRemoveUserSuccessCopy(result.action);
              Alert.alert(successCopy.title, successCopy.message);
              navigation.goBack();
            } catch (removeError) {
              setError(removeError instanceof Error ? removeError.message : 'Unable to remove user.');
            } finally {
              setRemovingUser(false);
            }
          }
        }
      ]
    );
  };

  const confirmDepartmentChange = (nextDepartment: string) => {
    if (!profile || profile.department === nextDepartment || !isSuperAdmin) return;

    Alert.alert(
      'Change department?',
      `This will move ${profile.fullName} to ${nextDepartment}. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change Department',
          onPress: async () => {
            try {
              setUpdatingRole(true);
              await updateUserDepartmentAndRole(profile.id, nextDepartment, profile.role);
              await loadDetails();
              Alert.alert('Department updated', 'The user department has been updated.');
            } catch (departmentError) {
              setError(departmentError instanceof Error ? departmentError.message : 'Unable to update department.');
            } finally {
              setUpdatingRole(false);
            }
          }
        }
      ]
    );
  };

  if (!canManageRoles) {
    return <View style={styles.screen}><EmptyState title="Access restricted" message="Only admins can view and change user roles." /></View>;
  }

  if (loading) return <LoadingView message="Loading user details..." />;
  if (error && !profile) return <View style={styles.screen}><ErrorView message={error} onRetry={() => void loadDetails()} /></View>;
  if (!profile) return <View style={styles.screen}><EmptyState title="User not found" message="This profile may no longer exist." /></View>;
  if (!isSuperAdmin && profile.department !== adminDepartment) {
    return <View style={styles.screen}><EmptyState title="Access denied" message="You can manage only users from your department." /></View>;
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {error ? <ErrorView message={error} onRetry={() => void loadDetails()} /> : null}

      <View style={styles.panel}>
        <Text style={styles.name}>{profile.fullName}</Text>
        <Detail label="Email" value={profile.email} />
        <Detail label="Department" value={profile.department} />
        <Detail label="Current role" value={formatRoleLabel(profile.role)} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Role management</Text>
        <Text style={styles.note}>Select a role only when you are certain. A confirmation dialog will appear before saving.</Text>
        <View style={styles.roleRow}>
          {roles.filter((role) => isSuperAdmin || role !== 'super_admin').map((role) => {
            if (!canShowRoleOption(profile, role, currentProfile)) return null;
            const active = profile.role === role;
            return (
              <Pressable
                key={role}
                disabled={updatingRole || active}
                onPress={() => confirmRoleChange(role)}
                style={[styles.roleChip, active && styles.roleChipActive]}
              >
                <Text style={[styles.roleText, active && styles.roleTextActive]}>{formatRoleLabel(role).toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </View>
        {isSuperAdmin ? (
          <>
            <Text style={styles.note}>Department</Text>
            <View style={styles.roleRow}>
              {DEPARTMENT_OPTIONS.map((department) => {
                const active = profile.department === department;
                return (
                  <Pressable
                    key={department}
                    disabled={updatingRole || active}
                    onPress={() => confirmDepartmentChange(department)}
                    style={[styles.roleChip, active && styles.roleChipActive]}
                  >
                    <Text style={[styles.roleText, active && styles.roleTextActive]}>{department}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </View>

      {canRemoveTarget(profile, currentProfile) ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Danger zone</Text>
          <Text style={styles.note}>{getRemoveUserCopy(isSuperAdmin).dangerNote}</Text>
          <AppButton title="Remove User" variant="destructive" loading={removingUser} disabled={removingUser} onPress={confirmRemoveUser} />
        </View>
      ) : null}

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

function formatRoleLabel(role: UserRole) {
  if (role === 'super_admin') return 'Super Admin';
  return role === 'admin' ? 'Admin' : 'User';
}

function getRemoveUserCopy(isSuperAdmin: boolean) {
  if (isSuperAdmin) {
    return {
      dangerNote: 'Remove this user account and profile from VenueVerse.',
      confirmTitle: 'Remove User?',
      confirmMessage: 'Are you sure you want to remove this user from VenueVerse? This action cannot be undone.',
      confirmAction: 'Remove User'
    };
  }

  return {
    dangerNote: 'Remove this user from your department. Their VenueVerse account and profile will remain active.',
    confirmTitle: 'Remove from Department?',
    confirmMessage: 'Are you sure you want to remove this user from your department? Their VenueVerse account will remain active.',
    confirmAction: 'Remove from Department'
  };
}

function getRemoveUserSuccessCopy(action?: 'account_deleted' | 'department_removed') {
  if (action === 'account_deleted') {
    return {
      title: 'User removed',
      message: 'The user has been removed from VenueVerse.'
    };
  }

  return {
    title: 'User removed from department',
    message: 'The user has been removed from this department. Their VenueVerse account is still active.'
  };
}

function canShowRoleOption(target: Profile, role: UserRole, caller?: Profile | null) {
  if (!caller) return false;
  if (role === 'super_admin' && target.email.toLowerCase() !== SUPER_ADMIN_EMAIL) return false;
  return canUpdateTargetRole(target, role, caller) || target.role === role;
}

function canUpdateTargetRole(target: Profile, nextRole: UserRole, caller?: Profile | null) {
  if (!caller) return false;
  if (target.id === caller.id && target.role !== nextRole) return false;
  if (nextRole === 'super_admin' && target.email.toLowerCase() !== SUPER_ADMIN_EMAIL) return false;
  if (caller.role === 'super_admin' && caller.email.toLowerCase() === SUPER_ADMIN_EMAIL) return true;
  if (caller.role !== 'admin' || !caller.department) return false;
  if (target.role === 'super_admin' || nextRole === 'super_admin') return false;
  return target.department === caller.department;
}

function canRemoveTarget(target: Profile, caller?: Profile | null) {
  if (!caller || target.id === caller.id || target.role === 'super_admin') return false;
  if (caller.role === 'super_admin' && caller.email.toLowerCase() === SUPER_ADMIN_EMAIL) return true;
  if (caller.role !== 'admin' || !caller.department) return false;
  return target.department === caller.department;
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
