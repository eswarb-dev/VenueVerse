import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';

export function LoadingView({ message = 'Loading...' }: { message?: string }) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.background
  },
  text: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '800'
  }
});
