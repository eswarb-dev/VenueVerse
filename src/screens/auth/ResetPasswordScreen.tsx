import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AuthLayout } from '@/components/AuthLayout';
import { FormTextInput } from '@/components/FormTextInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';
import { AuthStackParamList } from '@/navigation/types';
import { clearRecoverySession, updateRecoveredPassword } from '@/services/passwordResetService';
import { useAuth } from '@/store/AuthContext';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

type PasswordErrors = {
  newPassword?: string;
  confirmPassword?: string;
};

export function ResetPasswordScreen({ navigation, route }: Props) {
  const { finishPasswordRecovery } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    const nextErrors = validatePasswords(newPassword, confirmPassword);
    setErrors(nextErrors);
    setError('');
    if (Object.keys(nextErrors).length > 0) return;

    try {
      setLoading(true);
      await updateRecoveredPassword(newPassword);
      await clearRecoverySession();
      await finishPasswordRecovery();
      Alert.alert('Password Updated', 'You can now sign in with your new password.', [
        {
          text: 'OK',
          onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })
        }
      ]);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Could not update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Set New Password" subtitle="Create a new password for your VenueVerse account.">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconWrap}>
              <Ionicons name="lock-closed-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.cardTitle}>Create New Password</Text>
              <Text style={styles.helper}>Enter a new password for your VenueVerse account.</Text>
            </View>
          </View>

          {error ? <Text style={styles.banner}>{error}</Text> : null}

          <FormTextInput
            label="New password"
            isPassword
            autoCapitalize="none"
            value={newPassword}
            onChangeText={(value) => {
              setNewPassword(value);
              setErrors((current) => ({ ...current, newPassword: undefined }));
              setError('');
            }}
            error={errors.newPassword}
          />
          <FormTextInput
            label="Confirm password"
            isPassword
            autoCapitalize="none"
            value={confirmPassword}
            onChangeText={(value) => {
              setConfirmPassword(value);
              setErrors((current) => ({ ...current, confirmPassword: undefined }));
              setError('');
            }}
            error={errors.confirmPassword}
          />
          <PrimaryButton title="Update Password" loading={loading} disabled={loading} onPress={onSubmit} />
        </View>
      </ScrollView>
    </AuthLayout>
  );
}

function validatePasswords(newPassword: string, confirmPassword: string): PasswordErrors {
  const errors: PasswordErrors = {};
  if (!newPassword) errors.newPassword = 'New password is required.';
  else if (newPassword.length < 6) errors.newPassword = 'Password must be at least 6 characters.';
  if (!confirmPassword) errors.confirmPassword = 'Confirm password is required.';
  else if (confirmPassword !== newPassword) errors.confirmPassword = 'Passwords do not match.';
  return errors;
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    gap: spacing.md,
    padding: spacing.lg,
    ...shadows.card
  },
  cardHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start'
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs
  },
  cardTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '900'
  },
  helper: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    lineHeight: 20
  },
  banner: {
    backgroundColor: colors.errorSurface,
    borderColor: colors.errorBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.status.rejected,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    padding: spacing.md
  }
});
