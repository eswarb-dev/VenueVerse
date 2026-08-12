import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import { AppButton } from '@/components/AppButton';
import { ReceiptPdfPreview } from '@/components/receipts/ReceiptPdfPreview';
import { SaveReceiptNameModal } from '@/components/receipts/SaveReceiptNameModal';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';
import {
  BookingReceipt,
  copyReceiptCacheFile,
  deleteCachedReceiptFile,
  fetchReceiptPdfToCache,
  getDefaultReceiptFileName,
  getCachedReceiptFile
} from '@/services/receiptService';

type Props = {
  visible: boolean;
  receipt: BookingReceipt | null;
  onClose: () => void;
};

type CachedReceipt = {
  localUri: string;
  fileName: string;
};

export function ReceiptViewerModal({ visible, receipt, onClose }: Props) {
  const [cachedReceipt, setCachedReceipt] = useState<CachedReceipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [saveNameVisible, setSaveNameVisible] = useState(false);
  const [error, setError] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [isPdfInteracting, setIsPdfInteracting] = useState(false);

  const prepareReceipt = useCallback(async (forceReload = false) => {
    if (!receipt) return;

    try {
      setLoading(true);
      setError('');
      setPreviewError('');

      const cached = forceReload ? null : await getCachedReceiptFile(receipt.receiptNo);
      if (cached) {
        setCachedReceipt(cached);
        return;
      }

      const downloaded = await fetchReceiptPdfToCache(receipt);
      setCachedReceipt(downloaded);
    } catch (prepareError) {
      setError(prepareError instanceof Error ? prepareError.message : 'Unable to download receipt. Check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [receipt]);

  useEffect(() => {
    if (!visible) return;
    setCachedReceipt(null);
    setError('');
    setPreviewError('');
    setIsPdfInteracting(false);
    void prepareReceipt();
  }, [prepareReceipt, receipt?.id, visible]);

  useEffect(() => {
    if (!visible) setIsPdfInteracting(false);
  }, [visible]);

  const reloadReceipt = async () => {
    if (cachedReceipt?.localUri) {
      await deleteCachedReceiptFile(cachedReceipt.localUri);
    }
    setCachedReceipt(null);
    await prepareReceipt(true);
  };

  const shareReceipt = async (customFileName?: string) => {
    if (!receipt || !cachedReceipt) return;

    try {
      setSharing(true);
      const file = customFileName
        ? await copyReceiptCacheFile({
            sourceUri: cachedReceipt.localUri,
            receiptNo: receipt.receiptNo,
            customFileName
          })
        : cachedReceipt;

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Sharing unavailable', 'Receipt is cached, but sharing is not available on this device.');
        return;
      }

      await Sharing.shareAsync(file.localUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Save Receipt',
        UTI: 'com.adobe.pdf'
      });
      setSaveNameVisible(false);
    } catch (shareError) {
      Alert.alert('Unable to share receipt', shareError instanceof Error ? shareError.message : 'Please try again.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isPdfInteracting}
            nestedScrollEnabled
          >
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Booking Receipt</Text>
                <Text style={styles.subtitle}>Official venue booking proof document</Text>
              </View>
            </View>

            {!receipt ? (
              <Text style={styles.message}>Receipt is not generated yet.</Text>
            ) : (
              <>
                <View style={styles.infoPanel}>
                  <InfoRow label="Receipt No" value={receipt.receiptNo} />
                  <InfoRow label="Status" value={receipt.status.toUpperCase()} />
                  <InfoRow label="Generated On" value={format(new Date(receipt.generatedAt), 'dd MMM yyyy, h:mm a')} />
                </View>

                <View style={styles.previewCard}>
                  <View style={styles.previewHeader}>
                    <Text style={styles.previewTitle}>PDF Preview</Text>
                    {cachedReceipt ? <Text style={styles.cacheLabel}>Cached</Text> : null}
                  </View>
                  <ReceiptPdfPreview
                    localUri={cachedReceipt?.localUri ?? null}
                    loading={loading || (!cachedReceipt && !error)}
                    error={previewError || error}
                    onInteractionStart={() => setIsPdfInteracting(true)}
                    onInteractionEnd={() => setIsPdfInteracting(false)}
                  />
                </View>

                {(error || previewError) && !loading ? (
                  <AppButton title="Reload Receipt" variant="secondary" onPress={() => void reloadReceipt()} />
                ) : null}
              </>
            )}

          </ScrollView>

          <View style={styles.actions}>
            <AppButton title="Download" loading={sharing} disabled={!cachedReceipt || loading || sharing} onPress={() => setSaveNameVisible(true)} />
            <AppButton title="Share" variant="secondary" loading={sharing} disabled={!cachedReceipt || loading || sharing} onPress={() => void shareReceipt()} />
            <AppButton title="Close" variant="secondary" disabled={sharing} onPress={onClose} />
          </View>
        </View>
      </View>

      {receipt ? (
        <SaveReceiptNameModal
          visible={saveNameVisible}
          defaultFileName={getDefaultReceiptFileName(receipt.receiptNo)}
          saving={sharing}
          onCancel={() => setSaveNameVisible(false)}
          onSave={(fileName) => void shareReceipt(fileName)}
        />
      ) : null}
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlayStrong
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card
  },
  scrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.sm
  },
  actions: {
    gap: spacing.sm
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  title: {
    color: colors.text,
    fontSize: fontSizes.xl,
    fontWeight: '900'
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    marginTop: spacing.xs
  },
  infoPanel: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.background
  },
  infoRow: {
    gap: spacing.xs
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  infoValue: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '800'
  },
  previewCard: {
    height: 460,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    overflow: 'hidden'
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.surface
  },
  previewTitle: {
    color: colors.primary,
    fontSize: fontSizes.md,
    fontWeight: '900'
  },
  cacheLabel: {
    color: colors.success,
    fontSize: fontSizes.xs,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  message: {
    color: colors.textMuted,
    fontSize: fontSizes.md,
    fontWeight: '700',
    lineHeight: 22
  },
});
