# Profile Flow Documentation

This document contains the complete code workflow for the Profile screen and its associated sub-screens (Edit Profile, Change Password, Settings) as requested. You can use these scripts to implement this flow in your clone project.

## Directory Structure
The files are organized as follows:
```text
src/
  screens/
    profile/
      ProfileScreen.tsx
      EditProfileScreen.tsx
      ChangePasswordScreen.tsx
      SettingsScreen.tsx
  components/
    PrimaryButton.tsx
    AppButton.tsx
    FormTextInput.tsx
  constants/
    theme.ts
    departments.ts
  types/
    auth.ts
  store/
    AuthContext.tsx
  services/
    profileService.ts
```

---

## 1. Main Screens

### ProfileScreen.tsx
This is the main entry point shown in the screenshot.
```tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
import { AppStackParamList } from '@/navigation/types';
import { useAuth } from '@/store/AuthContext';
import { UserRole } from '@/types/auth';

type Props = NativeStackScreenProps<AppStackParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const { profile, user, logout } = useAuth();

  const confirmLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout }
    ]);
  };

  const name = profile?.fullName ?? 'VenueVerse User';
  const email = profile?.email ?? user?.email ?? '';
  const role = profile?.role ?? 'user';
  const department = profile?.department ?? 'General';
  const initials = name.charAt(0).toUpperCase();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.email}>{email}</Text>
        <View style={styles.badgesRow}>
          <RoleBadge role={role} />
          <View style={styles.deptBadge}>
             <Text style={styles.deptBadgeText}>{department}</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Account</Text>
        <ActionRow
          icon="person-outline"
          label="Edit Profile"
          onPress={() => navigation.navigate('EditProfile')}
        />
        <ActionRow
          icon="lock-closed-outline"
          label="Change Password"
          onPress={() => navigation.navigate('ChangePassword')}
        />
        <ActionRow
          icon="settings-outline"
          label="Preferences"
          onPress={() => navigation.navigate('Settings')}
          isLast
        />
      </View>

      <View style={styles.logoutWrap}>
        <PrimaryButton 
          title="Log Out" 
          variant="destructive" 
          icon="log-out-outline"
          onPress={confirmLogout} 
        />
      </View>
    </ScrollView>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const label = role.replace('_', ' ').toUpperCase();
  const isAdmin = role === 'admin' || role === 'super_admin';
  const color = isAdmin ? colors.primary : colors.textMuted;
  const bgColor = isAdmin ? colors.primaryLight : colors.surfaceMuted;
  
  return (
    <View style={[styles.roleBadge, { borderColor: `${color}30`, backgroundColor: bgColor }]}>
      <Ionicons name="shield-checkmark" size={12} color={color} />
      <Text style={[styles.roleBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

function ActionRow({ icon, label, onPress, isLast }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; isLast?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        !isLast && styles.actionRowBorder,
        pressed && styles.actionRowPressed
      ]}
    >
      <View style={styles.actionIconWrap}>
        <Ionicons name={icon} size={20} color={colors.text} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: spacing.md,
    gap: spacing.lg
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadows.card
  },
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.subtle
  },
  avatarText: {
    color: colors.surface,
    ...typography.heading,
    fontSize: 32,
    lineHeight: 38
  },
  name: {
    color: colors.text,
    ...typography.heading,
  },
  email: {
    color: colors.textMuted,
    ...typography.body,
    marginTop: spacing.xs,
    marginBottom: spacing.md
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1
  },
  roleBadgeText: {
    ...typography.captionBold,
  },
  deptBadge: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1
  },
  deptBadgeText: {
    color: colors.textMuted,
    ...typography.captionBold,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
    ...shadows.subtle
  },
  sectionTitle: {
    color: colors.textMuted,
    ...typography.captionBold,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  actionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft
  },
  actionRowPressed: {
    backgroundColor: colors.surfaceMuted
  },
  actionIconWrap: {
    width: 32,
    alignItems: 'center'
  },
  actionLabel: {
    flex: 1,
    color: colors.text,
    ...typography.bodyBold,
  },
  logoutWrap: {
    marginTop: spacing.sm
  }
});
```

### EditProfileScreen.tsx
```tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { FormTextInput } from '@/components/FormTextInput';
import { DEPARTMENT_OPTIONS } from '@/constants/departments';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
import { AppStackParamList } from '@/navigation/types';
import { updateOwnProfile } from '@/services/profileService';
import { useAuth } from '@/store/AuthContext';

type Props = NativeStackScreenProps<AppStackParamList, 'EditProfile'>;

export function EditProfileScreen({ navigation }: Props) {
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.fullName ?? '');
  const [department, setDepartment] = useState(profile?.department ?? '');
  const [departmentModalVisible, setDepartmentModalVisible] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!profile) return;
    if (!fullName.trim()) {
      setError('Full name cannot be empty.');
      return;
    }
    if (!department.trim()) {
      setError('Department is required.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await updateOwnProfile(profile.id, { fullName, department });
      await refreshProfile();
      Alert.alert('Success', 'Your profile has been updated.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="person-outline" size={20} color={colors.primary} />
          <Text style={styles.cardTitle}>Personal Information</Text>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={colors.destructive} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <FormTextInput
          label="Full name"
          value={fullName}
          onChangeText={(value) => {
             setFullName(value);
             setError('');
          }}
          placeholder="e.g. John Doe"
          required
        />

        <View style={styles.selectorWrap}>
          <Text style={styles.fieldLabel}>
             Department <Text style={styles.required}>*</Text>
          </Text>
          <Pressable 
             onPress={() => setDepartmentModalVisible(true)}
             style={styles.dropdownRow}
          >
             <Text style={[styles.dropdownValue, !department && styles.dropdownPlaceholder]}>
                {department || 'Select your department'}
             </Text>
             <Ionicons name="chevron-down" size={16} color={colors.primary} />
          </Pressable>
        </View>

        <FormTextInput
          label="College email"
          value={profile?.email}
          editable={false}
          style={styles.disabledInput}
          hint="Email address cannot be changed."
        />
      </View>

      <AppButton title="Save Changes" loading={saving} disabled={saving} onPress={onSave} />

      <Modal visible={departmentModalVisible} transparent animationType="slide" onRequestClose={() => setDepartmentModalVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDepartmentModalVisible(false)}>
          <Pressable style={styles.optionSheet}>
            <View style={styles.optionHeader}>
              <Text style={styles.optionTitle}>Select Department</Text>
              <Pressable onPress={() => setDepartmentModalVisible(false)} style={styles.optionCloseButton}>
                <Text style={styles.optionCloseText}>Cancel</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.optionList} contentContainerStyle={styles.optionListContent}>
              {DEPARTMENT_OPTIONS.map((option) => {
                const selected = option === department;
                return (
                  <Pressable
                    key={option}
                    onPress={() => {
                      setDepartment(option);
                      setError('');
                      setDepartmentModalVisible(false);
                    }}
                    style={[styles.optionItem, selected && styles.optionItemSelected]}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option}</Text>
                    {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
    ...shadows.subtle
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs
  },
  cardTitle: {
    color: colors.text,
    ...typography.subheading,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.destructiveLight,
    borderColor: colors.destructiveBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    flex: 1,
    color: colors.destructive,
    ...typography.captionBold,
  },
  disabledInput: {
    backgroundColor: colors.surfaceMuted,
    color: colors.textMuted
  },
  selectorWrap: {
    gap: spacing.xs
  },
  fieldLabel: {
    color: colors.text,
    ...typography.bodyBold,
  },
  required: {
    color: colors.destructive
  },
  dropdownRow: {
    minHeight: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  dropdownValue: {
    color: colors.text,
    ...typography.bodyBold,
  },
  dropdownPlaceholder: {
    color: colors.textMuted,
    fontWeight: '600'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 40, 0.35)',
    justifyContent: 'flex-end'
  },
  optionSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '72%',
    paddingBottom: spacing.md
  },
  optionHeader: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  optionTitle: {
    color: colors.text,
    ...typography.subheading,
  },
  optionCloseButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  optionCloseText: {
    color: colors.primary,
    ...typography.bodyBold,
  },
  optionList: {
    maxHeight: 420
  },
  optionListContent: {
    padding: spacing.md,
    gap: spacing.sm
  },
  optionItem: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  optionItemSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary
  },
  optionText: {
    color: colors.text,
    flex: 1,
    ...typography.bodyBold,
  },
  optionTextSelected: {
    color: colors.primary
  }
});
```

### ChangePasswordScreen.tsx
```tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/components/AppButton';
import { FormTextInput } from '@/components/FormTextInput';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
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
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword
      });

      if (signInError) throw new Error('Current password is incorrect.');

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      Alert.alert('Success', 'Your password has been successfully updated.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update password.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.primary} />
          <Text style={styles.cardTitle}>Change Password</Text>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={colors.destructive} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <FormTextInput
          label="Current password"
          secureTextEntry
          value={currentPassword}
          onChangeText={(value) => {
            setCurrentPassword(value);
            setErrors((curr) => ({ ...curr, currentPassword: undefined }));
            setError('');
          }}
          error={errors.currentPassword}
          required
        />
        <FormTextInput
          label="New password"
          secureTextEntry
          value={newPassword}
          onChangeText={(value) => {
            setNewPassword(value);
            setErrors((curr) => ({ ...curr, newPassword: undefined }));
            setError('');
          }}
          error={errors.newPassword}
          hint="Password must be at least 6 characters long."
          required
        />
        <FormTextInput
          label="Confirm new password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={(value) => {
            setConfirmPassword(value);
            setErrors((curr) => ({ ...curr, confirmPassword: undefined }));
            setError('');
          }}
          error={errors.confirmPassword}
          required
        />
      </View>
      <AppButton title="Update Password" loading={updating} disabled={updating} onPress={onUpdatePassword} />
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
    ...shadows.subtle
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs
  },
  cardTitle: {
    color: colors.text,
    ...typography.subheading,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.destructiveLight,
    borderColor: colors.destructiveBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    flex: 1,
    color: colors.destructive,
    ...typography.captionBold,
  }
});
```

### SettingsScreen.tsx
```tsx
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
import { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Settings'>;

export function SettingsScreen({}: Props) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="notifications-outline" size={20} color={colors.primary} />
          <Text style={styles.cardTitle}>Notifications</Text>
        </View>
        <Text style={styles.message}>
          Push notifications are currently managed via the Expo Go app settings or your device system settings.
        </Text>
      </View>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.cardTitle}>About</Text>
        </View>
        <Text style={styles.message}>
          VenueVerse is a college venue booking platform designed to streamline the approval process for auditoriums, seminar halls, and labs.
        </Text>
        <View style={styles.versionRow}>
           <Text style={styles.versionLabel}>Version</Text>
           <Text style={styles.versionValue}>1.0.0 (Beta)</Text>
        </View>
      </View>
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
    gap: spacing.sm,
    ...shadows.subtle
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs
  },
  cardTitle: {
    color: colors.text,
    ...typography.subheading,
  },
  message: {
    color: colors.textMuted,
    ...typography.body,
    lineHeight: 22
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft
  },
  versionLabel: {
    color: colors.textMuted,
    ...typography.bodyBold,
  },
  versionValue: {
    color: colors.text,
    ...typography.bodyBold,
  }
});
```

---

## 2. Reusable Components

### PrimaryButton.tsx
```tsx
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'destructive';

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  icon,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  const variantStyle =
    variant === 'destructive'
      ? styles.destructive
      : variant === 'secondary'
      ? styles.secondary
      : styles.primary;

  const textStyle =
    variant === 'destructive'
      ? styles.destructiveTitle
      : variant === 'secondary'
      ? styles.secondaryTitle
      : styles.primaryTitle;

  const spinnerColor =
    variant === 'primary'
      ? colors.surface
      : variant === 'destructive'
      ? colors.destructive
      : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variantStyle,
        (pressed || isDisabled) && styles.dimmed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <View style={styles.inner}>
          {icon ? (
            <Ionicons
              name={icon}
              size={18}
              color={textStyle.color}
              style={styles.icon}
            />
          ) : null}
          <Text style={[styles.title, textStyle]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primary: {
    backgroundColor: colors.primary,
    ...shadows.card,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  destructive: {
    backgroundColor: colors.destructiveLight,
    borderWidth: 1,
    borderColor: colors.destructiveBorder,
  },
  dimmed: {
    opacity: 0.55,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: {
    marginRight: 2,
  },
  title: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
  },
  primaryTitle: {
    color: colors.surface,
  },
  secondaryTitle: {
    color: colors.primary,
  },
  destructiveTitle: {
    color: colors.destructive,
  },
});
```

### AppButton.tsx (Alias)
```tsx
export { PrimaryButton as AppButton } from '@/components/PrimaryButton';
```

### FormTextInput.tsx
```tsx
import { Text, TextInput, TextInputProps, StyleSheet, View } from 'react-native';
import { colors, fontSizes, radius, spacing, typography } from '@/constants/theme';

type FormTextInputProps = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
};

export function FormTextInput({ label, error, hint, required, style, ...props }: FormTextInputProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...props}
      />
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    color: colors.text,
    ...typography.bodyBold,
  },
  required: {
    color: colors.destructive,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  inputError: {
    borderColor: colors.destructive,
    backgroundColor: colors.destructiveLight,
  },
  hint: {
    color: colors.textMuted,
    ...typography.caption,
  },
  error: {
    color: colors.destructive,
    ...typography.captionBold,
  },
});
```

---

## 3. Services and Context

These files contain the state management and database calls used by the screens.

### auth.ts (Types)
```ts
import { Session, User } from '@supabase/supabase-js';

export type UserRole = 'user' | 'admin' | 'super_admin';

export type Profile = {
  id: string;
  fullName: string;
  email: string;
  department: string | null;
  role: UserRole;
};

export type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
};
```

### profileService.ts (API Calls - Excerpt)
*Note: This file contains more functions for other flows, but these are the specific ones needed for the Profile screens.*
```ts
import { supabase } from '@/lib/supabase';
import { Profile, UserRole } from '@/types/auth';

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  role: Profile['role'];
};

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    department: row.department,
    role: row.role
  };
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, department, role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapProfile(data as ProfileRow) : null;
}

export async function updateOwnProfile(userId: string, input: {
  fullName: string;
  department: string;
}): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: input.fullName.trim(),
      department: input.department.trim() || null
    })
    .eq('id', userId)
    .select('id, full_name, email, department, role')
    .single();

  if (error) throw error;
  return mapProfile(data as ProfileRow);
}
```

### AuthContext.tsx (Excerpt)
*This manages the current logged in user and allows screens to access `profile` and the `logout` function.*
```tsx
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { fetchProfile } from '@/services/profileService';
import { AuthState, Profile } from '@/types/auth';

type AuthContextValue = AuthState & {
  logout: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ... Provider implementation omitted for brevity, see original source ...

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

---

## 4. Constants

These are required for styling and dropdown data.

### departments.ts
```ts
export const DEPARTMENT_OPTIONS = [
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
  'Library',
  'Others'
];
```

### theme.ts
```ts
export const colors = {
  primary: '#0A3A66',
  primaryDark: '#072B4C',
  primaryLight: '#EAF2FA',
  background: '#F6F8FB',
  surface: '#FFFFFF',
  surfaceMuted: '#F9FAFC',
  text: '#17212B',
  textMuted: '#667085',
  border: '#D8E0EA',
  borderSoft: '#E8EDF3',
  destructive: '#DC2626',
  destructiveLight: '#FEF2F2',
  destructiveBorder: '#FECACA',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 6, md: 8, lg: 12, xl: 16, pill: 999 } as const;

export const fontSizes = { xs: 12, sm: 14, md: 16, lg: 20, xl: 24 } as const;

export const typography = {
  heading: { fontSize: fontSizes.xl, fontWeight: '900' as const, lineHeight: 30 },
  subheading: { fontSize: fontSizes.lg, fontWeight: '800' as const, lineHeight: 26 },
  body: { fontSize: fontSizes.sm, fontWeight: '600' as const, lineHeight: 20 },
  bodyBold: { fontSize: fontSizes.sm, fontWeight: '800' as const, lineHeight: 20 },
  caption: { fontSize: fontSizes.xs, fontWeight: '700' as const, lineHeight: 16 },
  captionBold: { fontSize: fontSizes.xs, fontWeight: '900' as const, lineHeight: 16 },
} as const;

export const shadows = {
  card: { shadowColor: '#101828', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  subtle: { shadowColor: '#101828', shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
} as const;
```

## How to use this in a clone
1. Copy the components, screens, and constants into your clone's respective directories.
2. Ensure you have `@expo/vector-icons` installed.
3. Make sure your navigation stack uses these screens.
4. If you aren't using Supabase, replace the `useAuth` hook logic and `profileService.ts` API calls with your own backend implementation.
