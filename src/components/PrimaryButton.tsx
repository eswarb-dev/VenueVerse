import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive';
  icon?: keyof typeof Ionicons.glyphMap;
};

export function PrimaryButton({ title, onPress, loading, disabled, variant = 'primary', icon }: PrimaryButtonProps) {
  const isDisabled = disabled || loading;
  const isSecondary = variant === 'secondary';
  const isDestructive = variant === 'destructive';
  const contentColor = isSecondary ? colors.primary : isDestructive ? colors.danger : colors.surface;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' ? styles.secondary : variant === 'destructive' ? styles.destructive : styles.primary,
        (pressed || isDisabled) && styles.dimmed
      ]}
    >
      {loading ? (
        <ActivityIndicator color={contentColor} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={18} color={contentColor} /> : null}
          <Text style={[styles.title, (isSecondary || isDestructive) && styles.secondaryTitle, isDestructive && styles.destructiveTitle]}>
            {title}
          </Text>
        </View>
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
  destructive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm
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
  },
  destructiveTitle: {
    color: colors.danger
  }
});
