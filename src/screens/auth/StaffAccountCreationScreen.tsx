import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FormTextInput } from '@/components/FormTextInput';
import { PrimaryButton } from '@/components/PrimaryButton';
import { DEPARTMENT_OPTIONS } from '@/constants/departments';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { completeGoogleStaffOnboarding } from '@/services/profileService';
import { useAuth } from '@/store/AuthContext';
import { getGoogleAccessError } from '@/utils/emailAccess';

export function StaffAccountCreationScreen() {
  const { user, completeStaffOnboarding, logout } = useAuth();
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const email = user?.email ?? '';

  const onSubmit = async () => {
    setError('');
    const validationError = validateForm({ email, fullName, department, password, confirmPassword });
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) throw new Error('Couldn’t set your password. Please try again.');

      await completeGoogleStaffOnboarding({ fullName, department });
      await completeStaffOnboarding();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Couldn’t create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onCancel = () => {
    Alert.alert('Cancel account creation?', 'You will be signed out of this Google session.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => void logout() }
    ]);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>Create Staff Account</Text>
        <Text style={styles.subtitle}>Complete your VenueVerse profile to continue.</Text>
      </View>

      {error ? <Text style={styles.banner}>{error}</Text> : null}

      <FormTextInput label="Email" value={email} editable={false} />
      <FormTextInput label="Name" value={fullName} onChangeText={setFullName} placeholder="Enter your name" />
      <FormTextInput label="Password" isPassword value={password} onChangeText={setPassword} placeholder="Create a password" />
      <FormTextInput label="Confirm Password" isPassword value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" />

      <View style={styles.section}>
        <Text style={styles.label}>Department</Text>
        <View style={styles.chips}>
          {DEPARTMENT_OPTIONS.map((option) => {
            const selected = department === option;
            return (
              <Pressable key={option} onPress={() => setDepartment(option)} style={[styles.chip, selected && styles.chipSelected]}>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Role</Text>
        <Text style={styles.lockedRole}>User</Text>
      </View>

      <PrimaryButton title="Create Account" loading={loading} onPress={onSubmit} />
      <Pressable disabled={loading} onPress={onCancel}>
        <Text style={styles.cancel}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

function validateForm(values: {
  email: string;
  fullName: string;
  department: string;
  password: string;
  confirmPassword: string;
}) {
  const accessError = getGoogleAccessError(values.email);
  if (accessError) return accessError;
  if (values.fullName.trim().length < 2) return 'Please enter your name.';
  if (!values.department.trim()) return 'Please select your department.';
  if (values.password.length < 8) return 'Password must be at least 8 characters.';
  if (values.password !== values.confirmPassword) return 'Passwords do not match.';
  return '';
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md
  },
  header: {
    gap: spacing.xs
  },
  title: {
    color: colors.text,
    fontSize: fontSizes.title,
    fontWeight: '900'
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSizes.md,
    fontWeight: '700'
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
  },
  section: {
    gap: spacing.sm
  },
  label: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '700'
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  chipText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '800'
  },
  chipTextSelected: {
    color: colors.surface
  },
  lockedRole: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    color: colors.primary,
    fontSize: fontSizes.md,
    fontWeight: '900',
    padding: spacing.md
  },
  cancel: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '800',
    textAlign: 'center'
  }
});
