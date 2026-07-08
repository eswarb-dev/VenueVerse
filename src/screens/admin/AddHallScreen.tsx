import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { HallForm } from '@/components/HallForm';
import { EmptyState } from '@/components/EmptyState';
import { colors, spacing } from '@/constants/theme';
import { AdminStackParamList } from '@/navigation/types';
import { createHall } from '@/services/hallService';
import { useAuth } from '@/store/AuthContext';
import { HallFormInput } from '@/types/venue';

type Props = NativeStackScreenProps<AdminStackParamList, 'AddHall'>;

export function AddHallScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  if (profile?.role !== 'super_admin') {
    return <EmptyState title="Access denied." message="Only super_admin users can add venues." />;
  }

  const onSubmit = async (input: HallFormInput) => {
    try {
      setSubmitting(true);
      await createHall(input);
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
      <HallForm submitLabel="Create Venue" submitting={submitting} onSubmit={onSubmit} />
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
