import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AuthLayout } from '@/components/AuthLayout';
import { FormTextInput } from '@/components/FormTextInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, fontSizes, spacing } from '@/constants/theme';
import { AuthStackParamList } from '@/navigation/types';
import { PASSWORD_RESET_COOLDOWN_SECONDS, sendPasswordResetOtp } from '@/services/passwordResetService';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [fieldError, setFieldError] = useState<string | undefined>();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((current) => Math.max(current - 1, 0)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const onSubmit = async () => {
    if (loading || cooldown > 0) return;

    const emailError = validateCollegeEmail(email);
    setFieldError(emailError);
    setError('');
    setSuccess('');
    if (emailError) return;

    try {
      setLoading(true);
      const normalizedEmail = email.trim().toLowerCase();
      await sendPasswordResetOtp(normalizedEmail);
      setSuccess('We sent a reset code to your email.');
      setCooldown(PASSWORD_RESET_COOLDOWN_SECONDS);
      navigation.navigate('VerifyResetOtp', { email: normalizedEmail });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not send reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Forgot Password" subtitle="Enter your college email to receive a password reset code.">
      {error ? <Text style={styles.banner}>{error}</Text> : null}
      {success ? <Text style={styles.successBanner}>{success}</Text> : null}
      <FormTextInput
        label="College email"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setFieldError(undefined);
          setError('');
          setSuccess('');
        }}
        error={fieldError}
      />
      {cooldown > 0 ? <Text style={styles.cooldown}>You can request another code in {cooldown}s</Text> : null}
      <PrimaryButton
        title={cooldown > 0 ? `Send OTP in ${cooldown}s` : 'Send OTP'}
        loading={loading}
        disabled={loading || cooldown > 0}
        onPress={onSubmit}
      />
      <PrimaryButton title="Back to Sign In" variant="secondary" onPress={() => navigation.goBack()} />
    </AuthLayout>
  );
}

function validateCollegeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!email) return 'Enter a valid college email.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid college email.';
  if (!email.endsWith('@srec.ac.in')) return 'Enter a valid college email.';
  return undefined;
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
  },
  successBanner: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 8,
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '800',
    padding: spacing.md
  },
  cooldown: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    textAlign: 'center'
  }
});
