import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';
import { BookingStatus } from '@/types/venue';

type StatusBadgeProps = {
  status: BookingStatus | 'active' | 'inactive';
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const color = status === 'active' ? colors.status.approved : status === 'inactive' ? colors.textMuted : colors.status[status];

  return (
    <View style={[styles.badge, { borderColor: `${color}40`, backgroundColor: `${color}12` }]}>
      <Text style={[styles.text, { color }]}>{status.replace('_', ' ').toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  text: {
    fontSize: fontSizes.xs,
    fontWeight: '900'
  }
});
