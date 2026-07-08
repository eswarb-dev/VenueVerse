import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { AppTextInput } from '@/components/AppTextInput';
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

const roles: UserRole[] = ['user', 'admin', 'super_admin'];
const addUserDepartmentOptions = [
  'IT',
  'AI&DS',
  'EEE',
  'ECE',
  'BME',
  'CSE',
  'CIVIL',
  'AERO',
  'MBA',
  'NANO',
  'MECH',
  'EIE',
  'CDPD',
  'Library',
  'Others'
];

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
  const [roleOpen, setRoleOpen] = useState(false);
  const [departmentOpen, setDepartmentOpen] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [screenError, setScreenError] = useState('');

  const canCreateUsers = profile?.role === 'super_admin';

  const update = (key: keyof FormState) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const selectRole = (role: UserRole) => {
    setForm((current) => ({ ...current, role }));
    setErrors((current) => ({ ...current, role: undefined }));
    setRoleOpen(false);
  };

  const selectDepartment = (department: string) => {
    setForm((current) => ({ ...current, department }));
    setErrors((current) => ({ ...current, department: undefined }));
    setDepartmentOpen(false);
  };

  const onGeneratePassword = () => {
    const password = generateTemporaryPassword();
    setForm((current) => ({ ...current, temporaryPassword: password }));
    setErrors((current) => ({ ...current, temporaryPassword: undefined }));
    setPasswordVisible(true);
  };

  const onSubmit = async () => {
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    setScreenError('');

    if (Object.keys(nextErrors).length > 0) return;

    try {
      setLoading(true);
      await createAdminUser(form);
      Alert.alert(
        'User created',
        'User created successfully. Share the temporary password with the user securely.',
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
        <Text style={styles.deniedMessage}>Only super_admin users can create new accounts.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {screenError ? <Text style={styles.banner}>{screenError}</Text> : null}

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
        <View style={styles.passwordRow}>
          <View style={styles.passwordInput}>
            <AppTextInput
              label="Temporary password"
              value={form.temporaryPassword}
              onChangeText={update('temporaryPassword')}
              secureTextEntry={!passwordVisible}
              error={errors.temporaryPassword}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPasswordVisible((current) => !current)}
            style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
          >
            <Text style={styles.smallButtonText}>{passwordVisible ? 'Hide' : 'Show'}</Text>
          </Pressable>
        </View>
        <AppButton title="Generate Password" variant="secondary" disabled={loading} onPress={onGeneratePassword} />

        <Dropdown
          label="Role"
          value={form.role}
          placeholder="Select role"
          open={roleOpen}
          error={errors.role}
          options={roles}
          onToggle={() => {
            setRoleOpen((current) => !current);
            setDepartmentOpen(false);
          }}
          onSelect={(value) => selectRole(value as UserRole)}
        />

        <Dropdown
          label="Department"
          value={form.department}
          placeholder="Select department"
          open={departmentOpen}
          error={errors.department}
          options={addUserDepartmentOptions}
          onToggle={() => {
            setDepartmentOpen((current) => !current);
            setRoleOpen(false);
          }}
          onSelect={selectDepartment}
        />
      </View>

      <AppButton title="Create User" loading={loading} disabled={loading} onPress={onSubmit} />
    </ScrollView>
  );
}

function Dropdown({
  label,
  value,
  placeholder,
  open,
  error,
  options,
  onToggle,
  onSelect
}: {
  label: string;
  value: string;
  placeholder: string;
  open: boolean;
  error?: string;
  options: string[];
  onToggle: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.dropdownWrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onToggle}
        style={[styles.dropdownButton, error ? styles.dropdownError : null]}
      >
        <Text style={[styles.dropdownValue, !value && styles.placeholder]}>{value || placeholder}</Text>
        <Text style={styles.chevron}>{open ? '^' : 'v'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.dropdownMenu}>
          {options.map((option) => {
            const active = value === option;
            return (
              <Pressable
                key={option}
                onPress={() => onSelect(option)}
                style={[styles.dropdownOption, active && styles.dropdownOptionActive]}
              >
                <Text style={[styles.dropdownOptionText, active && styles.dropdownOptionTextActive]}>
                  {formatOptionLabel(option)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
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
  } else if (!email.endsWith('@srec.ac.in')) {
    errors.email = 'Use official college email ending with @srec.ac.in';
  }

  if (!form.temporaryPassword) {
    errors.temporaryPassword = 'Temporary password is required';
  } else if (form.temporaryPassword.length < 6) {
    errors.temporaryPassword = 'Password must be at least 6 characters';
  }

  if (!form.role) errors.role = 'Please select a role';
  if (!form.department) errors.department = 'Please select a department';

  return errors;
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

function formatOptionLabel(value: string) {
  return value.replace('_', ' ');
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
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm
  },
  passwordInput: {
    flex: 1
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
  placeholder: {
    color: '#98A2B3'
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
