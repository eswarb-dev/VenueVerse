import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';

type FormTextInputProps = TextInputProps & {
  label: string;
  error?: string;
  isPassword?: boolean;
};

export function FormTextInput({ label, error, isPassword = false, secureTextEntry, style, ...props }: FormTextInputProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const shouldSecureText = isPassword ? !passwordVisible : secureTextEntry;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, error ? styles.inputError : null]}>
        <TextInput
          placeholderTextColor={colors.placeholder}
          secureTextEntry={shouldSecureText}
          style={[styles.input, isPassword && styles.passwordInput, style]}
          {...props}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
            onPress={() => setPasswordVisible((current) => !current)}
            style={({ pressed }) => [styles.passwordToggle, pressed && styles.passwordTogglePressed]}
          >
            <Ionicons
              name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs
  },
  label: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '700'
  },
  inputWrap: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center'
  },
  input: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '600'
  },
  passwordInput: {
    paddingRight: spacing.sm
  },
  inputError: {
    borderColor: colors.status.rejected
  },
  passwordToggle: {
    width: 48,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center'
  },
  passwordTogglePressed: {
    opacity: 0.65
  },
  error: {
    color: colors.status.rejected,
    fontSize: fontSizes.xs,
    fontWeight: '800'
  }
});
