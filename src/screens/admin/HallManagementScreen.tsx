import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '@/components/AppButton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { HallCard } from '@/components/HallCard';
import { LoadingView } from '@/components/LoadingView';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';
import { EXTRA_TAB_PADDING, TOP_SAFE_AREA_PADDING } from '@/constants/layout';
import { getAllHalls, getHallsByDepartment } from '@/services/hallService';
import { useAuth } from '@/store/AuthContext';
import { Hall } from '@/types/venue';

type Props = {
  navigation: any;
  route: {
    params?: {
      mode?: 'admin' | 'department';
      department?: string;
      isActive?: boolean;
    };
  };
};
type StatusFilter = 'all' | 'active' | 'inactive';

const filters: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' }
];

export function HallManagementScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [halls, setHalls] = useState<Hall[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => (route.params?.isActive ? 'active' : 'all'));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = profile?.role === 'admin';
  const isSuperAdmin = profile?.role === 'super_admin';
  const userDepartment = profile?.department ?? '';
  const managementDepartment = isSuperAdmin ? 'All Departments' : userDepartment;
  const canManage = isSuperAdmin || (isAdmin && Boolean(userDepartment));
  const activeOnlyMode = route.params?.isActive === true;

  const loadHalls = useCallback(async (options?: { forceRefresh?: boolean }) => {
    setError('');
    if (isSuperAdmin) {
      setHalls(await getAllHalls({ forceRefresh: options?.forceRefresh }));
      return;
    }
    if (!userDepartment) {
      setHalls([]);
      return;
    }
    setHalls(await getHallsByDepartment(userDepartment, { forceRefresh: options?.forceRefresh }));
  }, [isSuperAdmin, userDepartment]);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.isActive) {
        setStatusFilter('active');
        navigation.setOptions({ title: 'Active Halls' });
      } else {
        navigation.setOptions({ title: isSuperAdmin ? 'All Venues' : 'My Department Venues' });
      }
      setLoading(true);
      loadHalls({ forceRefresh: true })
        .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load halls.'))
        .finally(() => setLoading(false));
    }, [loadHalls, navigation, route.params?.isActive])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadHalls({ forceRefresh: true });
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh halls.');
    } finally {
      setRefreshing(false);
    }
  };

  const filteredHalls = useMemo(() => {
    return halls.filter((hall) => {
      const matchesStatus =
        activeOnlyMode ||
        statusFilter === 'all' ||
        (statusFilter === 'active' && hall.isActive) ||
        (statusFilter === 'inactive' && !hall.isActive);
      return matchesStatus && (!activeOnlyMode || hall.isActive);
    });
  }, [activeOnlyMode, halls, statusFilter]);

  const renderHall = useCallback(({ item }: { item: Hall }) => (
    <HallCard
      hall={item}
      onPress={() => navigation.navigate('EditHall', {
        hallId: item.id,
        mode: isSuperAdmin ? 'admin' : 'department',
        department: isSuperAdmin ? item.department ?? undefined : managementDepartment
      })}
    />
  ), [isSuperAdmin, managementDepartment, navigation]);

  if (!canManage) {
    return <EmptyState title="Access restricted" message="Only admins with an assigned department can manage venues." />;
  }

  if (loading) return <LoadingView message="Loading hall management..." />;

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + TOP_SAFE_AREA_PADDING,
          paddingBottom: insets.bottom + EXTRA_TAB_PADDING
        }
      ]}
      data={filteredHalls}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={styles.header}>
          {error ? <ErrorView message={error} onRetry={() => void onRefresh()} /> : null}
          <View style={styles.titleBlock}>
            <Text style={styles.screenTitle}>Venues • {managementDepartment}</Text>
            <Text style={styles.screenSubtitle}>Managing venues for your department.</Text>
          </View>
          <AppButton
            title={isSuperAdmin ? 'Add Venue' : `Add ${managementDepartment} Venue`}
            onPress={() => navigation.navigate('AddHall', {
              mode: isSuperAdmin ? 'admin' : 'department',
              department: isSuperAdmin ? undefined : managementDepartment
            })}
          />
          <View style={styles.filters}>
            {filters.map((filter) => (
              <Pressable
                key={filter.value}
                disabled={activeOnlyMode && filter.value !== 'active'}
                onPress={() => setStatusFilter(filter.value)}
                style={[
                  styles.filterChip,
                  statusFilter === filter.value && styles.filterChipActive,
                  activeOnlyMode && filter.value !== 'active' && styles.filterChipDisabled
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    statusFilter === filter.value && styles.filterTextActive,
                    activeOnlyMode && filter.value !== 'active' && styles.filterTextDisabled
                  ]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          title={statusFilter === 'active' ? 'No active halls found.' : 'No halls found'}
          message={statusFilter === 'active' ? 'Active halls will appear here.' : 'Try changing the status filter.'}
        />
      }
      renderItem={renderHall}
    />
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
    gap: spacing.md
  },
  titleBlock: {
    gap: spacing.xs
  },
  screenTitle: {
    color: colors.text,
    fontSize: fontSizes.xl,
    fontWeight: '900'
  },
  screenSubtitle: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700'
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  filterChipDisabled: {
    opacity: 0.55
  },
  filterText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '800'
  },
  filterTextActive: {
    color: colors.surface
  },
  filterTextDisabled: {
    color: colors.textMuted
  }
});
