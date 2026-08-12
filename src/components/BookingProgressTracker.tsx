import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';

type BookingProgressTrackerProps = {
  status: string | null | undefined;
};

type StepState = 'completed' | 'current' | 'upcoming' | 'approved' | 'rejected' | 'cancelled' | 'revoked';

type ProgressStep = {
  key: 'submitted' | 'review' | 'decision';
  label: string;
  state: StepState;
};

const successColor = colors.success;
const dangerColor = colors.danger;
const warningColor = colors.warning;
const mutedColor = colors.navBarInactive;

export function BookingProgressTracker({ status }: BookingProgressTrackerProps) {
  const steps = getBookingProgressState(status);
  const connectorOneCompleted = isFirstConnectorComplete(steps[1].state);
  const connectorTwoCompleted = ['approved', 'rejected', 'revoked'].includes(steps[2].state);
  const connectorTwoRejected = steps[2].state === 'rejected' || steps[2].state === 'revoked';

  return (
    <View style={styles.card}>
      <View style={styles.progressRow}>
        <ProgressNode step={steps[0]} />
        <Connector completed={connectorOneCompleted} />
        <ProgressNode step={steps[1]} />
        <Connector completed={connectorTwoCompleted} rejected={connectorTwoRejected} />
        <ProgressNode step={steps[2]} />
      </View>
      <View style={styles.labelRow}>
        {steps.map((step) => (
          <Text key={step.key} style={styles.stepLabel}>{step.label}</Text>
        ))}
      </View>
    </View>
  );
}

function ProgressNode({ step }: { step: ProgressStep }) {
  const config = getStepVisual(step.state);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${step.label} ${getAccessibilityState(step.state)}`}
      style={[styles.node, { backgroundColor: config.backgroundColor, borderColor: config.borderColor }]}
    >
      <Ionicons name={config.icon} size={18} color={config.iconColor} />
    </View>
  );
}

function Connector({ completed, rejected }: { completed: boolean; rejected?: boolean }) {
  return <View style={[styles.connector, completed && styles.connectorComplete, rejected && styles.connectorRejected]} />;
}

export function getBookingProgressState(status: string | null | undefined): ProgressStep[] {
  const normalizedStatus = status?.toLowerCase();

  if (normalizedStatus === 'pending') {
    return [
      { key: 'submitted', label: 'Submitted', state: 'completed' },
      { key: 'review', label: 'Review', state: 'current' },
      { key: 'decision', label: 'Decision', state: 'upcoming' }
    ];
  }

  if (normalizedStatus === 'approved') {
    return [
      { key: 'submitted', label: 'Submitted', state: 'completed' },
      { key: 'review', label: 'Review', state: 'completed' },
      { key: 'decision', label: 'Decision', state: 'approved' }
    ];
  }

  if (normalizedStatus === 'rejected') {
    return [
      { key: 'submitted', label: 'Submitted', state: 'completed' },
      { key: 'review', label: 'Review', state: 'completed' },
      { key: 'decision', label: 'Decision', state: 'rejected' }
    ];
  }

  if (normalizedStatus === 'cancelled') {
    return [
      { key: 'submitted', label: 'Submitted', state: 'completed' },
      { key: 'review', label: 'Review', state: 'cancelled' },
      { key: 'decision', label: 'Decision', state: 'upcoming' }
    ];
  }

  if (normalizedStatus === 'revoked') {
    return [
      { key: 'submitted', label: 'Submitted', state: 'completed' },
      { key: 'review', label: 'Review', state: 'completed' },
      { key: 'decision', label: 'Revoked', state: 'revoked' }
    ];
  }

  return [
    { key: 'submitted', label: 'Submitted', state: 'completed' },
    { key: 'review', label: 'Review', state: 'upcoming' },
    { key: 'decision', label: 'Decision', state: 'upcoming' }
  ];
}

function isFirstConnectorComplete(reviewState: StepState) {
  return ['completed', 'current', 'approved', 'rejected', 'cancelled'].includes(reviewState);
}

function getStepVisual(state: StepState) {
  if (state === 'completed') {
    return {
      icon: 'checkmark' as const,
      backgroundColor: successColor,
      borderColor: successColor,
      iconColor: colors.surface
    };
  }

  if (state === 'current') {
    return {
      icon: 'time-outline' as const,
      backgroundColor: '#FEF3C7',
      borderColor: warningColor,
      iconColor: warningColor
    };
  }

  if (state === 'approved') {
    return {
      icon: 'checkmark' as const,
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      iconColor: colors.surface
    };
  }

  if (state === 'rejected' || state === 'revoked') {
    return {
      icon: 'close' as const,
      backgroundColor: dangerColor,
      borderColor: dangerColor,
      iconColor: colors.surface
    };
  }

  if (state === 'cancelled') {
    return {
      icon: 'close' as const,
      backgroundColor: colors.surfaceMuted,
      borderColor: dangerColor,
      iconColor: dangerColor
    };
  }

  return {
    icon: 'ellipse-outline' as const,
    backgroundColor: colors.surface,
    borderColor: mutedColor,
    iconColor: mutedColor
  };
}

function getAccessibilityState(state: StepState) {
  if (state === 'approved') return 'approved';
  if (state === 'rejected') return 'rejected';
  if (state === 'revoked') return 'revoked';
  if (state === 'cancelled') return 'cancelled';
  if (state === 'current') return 'current';
  if (state === 'completed') return 'completed';
  return 'upcoming';
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  node: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  connector: {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderSoft,
    marginHorizontal: spacing.sm
  },
  connectorComplete: {
    backgroundColor: successColor
  },
  connectorRejected: {
    backgroundColor: dangerColor
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  stepLabel: {
    width: 82,
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: '900',
    textAlign: 'center'
  }
});
