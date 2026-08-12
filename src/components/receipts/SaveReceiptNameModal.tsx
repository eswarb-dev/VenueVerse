import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';

type Props = {
  visible: boolean;
  defaultFileName: string;
  saving?: boolean;
  onCancel: () => void;
  onSave: (fileName: string) => void;
};

export function SaveReceiptNameModal({ visible, defaultFileName, saving, onCancel, onSave }: Props) {
  const [fileName, setFileName] = useState(defaultFileName);

  useEffect(() => {
    if (visible) setFileName(defaultFileName);
  }, [defaultFileName, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Save receipt as</Text>
          <TextInput
            value={fileName}
            onChangeText={setFileName}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            placeholder="Receipt file name"
            placeholderTextColor={colors.textMuted}
          />
          <View style={styles.actions}>
            <AppButton title="Cancel" variant="secondary" disabled={saving} onPress={onCancel} />
            <AppButton title="Save" loading={saving} disabled={saving} onPress={() => onSave(fileName)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.overlayStrong,
    padding: spacing.lg
  },
  card: {
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: fontSizes.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontWeight: '700'
  },
  actions: {
    gap: spacing.sm
  }
});
