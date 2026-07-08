import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { AppTextInput } from '@/components/AppTextInput';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';
import { AppStackParamList } from '@/navigation/types';
import { updateOwnProfile } from '@/services/profileService';
import { useAuth } from '@/store/AuthContext';

type Props = NativeStackScreenProps<AppStackParamList, 'EditProfile'>;

export function EditProfileScreen({ navigation }: Props) {
  const { profile, user, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.fullName ?? '');
  const [department, setDepartment] = useState(profile?.department ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    const userId = profile?.id ?? user?.id;
    if (!userId) return;
    if (!fullName.trim()) {
      setError('Full name is required.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await updateOwnProfile(userId, { fullName, department });
      await refreshProfile();
      Alert.alert('Profile updated', 'Your profile details have been saved.');
      navigation.goBack();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.lockedPanel}>
        <Text style={styles.lockedTitle}>Locked account fields</Text>
        <Text style={styles.lockedText}>Email: {profile?.email ?? 'Not available'}</Text>
        <Text style={styles.lockedText}>Role: {profile?.role ?? 'user'}</Text>
      </View>
      <AppTextInput label="Full name" value={fullName} onChangeText={setFullName} />
      <AppTextInput label="Department" value={department} onChangeText={setDepartment} />
      <AppButton title="Save Profile" loading={saving} disabled={saving} onPress={onSave} />
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs
  },
  lockedTitle: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '900'
  },
  lockedText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700'
  }
});
