import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { formatVenueDescription } from '@/components/HallCard';
import { LoadingView } from '@/components/LoadingView';
import { StatusBadge } from '@/components/StatusBadge';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';
import { normalizeVenueType } from '@/constants/venueTypes';
import { AppStackParamList } from '@/navigation/types';
import { getHallById } from '@/services/hallService';
import { Hall } from '@/types/venue';

type Props = NativeStackScreenProps<AppStackParamList, 'HallDetails'>;

export function HallDetailsScreen({ route, navigation }: Props) {
  const [hall, setHall] = useState<Hall | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHall = useCallback(async () => {
    setError('');
    const nextHall = await getHallById(route.params.hallId);
    setHall(nextHall);
  }, [route.params.hallId]);

  useEffect(() => {
    setLoading(true);
    loadHall()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load hall details.'))
      .finally(() => setLoading(false));
  }, [loadHall]);

  if (loading) return <LoadingView message="Loading hall details..." />;
  if (error) return <View style={styles.screen}><ErrorView message={error} onRetry={() => void loadHall()} /></View>;
  if (!hall) return <View style={styles.screen}><EmptyState title="Hall not found" message="This venue may no longer be available." /></View>;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {hall.imageUrl ? <Image source={{ uri: hall.imageUrl }} style={styles.image} /> : <View style={styles.imagePlaceholder} />}
      <View style={styles.panel}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{hall.name}</Text>
          <StatusBadge status={hall.isActive ? 'active' : 'inactive'} />
        </View>
        <Text style={styles.location}>{hall.department ?? 'Shared venue'} • {normalizeVenueType(hall.venueType) || 'Venue'}</Text>
        <Text style={styles.location}>{formatVenueDescription(hall)}</Text>
        <View style={styles.capacityCard}>
          <Text style={styles.capacityValue}>{hall.capacity}</Text>
          <Text style={styles.capacityLabel}>seating capacity</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Facilities</Text>
        <View style={styles.chips}>
          {hall.facilities.length === 0 ? (
            <Text style={styles.muted}>No facilities listed.</Text>
          ) : (
            hall.facilities.map((facility) => <Text key={facility} style={styles.chip}>{facility}</Text>)
          )}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Availability</Text>
        <Text style={styles.muted}>
          Choose a booking date and time slot from the venue list to see available halls before submitting a request.
        </Text>
      </View>

      <AppButton title="Check Availability" variant="secondary" onPress={() => navigation.navigate('VenueAvailability', { hallId: hall.id })} />
      <AppButton title="Select Date and Time Slot" onPress={() => navigation.navigate('Halls')} disabled={!hall.isActive} />
    </ScrollView>
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
  image: {
    width: '100%',
    height: 220,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight
  },
  imagePlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight
  },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: fontSizes.xl,
    fontWeight: '900'
  },
  location: {
    color: colors.textMuted,
    fontSize: fontSizes.md,
    fontWeight: '700'
  },
  capacityCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md
  },
  capacityValue: {
    color: colors.primary,
    fontSize: fontSizes.title,
    fontWeight: '900'
  },
  capacityLabel: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '800'
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '900'
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  chip: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '800',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  muted: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    lineHeight: 21
  }
});
