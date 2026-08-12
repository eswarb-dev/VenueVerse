import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { HallForm } from '@/components/HallForm';
import { LoadingView } from '@/components/LoadingView';
import { VenueInactiveReasonDialog } from '@/components/VenueInactiveReasonDialog';
import { colors, spacing } from '@/constants/theme';
import { AdminStackParamList, AppStackParamList } from '@/navigation/types';
import { deleteHall, deleteHallForDepartment, getHallById, updateHall, updateHallForDepartment } from '@/services/hallService';
import { useAuth } from '@/store/AuthContext';
import { Hall, HallFormInput } from '@/types/venue';

type Props = NativeStackScreenProps<AdminStackParamList & AppStackParamList, 'EditHall'>;

export function EditHallScreen({ route, navigation }: Props) {
  const { profile, user } = useAuth();
  const [hall, setHall] = useState<Hall | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [pendingInactiveInput, setPendingInactiveInput] = useState<HallFormInput | null>(null);
  const isAdmin = profile?.role === 'admin';
  const isSuperAdmin = profile?.role === 'super_admin';
  const userDepartment = profile?.department ?? '';

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

  const saveVenueChanges = async (input: HallFormInput, inactiveReason?: string) => {
    try {
      setSubmitting(true);
      const isDeactivating = hall?.isActive === true && input.isActive === false;
      const isReactivating = hall?.isActive === false && input.isActive === true;
      const audit = isDeactivating
        ? { inactiveReason, deactivatedBy: user?.id }
        : isReactivating
          ? { reactivatedBy: user?.id }
          : undefined;

      if (isDeactivating && (!inactiveReason?.trim() || !user?.id)) {
        throw new Error('Please enter a reason before making this venue inactive.');
      }

      if (isSuperAdmin) {
        await updateHall(route.params.hallId, input, audit);
      } else {
        if (input.department !== userDepartment) {
          throw new Error('Department admins can manage venues only in their own department.');
        }
        await updateHallForDepartment(route.params.hallId, { ...input, department: userDepartment }, userDepartment, audit);
      }
      setPendingInactiveInput(null);
      Alert.alert('Venue updated', 'The venue details have been saved.');
      navigation.goBack();
    } catch (saveError) {
      Alert.alert(inactiveReason ? 'Update failed' : 'Unable to update venue', saveError instanceof Error ? saveError.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (input: HallFormInput) => {
    if (hall?.isActive === true && input.isActive === false) {
      setPendingInactiveInput(input);
      return;
    }

    await saveVenueChanges(input);
  };

  const onCancelInactiveReason = () => {
    setPendingInactiveInput(null);
  };

  const onConfirmInactiveReason = (reason: string) => {
    if (!pendingInactiveInput) return;
    void saveVenueChanges(pendingInactiveInput, reason);
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
            if (isSuperAdmin) {
              await deleteHall(route.params.hallId);
            } else {
              await deleteHallForDepartment(route.params.hallId, userDepartment);
            }
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

  if (!isSuperAdmin && (!isAdmin || !userDepartment)) {
    return <View style={styles.screen}><EmptyState title="Access restricted" message="Only admins with an assigned department can manage venues." /></View>;
  }

  if (loading) return <LoadingView message="Loading hall details..." />;
  if (error) return <View style={styles.screen}><ErrorView message={error} onRetry={() => void loadHall()} /></View>;
  if (!hall) return <View style={styles.screen}><EmptyState title="Venue not found" message="This venue may no longer exist." /></View>;
  if (!isSuperAdmin && hall.department !== userDepartment) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Access denied." message="You can manage only venues assigned to your department." />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <HallForm
        initialHall={hall}
        submitLabel="Save Changes"
        submitting={submitting}
        lockedDepartment={isSuperAdmin ? undefined : userDepartment}
        hideDepartment={!isSuperAdmin}
        showAdminFields
        onSubmit={onSubmit}
      />
      <VenueInactiveReasonDialog
        visible={Boolean(pendingInactiveInput)}
        venueName={hall.name}
        loading={submitting}
        onCancel={onCancelInactiveReason}
        onSubmit={onConfirmInactiveReason}
      />
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
