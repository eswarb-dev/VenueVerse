import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { HallForm } from '@/components/HallForm';
import { EmptyState } from '@/components/EmptyState';
import { colors, spacing } from '@/constants/theme';
import { AdminStackParamList, AppStackParamList } from '@/navigation/types';
import { createHall, createHallForDepartment } from '@/services/hallService';
import { useAuth } from '@/store/AuthContext';
import { HallFormInput } from '@/types/venue';

type Props = NativeStackScreenProps<AdminStackParamList & AppStackParamList, 'AddHall'>;

export function AddHallScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const isAdmin = profile?.role === 'admin';
  const isSuperAdmin = profile?.role === 'super_admin';
  const userDepartment = profile?.department ?? '';

  if (!isSuperAdmin && (!isAdmin || !userDepartment)) {
    return <EmptyState title="Access restricted" message="Only admins with an assigned department can add venues." />;
  }

  const onSubmit = async (input: HallFormInput) => {
    try {
      setSubmitting(true);
      if (isSuperAdmin) {
        await createHall(input);
      } else {
        if (input.department !== userDepartment) {
          throw new Error('Department admins can add venues only for their own department.');
        }
        await createHallForDepartment(input, userDepartment);
      }
      Alert.alert('Venue added', 'The venue has been created successfully.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Unable to add venue', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <HallForm
        submitLabel="Create Venue"
        submitting={submitting}
        lockedDepartment={isSuperAdmin ? undefined : userDepartment}
        hideDepartment={!isSuperAdmin}
        showAdminFields
        onSubmit={onSubmit}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: spacing.md
  }
});
