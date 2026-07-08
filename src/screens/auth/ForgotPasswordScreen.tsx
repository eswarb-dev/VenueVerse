import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { AuthLayout } from '@/components/AuthLayout';
import { FormTextInput } from '@/components/FormTextInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, fontSizes, spacing } from '@/constants/theme';
import { AuthStackParamList } from '@/navigation/types';
import { useAuth } from '@/store/AuthContext';
import { validateEmail } from '@/utils/validators';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();

  const onSubmit = async () => {
    const emailError = validateEmail(email);
    setFieldError(emailError);
    setError('');
    if (emailError) return;

    try {
      setLoading(true);
      await resetPassword(email);
      Alert.alert('Reset email sent', 'Check your inbox for password reset instructions.');
      navigation.goBack();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Reset password" subtitle="Enter your college email and we will send recovery instructions.">
      {error ? <Text style={styles.banner}>{error}</Text> : null}
      <FormTextInput
        label="College email"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        error={fieldError}
      />
      <PrimaryButton title="Send Reset Link" loading={loading} onPress={onSubmit} />
      <PrimaryButton title="Back to Sign In" variant="secondary" onPress={() => navigation.goBack()} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.errorSurface,
    borderColor: colors.errorBorder,
    borderWidth: 1,
    borderRadius: 8,
    color: colors.status.rejected,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    padding: spacing.md
  }
});
