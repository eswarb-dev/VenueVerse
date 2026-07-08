import { Text, TextInput, TextInputProps, StyleSheet, View } from 'react-native';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';

type FormTextInputProps = TextInputProps & {
  label: string;
  error?: string;
};

export function FormTextInput({ label, error, style, ...props }: FormTextInputProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#98A2B3"
        style={[styles.input, error ? styles.inputError : null, style]}
        {...props}
      />
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
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '600'
  },
  inputError: {
    borderColor: colors.status.rejected
  },
  error: {
    color: colors.status.rejected,
    fontSize: fontSizes.xs,
    fontWeight: '800'
  }
});
