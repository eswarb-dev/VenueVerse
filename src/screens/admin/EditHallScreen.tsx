import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { HallForm } from '@/components/HallForm';
import { LoadingView } from '@/components/LoadingView';
import { colors, spacing } from '@/constants/theme';
import { AdminStackParamList } from '@/navigation/types';
import { getHallById, updateHall } from '@/services/hallService';
import { deleteHall } from '@/services/hallService';
import { useAuth } from '@/store/AuthContext';
import { Hall, HallFormInput } from '@/types/venue';

type Props = NativeStackScreenProps<AdminStackParamList, 'EditHall'>;

export function EditHallScreen({ route, navigation }: Props) {
  const { profile } = useAuth();
  const [hall, setHall] = useState<Hall | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadHall = useCallback(async () => {
    setError('');
    setHall(await getHallById(route.params.hallId));
  }, [route.params.hallId]);

  useEffect(() => {
    setLoading(true);
    loadHall()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load hall.'))
      .finally(() => setLoading(false));
  }, [loadHall]);

  const onSubmit = async (input: HallFormInput) => {
    try {
      setSubmitting(true);
      await updateHall(route.params.hallId, input);
      Alert.alert('Venue updated', 'The venue details have been saved.');
      navigation.goBack();
    } catch (saveError) {
      Alert.alert('Unable to update venue', saveError instanceof Error ? saveError.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = () => {
    Alert.alert('Delete venue?', 'This permanently removes the venue if database policies allow it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setSubmitting(true);
            await deleteHall(route.params.hallId);
            Alert.alert('Venue deleted', 'The venue has been removed.');
            navigation.goBack();
          } catch (deleteError) {
            Alert.alert('Unable to delete venue', deleteError instanceof Error ? deleteError.message : 'Please try again.');
          } finally {
            setSubmitting(false);
          }
        }
      }
    ]);
  };

  if (profile?.role !== 'super_admin') {
    return <View style={styles.screen}><EmptyState title="Access denied." message="Only super_admin users can edit venues." /></View>;
  }

  if (loading) return <LoadingView message="Loading hall details..." />;
  if (error) return <View style={styles.screen}><ErrorView message={error} onRetry={() => void loadHall()} /></View>;
  if (!hall) return <View style={styles.screen}><EmptyState title="Venue not found" message="This venue may no longer exist." /></View>;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <HallForm initialHall={hall} submitLabel="Save Changes" submitting={submitting} onSubmit={onSubmit} />
      <View style={styles.deleteWrap}>
        <HallFormDeleteButton disabled={submitting} onPress={onDelete} />
      </View>
    </ScrollView>
  );
}

function HallFormDeleteButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return <HallFormAction title="Delete Venue" disabled={disabled} onPress={onPress} />;
}

function HallFormAction({ title, disabled, onPress }: { title: string; disabled: boolean; onPress: () => void }) {
  return (
    <View>
      <EmptyState title={title} message="Use this only for duplicate or incorrect venue records." />
      <View style={{ marginTop: spacing.md }}>
        <AppButton title={title} variant="secondary" disabled={disabled} onPress={onPress} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background
  },
  screen: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.background
  },
  content: {
    padding: spacing.md,
    gap: spacing.md
  },
  deleteWrap: {
    marginTop: spacing.md
  }
});
