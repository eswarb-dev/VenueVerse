import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { AppTextInput } from '@/components/AppTextInput';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { formatVenueDescription } from '@/components/HallCard';
import { LoadingView } from '@/components/LoadingView';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';
import { normalizeVenueType } from '@/constants/venueTypes';
import { AppStackParamList } from '@/navigation/types';
import { createBookingRequest } from '@/services/bookingService';
import { getHallById } from '@/services/hallService';
import { useAuth } from '@/store/AuthContext';
import { Hall } from '@/types/venue';

type Props = NativeStackScreenProps<AppStackParamList, 'BookHall'>;

type FormState = {
  eventTitle: string;
  eventType: string;
  department: string;
  facultyCoordinator: string;
};

type FormErrors = Partial<Record<keyof FormState | 'form', string>>;

const initialForm: FormState = {
  eventTitle: '',
  eventType: '',
  department: '',
  facultyCoordinator: ''
};

const PASSED_SLOT_ERROR = 'Selected time slot has already passed';

export function BookHallScreen({ route, navigation }: Props) {
  const { profile, user } = useAuth();
  const [hall, setHall] = useState<Hall | null>(null);
  const [form, setForm] = useState<FormState>(() => ({
    ...initialForm,
    department: profile?.department ?? ''
  }));
  const [errors, setErrors] = useState<FormErrors>({});
  const [loadingHall, setLoadingHall] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const hasShownPassedSlotPopupRef = useRef(false);
  const passedSlotErrorActive = errors.form === PASSED_SLOT_ERROR;

  const loadHall = useCallback(async () => {
    setLoadError('');
    const nextHall = await getHallById(route.params.hallId);
    setHall(nextHall);
  }, [route.params.hallId]);

  useEffect(() => {
    setLoadingHall(true);
    loadHall()
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'Unable to load selected hall.'))
      .finally(() => setLoadingHall(false));
  }, [loadHall]);

  const update = (key: keyof FormState) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
  };

  const validate = () => {
    if (!hall) return { form: 'Selected hall is not available.' };

    const nextErrors: FormErrors = {};
    const startAt = new Date(route.params.startTime);
    const endAt = new Date(route.params.endTime);

    if (!form.eventTitle.trim()) nextErrors.eventTitle = 'Event title is required.';
    if (!route.params.bookingDate) nextErrors.form = 'Please select a booking date';
    if (!route.params.slotLabel) nextErrors.form = 'Please select a time slot';
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
      nextErrors.form = 'Please select a valid time slot';
    } else if (startAt <= new Date()) {
      nextErrors.form = PASSED_SLOT_ERROR;
    }

    return nextErrors;
  };

  const showPassedSlotPopup = useCallback(() => {
    if (hasShownPassedSlotPopupRef.current) return;

    hasShownPassedSlotPopupRef.current = true;
    Alert.alert(
      'Time Slot Passed',
      'This selected time slot has already passed. Please choose another available slot.',
      [
        {
          text: 'Choose Another Slot',
          onPress: () => {
            if (navigation.canGoBack()) navigation.goBack();
          }
        }
      ],
      { cancelable: false }
    );
  }, [navigation]);

  useEffect(() => {
    const validation = validate();
    if (validation.form === PASSED_SLOT_ERROR) {
      setErrors((current) => ({ ...current, form: PASSED_SLOT_ERROR }));
      showPassedSlotPopup();
    }
  }, [route.params.startTime, route.params.endTime, showPassedSlotPopup]);

  const onSubmit = async () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (nextErrors.form === PASSED_SLOT_ERROR) showPassedSlotPopup();
    if (Object.keys(nextErrors).length > 0 || !hall) return;

    const currentUserId = profile?.id ?? user?.id;
    if (!currentUserId) {
      setErrors({ form: 'Your session is not ready. Please sign in again.' });
      return;
    }

    try {
      setSubmitting(true);
      await createBookingRequest({
        hallId: hall.id,
        userId: currentUserId,
        eventTitle: form.eventTitle,
        eventType: form.eventType,
        department: form.department,
        facultyCoordinator: form.facultyCoordinator,
        startTime: route.params.startTime,
        endTime: route.params.endTime
      });

      Alert.alert('Success', 'Booking request submitted successfully. Please wait for admin approval.');
      navigation.navigate('Bookings');
    } catch (error) {
      setErrors({
        form: error instanceof Error ? error.message : 'Unable to submit booking request. Please try again.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingHall) return <LoadingView message="Preparing booking form..." />;
  if (loadError) return <View style={styles.screen}><ErrorView message={loadError} onRetry={() => void loadHall()} /></View>;
  if (!hall) return <View style={styles.screen}><EmptyState title="Hall unavailable" message="Please select another active venue." /></View>;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {errors.form && !passedSlotErrorActive ? <Text style={styles.formError}>{errors.form}</Text> : null}

      <AppTextInput label="Event title" value={form.eventTitle} onChangeText={update('eventTitle')} error={errors.eventTitle} />
      <AppTextInput label="Event type" value={form.eventType} onChangeText={update('eventType')} placeholder="Seminar, workshop, meeting" />
      <AppTextInput label="Department" value={form.department} onChangeText={update('department')} />
      <AppTextInput label="Faculty coordinator" value={form.facultyCoordinator} onChangeText={update('facultyCoordinator')} />

      <View style={styles.summaryPanel}>
        <Text style={styles.summaryTitle}>Booking summary</Text>
        <SummaryRow label="Venue" value={hall.name} />
        <SummaryRow label="Date" value={format(new Date(route.params.startTime), 'EEEE, dd MMMM yyyy')} />
        <SummaryRow label="Time" value={route.params.slotLabel} />
        <SummaryRow label="Department" value={(hall.department ?? form.department) || 'Not provided'} />
        <SummaryRow label="Venue type" value={normalizeVenueType(hall.venueType) || 'Venue'} />
        <SummaryRow label="Location" value={formatVenueDescription(hall)} />
      </View>

      <AppButton title="Submit Booking Request" loading={submitting} disabled={submitting || passedSlotErrorActive} onPress={onSubmit} />
    </ScrollView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
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
  formError: {
    backgroundColor: colors.errorSurface,
    borderColor: colors.errorBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.status.rejected,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    padding: spacing.md
  },
  summaryPanel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md
  },
  summaryTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '900'
  },
  summaryRow: {
    gap: spacing.xs
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  summaryValue: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '800',
    lineHeight: 20
  },
});
