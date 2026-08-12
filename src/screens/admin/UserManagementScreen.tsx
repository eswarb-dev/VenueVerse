import { BottomTabScreenProps, useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTextInput } from '@/components/AppTextInput';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { LoadingView } from '@/components/LoadingView';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';
import { DEPARTMENT_OPTIONS } from '@/constants/departments';
import { EXTRA_TAB_PADDING, TOP_SAFE_AREA_PADDING } from '@/constants/layout';
import { AdminStackParamList, AdminTabParamList } from '@/navigation/types';
import { listAllProfiles, listProfiles } from '@/services/profileService';
import { useAuth } from '@/store/AuthContext';
import { Profile, UserRole } from '@/types/auth';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AdminTabParamList, 'Users'>,
  NativeStackScreenProps<AdminStackParamList>
>;
type RoleFilter = 'all' | UserRole;

const roleFilters: { label: string; value: RoleFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Users', value: 'user' },
  { label: 'Admins', value: 'admin' },
  { label: 'Super Admin', value: 'super_admin' }
];

export function UserManagementScreen({ navigation }: Props) {
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const adminDepartment = profile?.department ?? '';
  const isSuperAdmin = profile?.role === 'super_admin';
  const canAccess = isSuperAdmin || (profile?.role === 'admin' && Boolean(adminDepartment));

  const loadUsers = useCallback(async () => {
    if (!canAccess) return;
    setError('');
    setUsers(isSuperAdmin ? await listAllProfiles() : await listProfiles(adminDepartment));
  }, [adminDepartment, canAccess, isSuperAdmin]);

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

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !query ||
        user.fullName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query);
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesDepartment = departmentFilter === 'all' || user.department === departmentFilter;
      const allowedForAdmin = isSuperAdmin || user.role !== 'super_admin';
      return matchesSearch && matchesRole && matchesDepartment && allowedForAdmin;
    });
  }, [departmentFilter, isSuperAdmin, roleFilter, search, users]);

  const visibleRoleFilters = isSuperAdmin ? roleFilters : roleFilters.filter((filter) => filter.value !== 'super_admin');

  const renderUser = useCallback(({ item }: { item: Profile }) => (
    <UserCard
      user={item}
      onPress={() => navigation.navigate('UserDetails', { userId: item.id })}
    />
  ), [navigation]);

  if (!canAccess) {
    return <View style={styles.screen}><EmptyState title="Access restricted" message="Only admins with an assigned department can manage users." /></View>;
  }

  if (loading) return <LoadingView message="Loading users..." />;

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + TOP_SAFE_AREA_PADDING,
          paddingBottom: tabBarHeight + EXTRA_TAB_PADDING + spacing.xl
        }
      ]}
      data={filteredUsers}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={styles.header}>
          {error ? <ErrorView message={error} onRetry={() => void onRefresh()} /> : null}
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <Text numberOfLines={1} style={styles.screenTitle}>
                {isSuperAdmin ? 'Users' : `Users • ${adminDepartment}`}
              </Text>
              <Text style={styles.screenSubtitle}>{isSuperAdmin ? 'Super Admin Console' : 'Manage VenueVerse accounts in your department'}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add user"
              onPress={() => navigation.navigate('AddUser')}
              style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
            >
              <Ionicons name="person-add-outline" size={18} color={colors.surface} />
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          </View>
          <View style={styles.searchBlock}>
            <AppTextInput label="Search users" placeholder="Name or email" value={search} onChangeText={setSearch} />
          </View>
          <View style={styles.filterBlock}>
            <Text style={styles.filterTitle}>Role</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {visibleRoleFilters.map((filter) => (
                <FilterChip key={filter.value} label={filter.label} active={roleFilter === filter.value} onPress={() => setRoleFilter(filter.value)} />
              ))}
            </ScrollView>
          </View>
          {isSuperAdmin ? (
            <View style={styles.filterBlock}>
              <Text style={styles.filterTitle}>Department</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                <FilterChip label="All" active={departmentFilter === 'all'} onPress={() => setDepartmentFilter('all')} />
                {DEPARTMENT_OPTIONS.map((department) => (
                  <FilterChip key={department} label={department} active={departmentFilter === department} onPress={() => setDepartmentFilter(department)} />
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={<EmptyState title="No users found" message="Try changing the search or filters." />}
      renderItem={renderUser}
    />
  );
}

const FilterChip = memo(function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
});

const UserCard = memo(function UserCard({
  user,
  onPress
}: {
  user: Profile;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardHeader}>
        <Text style={styles.name}>{user.fullName}</Text>
        <View style={[styles.roleBadge, user.role !== 'user' ? styles.adminBadge : styles.userBadge]}>
          <Text style={[styles.roleBadgeText, user.role !== 'user' ? styles.adminBadgeText : styles.userBadgeText]}>
            {formatRoleLabel(user.role)}
          </Text>
        </View>
      </View>
      <Text style={styles.email}>{user.email}</Text>
      <View style={styles.departmentRow}>
        <Ionicons name="school-outline" size={14} color={colors.textMuted} />
        <Text style={styles.department}>{user.department ?? 'Department not set'}</Text>
      </View>
    </Pressable>
  );
});

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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs
  },
  header: {
    gap: spacing.md,
    marginBottom: spacing.xs
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  headerTextWrap: {
    flex: 1,
    gap: spacing.xs
  },
  screenTitle: {
    color: colors.text,
    fontSize: fontSizes.xl,
    fontWeight: '900',
    lineHeight: 30
  },
  screenSubtitle: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    lineHeight: 20
  },
  addButton: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.primary
  },
  addButtonText: {
    color: colors.surface,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  searchBlock: {
    gap: spacing.sm
  },
  filterBlock: {
    gap: spacing.sm
  },
  filterTitle: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  chipRow: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacing.md
  },
  chip: {
    minHeight: 36,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center'
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
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.sm,
    minHeight: 92,
    gap: spacing.xs,
    ...shadows.card
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
    fontSize: fontSizes.md,
    fontWeight: '900',
    lineHeight: 22
  },
  roleBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  adminBadge: {
    backgroundColor: colors.primaryLight
  },
  userBadge: {
    backgroundColor: colors.surfaceMuted
  },
  roleBadgeText: {
    fontSize: fontSizes.xs,
    fontWeight: '900'
  },
  adminBadgeText: {
    color: colors.primary
  },
  userBadgeText: {
    color: colors.textMuted,
  },
  email: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    lineHeight: 20
  },
  departmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  department: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    lineHeight: 20
  },
});

function formatRoleLabel(role: UserRole) {
  if (role === 'super_admin') return 'SUPER ADMIN';
  return role === 'admin' ? 'ADMIN' : 'USER';
}
