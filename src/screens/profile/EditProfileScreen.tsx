import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { AppTextInput } from '@/components/AppTextInput';
import { DEPARTMENT_OPTIONS } from '@/constants/departments';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';
import { AppStackParamList } from '@/navigation/types';
import { updateOwnProfile } from '@/services/profileService';
import { useAuth } from '@/store/AuthContext';

type Props = NativeStackScreenProps<AppStackParamList, 'EditProfile'>;

type FormErrors = {
  fullName?: string;
  department?: string;
};

export function EditProfileScreen({ navigation }: Props) {
  const { profile, user, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.fullName ?? '');
  const [department, setDepartment] = useState(profile?.department ?? '');
  const [errors, setErrors] = useState<FormErrors>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    const nextErrors: FormErrors = {};
    if (!fullName.trim()) nextErrors.fullName = 'Full name is required.';
    if (!department.trim()) nextErrors.department = 'Department is required.';
    setErrors(nextErrors);
    setError('');
    if (Object.keys(nextErrors).length > 0) return;

    const userId = profile?.id ?? user?.id;
    if (!userId) {
      setError('Profile session is unavailable. Please sign in again.');
      return;
    }

    try {
      setSaving(true);
      await updateOwnProfile(userId, { fullName, department });
      await refreshProfile();
      Alert.alert('Profile updated', 'Your profile details have been saved.', [
        {
          text: 'OK',
          onPress: () => navigation.goBack()
        }
      ]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account details</Text>
        <AppTextInput
          label="Full name"
          value={fullName}
          onChangeText={(value) => {
            setFullName(value);
            setErrors((current) => ({ ...current, fullName: undefined }));
          }}
          error={errors.fullName}
        />

        <View style={styles.lockedPanel}>
          <Text style={styles.lockedLabel}>College email</Text>
          <Text style={styles.lockedText}>{profile?.email ?? 'Not available'}</Text>
        </View>

        <View style={styles.lockedPanel}>
          <Text style={styles.lockedLabel}>Role</Text>
          <Text style={styles.lockedText}>{(profile?.role ?? 'user').toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Department</Text>
        <Text style={styles.helper}>Choose the department assigned to your account.</Text>
        <View style={styles.chips}>
          {DEPARTMENT_OPTIONS.map((option) => {
            const active = department === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                onPress={() => {
                  setDepartment(option);
                  setErrors((current) => ({ ...current, department: undefined }));
                }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
        {errors.department ? <Text style={styles.fieldError}>{errors.department}</Text> : null}
      </View>

      <AppButton title={saving ? 'Saving...' : 'Save Profile'} loading={saving} disabled={saving} onPress={onSave} />
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
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card
  },
  sectionTitle: {
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
  error: {
    color: colors.status.rejected,
    backgroundColor: colors.errorSurface,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSizes.sm,
    fontWeight: '700'
  },
  lockedPanel: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs
  },
  lockedLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  lockedText: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '800'
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
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  chipText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '800'
  },
  chipTextActive: {
    color: colors.surface
  },
  fieldError: {
    color: colors.status.rejected,
    fontSize: fontSizes.xs,
    fontWeight: '800'
  }
});
