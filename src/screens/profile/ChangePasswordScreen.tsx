import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { AppTextInput } from '@/components/AppTextInput';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { AppStackParamList } from '@/navigation/types';
import { useAuth } from '@/store/AuthContext';

type Props = NativeStackScreenProps<AppStackParamList, 'ChangePassword'>;

type PasswordErrors = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export function ChangePasswordScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  const validate = () => {
    const nextErrors: PasswordErrors = {};
    if (!currentPassword) nextErrors.currentPassword = 'Current password is required.';
    if (!newPassword) nextErrors.newPassword = 'New password is required.';
    else if (newPassword.length < 6) nextErrors.newPassword = 'Password must be at least 6 characters.';
    if (confirmPassword !== newPassword) nextErrors.confirmPassword = 'Passwords do not match.';
    if (currentPassword && newPassword && currentPassword === newPassword) {
      nextErrors.newPassword = 'New password should not be the same as current password.';
    }
    return nextErrors;
  };

  const onUpdatePassword = async () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    setError('');
    if (Object.keys(nextErrors).length > 0) return;

    if (!profile?.email) {
      setError('Profile email is unavailable. Please sign in again.');
      return;
    }

    try {
      setUpdating(true);
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword
      });

      if (verifyError) {
        setErrors({ currentPassword: 'Current password is incorrect.' });
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        setError(updateError.message || 'Failed to update password. Please try again.');
        return;
      }

      Alert.alert('Password updated', 'Password updated successfully.', [
        {
          text: 'OK',
          onPress: () => navigation.goBack()
        }
      ]);
    } catch {
      setError('Failed to update password. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.info}>Update your temporary password after your first login.</Text>
      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      <AppTextInput
        label="Current password"
        value={currentPassword}
        onChangeText={(value) => {
          setCurrentPassword(value);
          setErrors((current) => ({ ...current, currentPassword: undefined }));
        }}
        isPassword
        autoCapitalize="none"
        error={errors.currentPassword}
      />
      <AppTextInput
        label="New password"
        value={newPassword}
        onChangeText={(value) => {
          setNewPassword(value);
          setErrors((current) => ({ ...current, newPassword: undefined }));
        }}
        isPassword
        autoCapitalize="none"
        error={errors.newPassword}
      />
      <AppTextInput
        label="Confirm new password"
        value={confirmPassword}
        onChangeText={(value) => {
          setConfirmPassword(value);
          setErrors((current) => ({ ...current, confirmPassword: undefined }));
        }}
        isPassword
        autoCapitalize="none"
        error={errors.confirmPassword}
      />
      <AppButton title={updating ? 'Updating...' : 'Update Password'} loading={updating} disabled={updating} onPress={onUpdatePassword} />
      <AppButton title="Cancel" variant="secondary" disabled={updating} onPress={() => navigation.goBack()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: spacing.md,
    gap: spacing.md
  },
  info: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    lineHeight: 20
  },
  errorBanner: {
    color: colors.status.rejected,
    backgroundColor: colors.errorSurface,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSizes.sm,
    fontWeight: '700'
  }
});
