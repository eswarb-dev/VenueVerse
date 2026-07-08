import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';

type ErrorViewProps = {
  message: string;
  onRetry?: () => void;
};

export function ErrorView({ message, onRetry }: ErrorViewProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? <AppButton title="Try Again" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card
  },
  title: {
    color: colors.status.rejected,
    fontSize: fontSizes.md,
    fontWeight: '900'
  },
  message: {
    color: colors.text,
    fontSize: fontSizes.sm,
    lineHeight: 21,
    fontWeight: '600'
  }
});
