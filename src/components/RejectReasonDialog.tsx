import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { AppTextInput } from '@/components/AppTextInput';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  title?: string;
  eventTitle?: string | null;
  venueName?: string | null;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
};

const minReasonLength = 3;
const maxReasonLength = 300;

export function RejectReasonDialog({ visible, title = 'Reject Booking Request', eventTitle, venueName, loading, onCancel, onSubmit }: Props) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const trimmedReason = reason.trim();
  const isValid = trimmedReason.length >= minReasonLength;
  const error = touched && !isValid ? 'Please enter a rejection reason.' : undefined;

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
            <Text style={styles.title}>{title}</Text>
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>{eventTitle ?? 'Venue booking'}</Text>
              <Text style={styles.summaryMeta}>{venueName ?? 'Venue request'}</Text>
            </View>
            <AppTextInput
              label="Rejection reason"
              placeholder="Enter reason"
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
                <AppButton title="Reject Request" variant="destructive" loading={loading} disabled={!isValid || loading} onPress={submit} />
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
