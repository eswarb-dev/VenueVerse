import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { AppTextInput } from '@/components/AppTextInput';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { LoadingView } from '@/components/LoadingView';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';
import { AdminStackParamList } from '@/navigation/types';
import { listProfiles } from '@/services/profileService';
import { useAuth } from '@/store/AuthContext';
import { Profile, UserRole } from '@/types/auth';

type Props = NativeStackScreenProps<AdminStackParamList, 'Users'>;
type RoleFilter = 'all' | UserRole;

const roleFilters: { label: string; value: RoleFilter }[] = [
  { label: 'All roles', value: 'all' },
  { label: 'Users', value: 'user' },
  { label: 'Admins', value: 'admin' },
  { label: 'Super admins', value: 'super_admin' }
];

export function UserManagementScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const canAccess = profile?.role === 'super_admin';

  const loadUsers = useCallback(async () => {
    if (!canAccess) return;
    setError('');
    setUsers(await listProfiles());
  }, [canAccess]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadUsers()
        .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load users.'))
        .finally(() => setLoading(false));
    }, [loadUsers])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadUsers();
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh users.');
    } finally {
      setRefreshing(false);
    }
  };

  const departments = useMemo(() => {
    const values = new Set<string>();
    users.forEach((user) => {
      if (user.department) values.add(user.department);
    });
    return ['all', ...Array.from(values).sort()];
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !query ||
        user.fullName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query);
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesDepartment = departmentFilter === 'all' || user.department === departmentFilter;
      return matchesSearch && matchesRole && matchesDepartment;
    });
  }, [departmentFilter, roleFilter, search, users]);

  if (!canAccess) {
    return <View style={styles.screen}><EmptyState title="Access restricted" message="Only super_admin users can manage user roles." /></View>;
  }

  if (loading) return <LoadingView message="Loading users..." />;

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={styles.content}
      data={filteredUsers}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={styles.header}>
          {error ? <ErrorView message={error} onRetry={() => void onRefresh()} /> : null}
          {profile?.role === 'super_admin' ? (
            <AppButton title="Add User" onPress={() => navigation.navigate('AddUser')} />
          ) : null}
          <AppTextInput label="Search users" placeholder="Name or email" value={search} onChangeText={setSearch} />
          <Text style={styles.filterTitle}>Role</Text>
          <View style={styles.chipRow}>
            {roleFilters.map((filter) => (
              <FilterChip key={filter.value} label={filter.label} active={roleFilter === filter.value} onPress={() => setRoleFilter(filter.value)} />
            ))}
          </View>
          <Text style={styles.filterTitle}>Department</Text>
          <View style={styles.chipRow}>
            {departments.map((department) => (
              <FilterChip
                key={department}
                label={department === 'all' ? 'All departments' : department}
                active={departmentFilter === department}
                onPress={() => setDepartmentFilter(department)}
              />
            ))}
          </View>
        </View>
      }
      ListEmptyComponent={<EmptyState title="No users found" message="Try changing the search or filters." />}
      renderItem={({ item }) => (
        <UserCard user={item} onPress={() => navigation.navigate('UserDetails', { userId: item.id })} />
      )}
    />
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function UserCard({ user, onPress }: { user: Profile; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardHeader}>
        <Text style={styles.name}>{user.fullName}</Text>
        <Text style={styles.role}>{user.role.replace('_', ' ').toUpperCase()}</Text>
      </View>
      <Text style={styles.meta}>{user.email}</Text>
      <Text style={styles.meta}>{user.department ?? 'Department not set'}</Text>
    </Pressable>
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
  header: {
    gap: spacing.md
  },
  filterTitle: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  chipText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '800'
  },
  chipTextActive: {
    color: colors.surface
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
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
  name: {
    flex: 1,
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '900'
  },
  role: {
    color: colors.primary,
    fontSize: fontSizes.xs,
    fontWeight: '900'
  },
  meta: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700'
  }
});
