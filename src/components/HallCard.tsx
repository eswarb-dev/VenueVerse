import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBadge } from '@/components/StatusBadge';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';
import { Hall } from '@/types/venue';

type HallCardProps = {
  hall: Hall;
  onPress?: () => void;
};

export function HallCard({ hall, onPress }: HallCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && onPress ? styles.pressed : null]}>
      {hall.imageUrl ? <Image source={{ uri: hall.imageUrl }} style={styles.image} /> : <View style={styles.imagePlaceholder} />}
      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={styles.name}>{hall.name}</Text>
          <StatusBadge status={hall.isActive ? 'active' : 'inactive'} />
        </View>
        <Text style={styles.meta}>{hall.department ?? 'Shared venue'} • {hall.venueType ?? 'Venue'}</Text>
        <Text style={styles.meta}>{hall.location || formatLocation(hall.block, hall.floor)}</Text>
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
}

export function formatLocation(block: string | null, floor: string | null) {
  return [block, floor].filter(Boolean).join(' / ') || 'Campus venue';
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
