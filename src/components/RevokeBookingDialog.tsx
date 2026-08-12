import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { AppTextInput } from '@/components/AppTextInput';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

export function RevokeBookingDialog({ visible, submitting, onCancel, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError('Please enter a reason before revoking this booking.');
      return;
    }
    if (trimmedReason.length < 5) {
      setError('Please enter a valid revoke reason.');
      return;
    }
    onConfirm(trimmedReason);
  };

  const close = () => {
    if (submitting) return;
    setReason('');
    setError('');
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={styles.card}>
          <Text style={styles.title}>Revoke approved booking?</Text>
          <Text style={styles.message}>
            This approved booking will be revoked and the venue slot will become available again. Please enter a valid reason.
          </Text>
          <AppTextInput
            label="Reason"
            value={reason}
            onChangeText={(value) => {
              setReason(value);
              setError('');
            }}
            multiline
            style={styles.input}
            placeholder="Example: Venue maintenance, emergency department event, hall unavailable"
            error={error}
          />
          <View style={styles.actions}>
            <View style={styles.action}>
              <AppButton title="Cancel" variant="secondary" disabled={submitting} onPress={close} />
            </View>
            <View style={styles.action}>
              <AppButton title="Confirm Revoke" loading={submitting} disabled={submitting} onPress={submit} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md
  },
  title: {
    color: colors.text,
    fontSize: fontSizes.xl,
    fontWeight: '900'
  },
  message: {
    color: colors.textMuted,
    fontSize: fontSizes.md,
    fontWeight: '700',
    lineHeight: 22
  },
  input: {
    minHeight: 116,
    paddingTop: spacing.md,
    textAlignVertical: 'top'
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md
  },
  action: {
    flex: 1
  }
});
