import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
};

export function PrimaryButton({ title, onPress, loading, disabled, variant = 'primary' }: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' ? styles.secondary : styles.primary,
        (pressed || isDisabled) && styles.dimmed
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.primary : colors.surface} />
      ) : (
        <Text style={[styles.title, variant === 'secondary' && styles.secondaryTitle]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md
  },
  primary: {
    backgroundColor: colors.primary,
    ...shadows.card
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  dimmed: {
    opacity: 0.65
  },
  title: {
    color: colors.surface,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  secondaryTitle: {
    color: colors.primary
  }
});
