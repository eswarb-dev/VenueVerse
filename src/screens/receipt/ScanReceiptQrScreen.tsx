import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { ErrorView } from '@/components/ErrorView';
import { LoadingView } from '@/components/LoadingView';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';
import { AppStackParamList } from '@/navigation/types';
import { ReceiptVerificationResult, verifyReceiptQr } from '@/services/receiptService';

type Props = NativeStackScreenProps<AppStackParamList, 'ScanReceiptQR'>;

type BarcodeResult = {
  data: string;
};

export function ScanReceiptQrScreen({ navigation }: Props) {
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<ReceiptVerificationResult | null>(null);
  const [error, setError] = useState('');

  const onBarcodeScanned = async ({ data }: BarcodeResult) => {
    if (scanned || verifying) return;
    setScanned(true);
    setVerifying(true);
    setError('');
    setResult(null);

    try {
      const verification = await verifyReceiptQr(data);
      setResult(verification);
      if (!verification.valid) {
        setError(verification.error ?? 'Invalid or unrecognized receipt QR.');
      }
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Unable to verify receipt QR.');
    } finally {
      setVerifying(false);
    }
  };

  if (!permission) return <LoadingView message="Checking camera permission..." />;

  if (!permission.granted) {
    return (
      <View style={styles.screen}>
        <View style={styles.permissionCard}>
          <Ionicons name="camera-outline" size={34} color={colors.primary} />
          <Text style={styles.title}>Camera permission needed</Text>
          <Text style={styles.body}>Allow camera access to scan and verify VenueVerse receipt QR codes.</Text>
          <AppButton title="Allow Camera" onPress={() => void requestPermission()} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.scannerPane}>
        <CameraView
          active={isFocused}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          facing="back"
          onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
          style={styles.camera}
        />
        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.scanText}>Place the receipt QR inside the frame</Text>
        </View>
      </View>

      <View style={styles.resultSheet}>
        {verifying ? <Text style={styles.infoText}>Verifying receipt...</Text> : null}
        {error ? <ErrorView message={error} /> : null}
        {result?.valid ? <VerificationCard result={result} /> : null}
        <View style={styles.actionRow}>
          <View style={styles.action}>
            <AppButton
              title="Scan Again"
              variant="secondary"
              disabled={verifying}
              onPress={() => {
                setScanned(false);
                setResult(null);
                setError('');
              }}
            />
          </View>
          <View style={styles.action}>
            <AppButton title="Done" disabled={verifying} onPress={() => navigation.goBack()} />
          </View>
        </View>
      </View>
    </View>
  );
}

function VerificationCard({ result }: { result: ReceiptVerificationResult }) {
  const isApproved = result.status === 'approved';
  const isRevoked = Boolean(result.isRevoked);
  const statusColor = isRevoked ? colors.danger : isApproved ? colors.success : colors.danger;
  return (
    <View style={[styles.resultCard, isRevoked ? styles.rejectedCard : isApproved ? styles.approvedCard : styles.rejectedCard]}>
      <View style={styles.resultHeader}>
        <Ionicons
          name={isRevoked ? 'alert-circle-outline' : isApproved ? 'checkmark-circle-outline' : 'close-circle-outline'}
          size={24}
          color={statusColor}
        />
        <View style={styles.resultTitleWrap}>
          <Text style={styles.resultTitle}>{isRevoked ? 'BOOKING REVOKED' : 'Valid Receipt'}</Text>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {(isRevoked ? result.liveBookingStatus : result.status)?.toUpperCase()}
          </Text>
        </View>
      </View>
      {isRevoked ? (
        <>
          <ResultRow label="Reason" value={result.revocationReason} />
          <ResultRow label="Revoked on" value={result.revokedOn} />
          <ResultRow label="Revoked by" value={result.revokedByDepartment ? `${result.revokedByDepartment} Admin` : null} />
        </>
      ) : null}
      <ResultRow label="Receipt No" value={result.receiptNo} />
      <ResultRow label="Receipt Status" value={result.receiptStatus?.toUpperCase() ?? result.status?.toUpperCase()} />
      <ResultRow label="Booking ID" value={result.bookingId} />
      <ResultRow label="Event" value={result.eventTitle} />
      <ResultRow label="Venue" value={result.venue} />
      <ResultRow label="Date" value={result.date} />
      <ResultRow label="Time" value={result.timeSlot} />
      <ResultRow label="Department" value={result.department} />
    </View>
  );
}

function ResultRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={styles.resultValue}>{value ?? 'Not provided'}</Text>
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
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.background
  },
  permissionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
    ...shadows.card
  },
  title: {
    color: colors.text,
    fontSize: fontSizes.xl,
    fontWeight: '900',
    textAlign: 'center'
  },
  body: {
    color: colors.textMuted,
    fontSize: fontSizes.md,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center'
  },
  scannerPane: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#111827'
  },
  camera: {
    ...StyleSheet.absoluteFillObject
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    gap: spacing.lg
  },
  scanFrame: {
    width: 230,
    height: 230,
    borderWidth: 3,
    borderColor: colors.surface,
    borderRadius: radius.xl
  },
  scanText: {
    color: colors.surface,
    fontSize: fontSizes.md,
    fontWeight: '900',
    textAlign: 'center'
  },
  resultSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card
  },
  infoText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '800',
    textAlign: 'center'
  },
  resultCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm
  },
  approvedCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0'
  },
  rejectedCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA'
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  resultTitleWrap: {
    flex: 1
  },
  resultTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '900'
  },
  statusText: {
    fontSize: fontSizes.xs,
    fontWeight: '900'
  },
  resultRow: {
    gap: spacing.xs
  },
  resultLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  resultValue: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '800',
    lineHeight: 20
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  action: {
    flex: 1
  }
});
