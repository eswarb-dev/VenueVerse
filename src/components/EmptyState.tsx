import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';

type EmptyStateProps = {
  title: string;
  message?: string;
};

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card
  },
  title: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '900',
    textAlign: 'center'
  },
  message: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    lineHeight: 21,
    textAlign: 'center'
  }
});
