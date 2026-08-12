import { useEffect, useState } from 'react';
import { ActivityIndicator, NativeModules, StyleSheet, Text, UIManager, View } from 'react-native';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';

type Props = {
  localUri: string | null;
  loading: boolean;
  error?: string | null;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
};

type PdfComponentType = React.ComponentType<{
  source: { uri: string };
  style: object;
  trustAllCerts?: boolean;
  fitPolicy?: number;
  minScale?: number;
  maxScale?: number;
  scale?: number;
  spacing?: number;
  scrollEnabled?: boolean;
  enableDoubleTapZoom?: boolean;
  showsHorizontalScrollIndicator?: boolean;
  showsVerticalScrollIndicator?: boolean;
  onLoadComplete?: (numberOfPages: number) => void;
  onScaleChanged?: (scale: number) => void;
  onError?: (error: unknown) => void;
}>;

let cachedPdfComponent: PdfComponentType | null | undefined;

function getPdfComponent() {
  if (cachedPdfComponent !== undefined) return cachedPdfComponent;

  const hasBlobUtilModule = Boolean(
    NativeModules.BlobUtils ||
    NativeModules.ReactNativeBlobUtil ||
    NativeModules.RNFetchBlob
  );
  const hasPdfViewManager = Boolean(
    UIManager.getViewManagerConfig?.('RNPDFPdfView') ||
    (UIManager as unknown as Record<string, unknown>).RNPDFPdfView
  );

  if (!hasBlobUtilModule || !hasPdfViewManager) {
    cachedPdfComponent = null;
    if (__DEV__) {
      console.warn('[receipt-pdf] native PDF module unavailable in this app build');
    }
    return cachedPdfComponent;
  }

  try {
    // react-native-pdf depends on native modules that are unavailable in Expo Go
    // or stale APKs. Load it lazily so unsupported runtimes show the fallback.
    const pdfModule = require('react-native-pdf') as { default?: PdfComponentType };
    cachedPdfComponent = pdfModule.default ?? (pdfModule as unknown as PdfComponentType);
  } catch (error) {
    cachedPdfComponent = null;
    if (__DEV__) console.warn('[receipt-pdf] native PDF module unavailable', error);
  }

  return cachedPdfComponent;
}

export function ReceiptPdfPreview({ localUri, loading, error, onInteractionStart, onInteractionEnd }: Props) {
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const Pdf = getPdfComponent();

  useEffect(() => {
    setPreviewFailed(false);
    setPreviewLoading(Boolean(localUri));
  }, [localUri]);

  if (loading) {
    return <PreviewFallback title="Loading receipt preview..." message="Preparing the cached PDF for preview." />;
  }

  if (error) {
    return <PreviewFallback title="Preview unavailable" message="You can still download or share the PDF." />;
  }

  if (!localUri) {
    return <PreviewFallback title="Receipt not ready" message="Download the receipt first, then preview will appear here." />;
  }

  if (!Pdf || previewFailed) {
    return <PreviewFallback title="Receipt cached" message="Inline PDF preview is unavailable in this app build. You can still download or share the PDF." />;
  }

  return (
    <View
      style={styles.viewerWrap}
      onTouchStart={onInteractionStart}
      onTouchMove={onInteractionStart}
      onTouchEnd={onInteractionEnd}
      onTouchCancel={onInteractionEnd}
    >
      {previewLoading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading PDF preview...</Text>
        </View>
      ) : null}
      <Pdf
        key={localUri}
        source={{ uri: localUri }}
        style={styles.pdfViewer}
        trustAllCerts={false}
        fitPolicy={0}
        minScale={1}
        maxScale={3}
        scale={1}
        spacing={0}
        scrollEnabled
        enableDoubleTapZoom
        showsHorizontalScrollIndicator
        showsVerticalScrollIndicator
        onLoadComplete={(numberOfPages) => {
          setPreviewLoading(false);
          console.log('[receipt-pdf] loaded pages', numberOfPages);
        }}
        onScaleChanged={(scale) => {
          if (scale > 1.01) onInteractionStart?.();
        }}
        onError={(previewError) => {
          setPreviewLoading(false);
          setPreviewFailed(true);
          console.warn('[receipt-pdf] preview failed', previewError);
        }}
      />
    </View>
  );
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
  viewerWrap: {
    flex: 1,
    minHeight: 260,
    backgroundColor: colors.background
  },
  pdfViewer: {
    flex: 1,
    width: '100%',
    minHeight: 260,
    backgroundColor: colors.background
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight
  },
  loadingText: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '800',
    textAlign: 'center'
  },
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
