import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { AuthLayout } from '@/components/AuthLayout';
import { FormTextInput } from '@/components/FormTextInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, fontSizes, spacing } from '@/constants/theme';
import { AuthStackParamList } from '@/navigation/types';
import {
  PASSWORD_RESET_OTP_EXPIRY_SECONDS,
  PASSWORD_RESET_COOLDOWN_SECONDS,
  sendPasswordResetOtp,
  verifyPasswordResetOtp
} from '@/services/passwordResetService';
import { useAuth } from '@/store/AuthContext';

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyResetOtp'>;

const RESET_OTP_LENGTH = 8;

export function VerifyResetOtpScreen({ navigation, route }: Props) {
  const { email } = route.params;
  const { startPasswordRecovery, clearPasswordRecovery } = useAuth();
  const [otp, setOtp] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(PASSWORD_RESET_OTP_EXPIRY_SECONDS);
  const [resendCooldown, setResendCooldown] = useState(PASSWORD_RESET_COOLDOWN_SECONDS);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const expired = secondsLeft <= 0;

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((current) => Math.max(current - 1, 0)), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const onVerify = async () => {
    const nextError = validateOtp(otp);
    setFieldError(nextError);
    setError('');
    setSuccess('');
    if (nextError) return;
    if (expired) {
      setError('This code has expired. Please request a new code.');
      return;
    }

    try {
      setLoading(true);
      await startPasswordRecovery();
      await verifyPasswordResetOtp(email, otp);
      navigation.reset({ index: 0, routes: [{ name: 'ResetPassword', params: { email } }] });
    } catch (verifyError) {
      await clearPasswordRecovery();
      setError(verifyError instanceof Error ? verifyError.message : 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (resending || resendCooldown > 0) return;

    try {
      setResending(true);
      setError('');
      setSuccess('');
      setFieldError(undefined);
      await sendPasswordResetOtp(email);
      setOtp('');
      setSecondsLeft(PASSWORD_RESET_OTP_EXPIRY_SECONDS);
      setResendCooldown(PASSWORD_RESET_COOLDOWN_SECONDS);
      setSuccess('We sent a reset code to your email.');
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Could not send reset code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout title="Verify Code" subtitle={`Enter the ${RESET_OTP_LENGTH}-digit code sent to ${email}.`}>
      {error ? <Text style={styles.banner}>{error}</Text> : null}
      {success ? <Text style={styles.successBanner}>{success}</Text> : null}
      <Text style={[styles.timer, expired && styles.timerExpired]}>
        {expired ? 'Code expired' : `Code expires in ${formatCountdown(secondsLeft)}`}
      </Text>
      <FormTextInput
        label="Reset code"
        keyboardType="number-pad"
        maxLength={RESET_OTP_LENGTH}
        value={otp}
        onChangeText={(value) => {
          setOtp(value.replace(/\D/g, '').slice(0, RESET_OTP_LENGTH));
          setFieldError(undefined);
          setError('');
          setSuccess('');
        }}
        error={fieldError}
      />
      <PrimaryButton title="Verify Code" loading={loading} disabled={loading || expired} onPress={onVerify} />
      {resendCooldown > 0 ? <Text style={styles.cooldown}>You can request another code in {resendCooldown}s</Text> : null}
      <PrimaryButton
        title={resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : 'Resend Code'}
        variant="secondary"
        loading={resending}
        disabled={resending || resendCooldown > 0}
        onPress={onResend}
      />
      <Pressable onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Back to Login</Text>
      </Pressable>
    </AuthLayout>
  );
}

function validateOtp(value: string) {
  const otpRegex = new RegExp(`^\\d{${RESET_OTP_LENGTH}}$`);
  if (!value.trim()) return 'Reset code is required.';
  if (!otpRegex.test(value.trim())) return `Enter the ${RESET_OTP_LENGTH}-digit reset code.`;
  return undefined;
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
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
  timer: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '900',
    textAlign: 'center'
  },
  timerExpired: {
    color: colors.status.rejected
  },
  cooldown: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    textAlign: 'center'
  },
  link: {
    alignSelf: 'center',
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '800'
  }
});
