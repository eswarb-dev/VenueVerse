import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format, parse } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppTextInput } from '@/components/AppTextInput';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { LoadingView } from '@/components/LoadingView';
import { StatusBadge } from '@/components/StatusBadge';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';
import { AppStackParamList } from '@/navigation/types';
import { getHallAvailabilityForDate } from '@/services/bookingService';
import { getActiveHalls, getHallById } from '@/services/hallService';
import { AvailabilitySlot, Hall } from '@/types/venue';

type Props = NativeStackScreenProps<AppStackParamList, 'VenueAvailability'>;

export function VenueAvailabilityScreen({ route }: Props) {
  const [halls, setHalls] = useState<Hall[]>([]);
  const [selectedHallId, setSelectedHallId] = useState(route.params?.hallId ?? '');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loadingHalls, setLoadingHalls] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const selectedHall = useMemo(() => halls.find((hall) => hall.id === selectedHallId) ?? null, [halls, selectedHallId]);

  const loadHalls = useCallback(async () => {
    setError('');
    if (route.params?.hallId) {
      const hall = await getHallById(route.params.hallId);
      const activeHalls = await getActiveHalls();
      const merged = hall ? [hall, ...activeHalls.filter((item) => item.id !== hall.id)] : activeHalls;
      setHalls(merged);
      return;
    }

    const activeHalls = await getActiveHalls();
    setHalls(activeHalls);
    if (!selectedHallId && activeHalls[0]) setSelectedHallId(activeHalls[0].id);
  }, [route.params?.hallId, selectedHallId]);

  const loadAvailability = useCallback(async () => {
    if (!selectedHallId) return;
    const parsedDate = parse(date.trim(), 'yyyy-MM-dd', new Date());
    if (Number.isNaN(parsedDate.getTime())) {
      setError('Use date format YYYY-MM-DD.');
      setSlots([]);
      return;
    }

    setError('');
    setSlots(await getHallAvailabilityForDate({ hallId: selectedHallId, date: date.trim() }));
  }, [date, selectedHallId]);

  useEffect(() => {
    setLoadingHalls(true);
    loadHalls()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load halls.'))
      .finally(() => setLoadingHalls(false));
  }, [loadHalls]);

  useEffect(() => {
    setLoadingSlots(true);
    loadAvailability()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load availability.'))
      .finally(() => setLoadingSlots(false));
  }, [loadAvailability]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadAvailability();
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh availability.');
    } finally {
      setRefreshing(false);
    }
  };

  if (loadingHalls) return <LoadingView message="Loading venue availability..." />;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      keyboardShouldPersistTaps="handled"
    >
      {error ? <ErrorView message={error} onRetry={() => void onRefresh()} /> : null}

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Select hall</Text>
        <View style={styles.hallList}>
          {halls.map((hall) => {
            const active = selectedHallId === hall.id;
            return (
              <Pressable key={hall.id} onPress={() => setSelectedHallId(hall.id)} style={[styles.hallChoice, active && styles.hallChoiceActive]}>
                <Text style={[styles.hallChoiceText, active && styles.hallChoiceTextActive]}>{hall.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <AppTextInput label="Date" placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Booked slots</Text>
        <Text style={styles.meta}>{date} • {selectedHall?.name ?? 'Select a hall'}</Text>
        {loadingSlots ? (
          <LoadingView message="Checking slots..." />
        ) : slots.length === 0 ? (
          <EmptyState title="No bookings for this date" message="This hall has no pending or approved requests on the selected date." />
        ) : (
          slots.map((slot) => <SlotCard key={slot.id} slot={slot} />)
        )}
      </View>
    </ScrollView>
  );
}

function SlotCard({ slot }: { slot: AvailabilitySlot }) {
  return (
    <View style={styles.slotCard}>
      <View style={styles.slotHeader}>
        <Text style={styles.slotTitle}>{slot.eventTitle}</Text>
        <StatusBadge status={slot.status} />
      </View>
      <Text style={styles.slotTime}>
        {format(new Date(slot.startTime), 'h:mm a')} - {format(new Date(slot.endTime), 'h:mm a')}
      </Text>
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
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '900'
  },
  hallList: {
    gap: spacing.sm
  },
  hallChoice: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface
  },
  hallChoiceActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  hallChoiceText: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '800'
  },
  hallChoiceTextActive: {
    color: colors.surface
  },
  meta: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700'
  },
  slotCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.background
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md
  },
  slotTitle: {
    flex: 1,
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '900'
  },
  slotTime: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  }
});
