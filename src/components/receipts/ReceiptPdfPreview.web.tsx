import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, spacing } from '@/constants/theme';

type Props = {
  localUri: string | null;
  loading: boolean;
  error?: string | null;
};

export function ReceiptPdfPreview({ localUri, loading, error }: Props) {
  if (loading) {
    return <PreviewFallback title="Loading receipt preview..." message="Preparing the cached PDF for preview." />;
  }

  if (error) {
    return <PreviewFallback title="Preview unavailable" message="You can still download or share the PDF." />;
  }

  if (!localUri) {
    return <PreviewFallback title="Receipt not ready" message="Download the receipt first, then preview will appear here." />;
  }

  return <PreviewFallback title="Receipt cached" message="Inline PDF preview is available in the Android app build." />;
}

function PreviewFallback({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackTitle}>{title}</Text>
      <Text style={styles.fallbackMessage}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.primaryLight
  },
  fallbackTitle: {
    color: colors.primary,
    fontSize: fontSizes.lg,
    fontWeight: '900',
    textAlign: 'center'
  },
  fallbackMessage: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center'
  }
});
