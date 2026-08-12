import { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBadge } from '@/components/StatusBadge';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';
import { normalizeVenueType } from '@/constants/venueTypes';
import { Hall } from '@/types/venue';

type HallCardProps = {
  hall: Hall;
  onPress?: () => void;
};

export const HallCard = memo(function HallCard({ hall, onPress }: HallCardProps) {
  const locationText = formatVenueDescription(hall);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && onPress ? styles.pressed : null]}>
      {hall.imageUrl ? <Image source={{ uri: hall.imageUrl }} style={styles.image} /> : <View style={styles.imagePlaceholder} />}
      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={styles.name}>{hall.name}</Text>
          <StatusBadge status={hall.isActive ? 'active' : 'inactive'} />
        </View>
        <Text style={styles.meta}>{hall.department ?? 'Shared venue'} • {normalizeVenueType(hall.venueType) || 'Venue'}</Text>
        <Text style={styles.meta}>{locationText}</Text>
        {!hall.isActive && hall.inactiveReason ? <Text style={styles.reason}>Reason: {hall.inactiveReason}</Text> : null}
        <Text style={styles.capacity}>{hall.capacity} seats</Text>
        <View style={styles.chips}>
          {hall.facilities.slice(0, 4).map((facility) => (
            <Text key={facility} style={styles.chip}>{facility}</Text>
          ))}
          {hall.facilities.length > 4 ? <Text style={styles.chip}>+{hall.facilities.length - 4}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
});

export function formatLocation(block: string | null, floor: string | null) {
  const blockLabel = block?.trim() ? `${block.trim()} - Block` : '';
  const floorLabel = floor?.trim() ? `${floor.trim()} Floor` : '';

  return [blockLabel, floorLabel].filter(Boolean).join(', ') || 'Campus venue';
}

export function formatVenueDescription(hall: Pick<Hall, 'block' | 'floor' | 'location' | 'department'>) {
  const blockFloor = formatLocation(hall.block, hall.floor);
  if (blockFloor !== 'Campus venue') return blockFloor;

  const location = hall.location?.trim();
  if (!location || isDuplicateDepartmentLocation(location, hall.department)) return 'Campus venue';
  return location;
}

function isDuplicateDepartmentLocation(location: string, department?: string | null) {
  const normalizedLocation = normalizeLocationText(location);
  const normalizedDepartment = normalizeLocationText(department ?? '');
  return Boolean(
    normalizedDepartment &&
    (normalizedLocation === normalizedDepartment ||
      normalizedLocation === `${normalizedDepartment}department` ||
      normalizedLocation === `${normalizedDepartment}dept`)
  );
}

function normalizeLocationText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9&]/g, '');
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    ...shadows.card
  },
  pressed: {
    opacity: 0.75
  },
  image: {
    width: '100%',
    height: 136,
    backgroundColor: colors.primaryLight
  },
  imagePlaceholder: {
    width: '100%',
    height: 104,
    backgroundColor: colors.primaryLight
  },
  body: {
    padding: spacing.md,
    gap: spacing.sm
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  name: {
    flex: 1,
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '900'
  },
  meta: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700'
  },
  reason: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '800'
  },
  capacity: {
    color: colors.primary,
    fontSize: fontSizes.sm,
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
    fontSize: fontSizes.xs,
    fontWeight: '800',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  }
});
