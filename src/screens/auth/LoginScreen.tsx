import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { AuthLayout } from '@/components/AuthLayout';
import { FormTextInput } from '@/components/FormTextInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, fontSizes, spacing } from '@/constants/theme';
import { AuthStackParamList } from '@/navigation/types';
import { useAuth } from '@/store/AuthContext';
import { validateLogin, ValidationErrors } from '@/utils/validators';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { login, loginWithGoogle, authMessage, clearAuthMessage } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<ValidationErrors<'email' | 'password'>>({});

  const onSubmit = async () => {
    const nextErrors = validateLogin({ email, password });
    setErrors(nextErrors);
    setError('');
    clearAuthMessage();

    if (Object.keys(nextErrors).length > 0) return;

    try {
      setLoading(true);
      await login(email, password);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onGoogleSubmit = async () => {
    setError('');
    clearAuthMessage();

    try {
      setGoogleLoading(true);
      await loginWithGoogle();
    } catch {
      setError('Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in with your VenueVerse account."
      variant="venueverseGradient"
    >
      {error || authMessage ? <Text style={styles.banner}>{error || authMessage}</Text> : null}
      <FormTextInput
        label="College email"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
      />
      <FormTextInput
        label="Password"
        isPassword
        value={password}
        onChangeText={setPassword}
        error={errors.password}
      />
      <PrimaryButton title="Sign In" loading={loading} onPress={onSubmit} />
      <Text style={styles.divider}>or</Text>
      <Pressable disabled={googleLoading || loading} onPress={onGoogleSubmit} style={({ pressed }) => [styles.googleButton, pressed && styles.googleButtonPressed]}>
        <Text style={styles.googleIcon}>G</Text>
        <Text style={styles.googleText}>{googleLoading ? 'Opening Google...' : 'Continue with Google'}</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('ForgotPassword')}>
        <Text style={styles.link}>Forgot password?</Text>
      </Pressable>
      <Text style={styles.helper}>Need access? Contact your department administrator.</Text>
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
  },
  link: {
    alignSelf: 'center',
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '800'
  },
  divider: {
    alignSelf: 'center',
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '800'
  },
  googleButton: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md
  },
  googleButtonPressed: {
    opacity: 0.75
  },
  googleIcon: {
    color: colors.primary,
    fontSize: fontSizes.lg,
    fontWeight: '900'
  },
  googleText: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '900'
  },
  helper: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center'
  }
});
