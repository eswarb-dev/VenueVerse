import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppLogoMark } from '@/components/AppLogoMark';
import { APP_NAME } from '@/constants/app';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';

type DeveloperProfile = {
  name: string;
  role: string;
  batch?: string;
  department?: string;
};

const originalDevelopers: DeveloperProfile[] = [
  {
    name: 'Prasath S',
    batch: '2020-2023',
    role: 'Original Version 1 Developer',
    department: 'Department of Artificial Intelligence and Data Science'
  },
  {
    name: 'Akash L',
    batch: '2020-2023',
    role: 'Original Version 1 Developer',
    department: 'Department of Artificial Intelligence and Data Science'
  }
];

const versionTwoDevelopers: DeveloperProfile[] = [
  {
    name: 'Eswar B',
    batch: '2024-2028',
    role: 'Version 2.0 UI/UX, App Development, Supabase Integration, Receipt & QR Workflow',
    department: 'Department of Artificial Intelligence and Data Science'
  },
  {
    name: 'Rahul M',
    batch: '2024-2028',
    role: 'Version 2.0 Development Support, Testing, Booking Workflow',
    department: 'Department of Artificial Intelligence and Data Science'
  },
  {
    name: 'Abhishek A',
    batch: '2024-2028',
    role: 'Version 2.0 Development Support, Testing, Documentation',
    department: 'Department of Artificial Intelligence and Data Science'
  }
];

export function AboutCard() {
  const [selectedDeveloper, setSelectedDeveloper] = useState<DeveloperProfile | null>(null);

  return (
    <>
      <View style={styles.card}>
        <View style={styles.header}>
          <AppLogoMark size={42} />
          <Text style={styles.title}>About</Text>
        </View>

        <Text style={styles.body}>
          {APP_NAME} is a college venue booking platform designed to simplify venue reservations, approval workflows,
          booking receipts, and QR-based verification for auditoriums, seminar halls, and labs.
        </Text>

        <Text style={styles.version}>Version 2.0.0</Text>

        <View style={styles.developerBlock}>
          <Text style={styles.label}>Mentored by</Text>
          <Text style={styles.mentorText}>Dr. V. Karpagam, Prof &amp; Head / AI&amp;DS</Text>
          <Text style={styles.mentorText}>Mrs. P. V. Kavitha, AP (Sl.Gr) / AI&amp;DS</Text>
        </View>

        <View style={styles.developerBlock}>
          <Text style={styles.label}>Originally Developed By</Text>
          <DeveloperNameRow developers={originalDevelopers} onSelect={setSelectedDeveloper} />
        </View>

        <View style={styles.developerBlock}>
          <Text style={styles.label}>Redesigned and Enhanced By</Text>
          <DeveloperNameRow developers={versionTwoDevelopers} onSelect={setSelectedDeveloper} />
        </View>

        <View style={styles.collegeBlock}>
          <Text style={styles.department}>Department of Artificial Intelligence and Data Science</Text>
          <Text style={styles.department}>Sri Ramakrishna Engineering College</Text>
        </View>
      </View>

      <DeveloperProfileModal developer={selectedDeveloper} onClose={() => setSelectedDeveloper(null)} />
    </>
  );
}

function DeveloperNameRow({
  developers,
  onSelect
}: {
  developers: DeveloperProfile[];
  onSelect: (developer: DeveloperProfile) => void;
}) {
  return (
    <View style={styles.nameRow}>
      {developers.map((developer, index) => (
        <View key={developer.name} style={styles.nameItem}>
          <Pressable accessibilityRole="button" onPress={() => onSelect(developer)} hitSlop={6} style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.nameLink}>{developer.name}</Text>
          </Pressable>
          {index < developers.length - 1 ? <Text style={styles.separator}>•</Text> : null}
        </View>
      ))}
    </View>
  );
}

function DeveloperProfileModal({
  developer,
  onClose
}: {
  developer: DeveloperProfile | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={Boolean(developer)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{developer?.name}</Text>
          {developer?.batch ? <Text style={styles.modalLine}>Batch: {developer.batch}</Text> : null}
          <Text style={styles.modalBody}>Role: {developer?.role}</Text>
          {developer?.department ? <Text style={styles.modalMuted}>{developer.department}</Text> : null}
          <Text style={styles.modalCollege}>Sri Ramakrishna Engineering College</Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  title: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '900'
  },
  body: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    lineHeight: 21
  },
  version: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '900',
    lineHeight: 21
  },
  developerBlock: {
    gap: spacing.xs
  },
  collegeBlock: {
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  label: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  nameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs
  },
  nameItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  nameLink: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '900',
    lineHeight: 21
  },
  mentorText: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '800',
    lineHeight: 21
  },
  separator: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '900',
    lineHeight: 21
  },
  department: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: '700',
    lineHeight: 18
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
    padding: spacing.lg
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card
  },
  modalTitle: {
    color: colors.primary,
    fontSize: fontSizes.lg,
    fontWeight: '900',
    lineHeight: 26,
    textAlign: 'center'
  },
  modalLine: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '800',
    lineHeight: 21,
    textAlign: 'center'
  },
  modalBody: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    lineHeight: 21,
    textAlign: 'center'
  },
  modalMuted: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    lineHeight: 21,
    textAlign: 'center'
  },
  modalCollege: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '900',
    lineHeight: 21,
    textAlign: 'center'
  },
  closeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginTop: spacing.sm
  },
  closeButtonText: {
    color: colors.surface,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  pressed: {
    opacity: 0.65
  }
});
