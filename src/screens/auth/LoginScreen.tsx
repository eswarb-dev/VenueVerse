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
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<ValidationErrors<'email' | 'password'>>({});

  const onSubmit = async () => {
    const nextErrors = validateLogin({ email, password });
    setErrors(nextErrors);
    setError('');

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

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in with your VenueVerse account."
    >
      {error ? <Text style={styles.banner}>{error}</Text> : null}
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
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        error={errors.password}
      />
      <PrimaryButton title="Sign In" loading={loading} onPress={onSubmit} />
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
  helper: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center'
  }
});
