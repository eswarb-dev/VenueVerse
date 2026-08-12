import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { AppTextInput } from '@/components/AppTextInput';
import { DEPARTMENT_OPTIONS } from '@/constants/departments';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';
import { AdminStackParamList } from '@/navigation/types';
import { createAdminUser } from '@/services/profileService';
import { useAuth } from '@/store/AuthContext';
import { UserRole } from '@/types/auth';

type Props = NativeStackScreenProps<AdminStackParamList, 'AddUser'>;
type FormState = {
  fullName: string;
  email: string;
  temporaryPassword: string;
  role: UserRole;
  department: string;
};
type FormErrors = Partial<Record<keyof FormState, string>>;

const initialForm: FormState = {
  fullName: '',
  email: '',
  temporaryPassword: '',
  role: 'user',
  department: ''
};

export function AddUserScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [screenError, setScreenError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const adminDepartment = profile?.department ?? '';
  const isSuperAdmin = profile?.role === 'super_admin';
  const canCreateUsers = isSuperAdmin || (profile?.role === 'admin' && Boolean(adminDepartment));

  useEffect(() => {
    if (isSuperAdmin) return;
    if (adminDepartment) {
      setForm((current) => ({ ...current, department: adminDepartment, role: 'user' }));
    }
  }, [adminDepartment, isSuperAdmin]);

  const update = (key: keyof FormState) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSuccessMessage('');
  };

  const onGeneratePassword = () => {
    const password = generateTemporaryPassword();
    setForm((current) => ({ ...current, temporaryPassword: password }));
    setErrors((current) => ({ ...current, temporaryPassword: undefined }));
  };

  const onSubmit = async () => {
    const scopedForm = isSuperAdmin ? form : { ...form, department: adminDepartment, role: 'user' as UserRole };
    const nextErrors = validateForm(scopedForm);
    setErrors(nextErrors);
    setScreenError('');
    setSuccessMessage('');

    if (Object.keys(nextErrors).length > 0) return;

    try {
      setLoading(true);
      const result = await createAdminUser(scopedForm);
      const createdName = result.user?.full_name ?? scopedForm.fullName.trim();
      setForm({ ...initialForm, department: isSuperAdmin ? '' : adminDepartment, role: 'user' });
      setErrors({});
      setSuccessMessage(result.message || `${createdName} has been added successfully.`);
      Alert.alert(
        'User Created',
        result.message || `${createdName} has been added successfully.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      setScreenError(error instanceof Error ? error.message : 'Unable to create user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!canCreateUsers) {
    return (
      <View style={styles.screen}>
        <Text style={styles.deniedTitle}>Access denied.</Text>
        <Text style={styles.deniedMessage}>Only admins with an assigned department can create new accounts.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {screenError ? <Text style={styles.banner}>{screenError}</Text> : null}
      {successMessage ? (
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>User Created</Text>
          <Text style={styles.successMessage}>{successMessage}</Text>
          <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={({ pressed }) => [styles.successButton, pressed && styles.pressed]}>
            <Text style={styles.successButtonText}>Back to Users</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.card}>
        <AppTextInput
          label="Full name"
          value={form.fullName}
          onChangeText={update('fullName')}
          error={errors.fullName}
        />
        <AppTextInput
          label="College email"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={form.email}
          onChangeText={update('email')}
          error={errors.email}
        />
        <AppTextInput
          label="Temporary password"
          value={form.temporaryPassword}
          onChangeText={update('temporaryPassword')}
          isPassword
          error={errors.temporaryPassword}
        />
        <AppButton title="Generate Password" variant="secondary" disabled={loading} onPress={onGeneratePassword} />

        {isSuperAdmin ? (
          <>
            <ChoiceField
              label="Role"
              options={getRoleOptions(form.email)}
              value={form.role}
              error={errors.role}
              onSelect={(role) => update('role')(role)}
            />
            <ChoiceField
              label="Department"
              options={DEPARTMENT_OPTIONS}
              value={form.department}
              error={errors.department}
              onSelect={update('department')}
            />
          </>
        ) : (
          <>
            <ReadOnlyField label="Role" value="User" />
            <ReadOnlyField label="Department" value={adminDepartment} error={errors.department} />
          </>
        )}
      </View>

      <AppButton title="Create User" loading={loading} disabled={loading} onPress={onSubmit} />
    </ScrollView>
  );
}

function ReadOnlyField({
  label,
  value,
  error
}: {
  label: string;
  value: string;
  error?: string;
}) {
  return (
    <View style={styles.dropdownWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.dropdownButton, styles.readOnlyField, error ? styles.dropdownError : null]}>
        <Text style={styles.dropdownValue}>{value || 'Not assigned'}</Text>
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function ChoiceField({
  label,
  options,
  value,
  error,
  onSelect
}: {
  label: string;
  options: string[];
  value: string;
  error?: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.dropdownWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map((option) => (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            style={[styles.choiceChip, value === option && styles.choiceChipActive]}
          >
            <Text style={[styles.choiceText, value === option && styles.choiceTextActive]}>{formatChoice(option)}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  const email = form.email.trim().toLowerCase();

  if (!form.fullName.trim()) errors.fullName = 'Full name is required';
  if (!email) {
    errors.email = 'College email is required';
  } else if (!isAllowedAccountEmail(email)) {
    errors.email = 'Use official college email ending with @srec.ac.in';
  }

  if (!form.temporaryPassword) {
    errors.temporaryPassword = 'Temporary password is required';
  } else if (form.temporaryPassword.length < 6) {
    errors.temporaryPassword = 'Password must be at least 6 characters';
  }

  if (!form.role) errors.role = 'Please select a role';
  if (form.role === 'super_admin' && email !== 'venueverse.srec@gmail.com') {
    errors.email = 'Only venueverse.srec@gmail.com can be Super Admin';
  }
  if (!form.department) errors.department = 'Please select a department';

  return errors;
}

function getRoleOptions(email: string): UserRole[] {
  return email.trim().toLowerCase() === 'venueverse.srec@gmail.com'
    ? ['user', 'admin', 'super_admin']
    : ['user', 'admin'];
}

function isAllowedAccountEmail(email: string) {
  return email.endsWith('@srec.ac.in') || email === 'venueverse.srec@gmail.com';
}

function formatChoice(value: string) {
  if (value === 'super_admin') return 'Super Admin';
  return value === 'admin' ? 'Admin' : value === 'user' ? 'User' : value;
}

function generateTemporaryPassword() {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '@#$%';
  const all = `${uppercase}${lowercase}${numbers}${symbols}`;
  const seed = [
    uppercase[Math.floor(Math.random() * uppercase.length)],
    lowercase[Math.floor(Math.random() * lowercase.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    symbols[Math.floor(Math.random() * symbols.length)]
  ];

  while (seed.length < 12) {
    seed.push(all[Math.floor(Math.random() * all.length)]);
  }

  return seed.sort(() => Math.random() - 0.5).join('');
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background
  },
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background
  },
  content: {
    padding: spacing.md,
    gap: spacing.md
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md
  },
  banner: {
    backgroundColor: colors.errorSurface,
    borderColor: colors.errorBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.status.rejected,
    fontSize: fontSizes.sm,
    fontWeight: '800',
    padding: spacing.md
  },
  successCard: {
    backgroundColor: '#EAF7EF',
    borderColor: '#B7E2C7',
    borderWidth: 1,
    borderRadius: radius.md,
    gap: spacing.sm,
    padding: spacing.md
  },
  successTitle: {
    color: colors.success,
    fontSize: fontSizes.md,
    fontWeight: '900'
  },
  successMessage: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    lineHeight: 20
  },
  successButton: {
    alignSelf: 'flex-start',
    borderRadius: radius.md,
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  successButtonText: {
    color: colors.surface,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  deniedTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '900',
    textAlign: 'center'
  },
  deniedMessage: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    marginTop: spacing.sm,
    textAlign: 'center'
  },
  smallButton: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface
  },
  smallButtonText: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  pressed: {
    opacity: 0.7
  },
  dropdownWrap: {
    gap: spacing.xs
  },
  label: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '700'
  },
  dropdownButton: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  readOnlyField: {
    backgroundColor: colors.surfaceMuted
  },
  dropdownError: {
    borderColor: colors.status.rejected
  },
  dropdownValue: {
    flex: 1,
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '600',
    textTransform: 'none'
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  choiceChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface
  },
  choiceChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  choiceText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '800'
  },
  choiceTextActive: {
    color: colors.surface
  },
  placeholder: {
    color: colors.placeholder
  },
  chevron: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: '900'
  },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden'
  },
  dropdownOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft
  },
  dropdownOptionActive: {
    backgroundColor: colors.primaryLight
  },
  dropdownOptionText: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '700'
  },
  dropdownOptionTextActive: {
    color: colors.primary,
    fontWeight: '900'
  },
  fieldError: {
    color: colors.status.rejected,
    fontSize: fontSizes.xs,
    fontWeight: '800'
  }
});
