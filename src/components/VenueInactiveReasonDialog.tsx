import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { AppTextInput } from '@/components/AppTextInput';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  venueName?: string | null;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
};

const minReasonLength = 5;
const maxReasonLength = 300;

export function VenueInactiveReasonDialog({ visible, venueName, loading, onCancel, onSubmit }: Props) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const trimmedReason = reason.trim();
  const isValid = trimmedReason.length >= minReasonLength;
  const error = touched && !isValid ? 'Please enter a reason before making this venue inactive.' : undefined;

  useEffect(() => {
    if (!visible) {
      setReason('');
      setTouched(false);
    }
  }, [visible]);

  const submit = () => {
    setTouched(true);
    if (!isValid || loading) return;
    onSubmit(trimmedReason);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={styles.backdropPressable} onPress={onCancel}>
          <Pressable style={styles.dialog}>
            <Text style={styles.title}>Make venue inactive?</Text>
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>{venueName ?? 'Venue'}</Text>
              <Text style={styles.summaryMeta}>This venue will be hidden from new booking requests. Please enter the reason.</Text>
            </View>
            <AppTextInput
              label="Reason"
              placeholder="Example: Maintenance work, renovation, projector issue"
              value={reason}
              onChangeText={(value) => {
                setReason(value.slice(0, maxReasonLength));
                setTouched(true);
              }}
              error={error}
              multiline
              style={styles.input}
              maxLength={maxReasonLength}
              textAlignVertical="top"
            />
            <View style={styles.actions}>
              <View style={styles.action}>
                <AppButton title="Cancel" variant="secondary" disabled={loading} onPress={onCancel} />
              </View>
              <View style={styles.action}>
                <AppButton title="Confirm Inactive" variant="destructive" loading={loading} disabled={!isValid || loading} onPress={submit} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.md
  },
  backdropPressable: {
    flex: 1,
    justifyContent: 'center'
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card
  },
  title: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '900'
  },
  summary: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
    gap: spacing.xs
  },
  summaryTitle: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '900'
  },
  summaryMeta: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700'
  },
  input: {
    minHeight: 110,
    paddingTop: spacing.md
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  action: {
    flex: 1
  }
});
