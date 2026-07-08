import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';

type PlaceholderProps = {
  title: string;
  description: string;
};

export function Placeholder({ title, description }: PlaceholderProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm
  },
  title: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '700'
  },
  description: {
    color: colors.textMuted,
    fontSize: fontSizes.md,
    lineHeight: 22
  }
});
