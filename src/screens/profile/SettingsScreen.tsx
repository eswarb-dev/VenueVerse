import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { APP_NAME } from '@/constants/app';
import { colors, fontSizes, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/store/AuthContext';

export function SettingsScreen() {
  const { logout } = useAuth();

  const confirmLogout = () => {
    Alert.alert('Log out?', 'You will be returned to the login screen.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: logout
      }
    ]);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.panel}>
        <Text style={styles.title}>{APP_NAME}</Text>
        <Text style={styles.body}>Version 1.0.0</Text>
        <Text style={styles.body}>A mobile booking workflow for campus halls, seminar rooms, and managed venues.</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Privacy</Text>
        <Text style={styles.body}>
          Your profile and booking information is used only for campus venue request review, approval, and booking history.
        </Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Contact admin</Text>
        <Text style={styles.body}>For booking corrections or access issues, contact the campus venue administrator.</Text>
      </View>

      <AppButton title="Log Out" variant="secondary" onPress={confirmLogout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: spacing.md,
    gap: spacing.md
  },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm
  },
  title: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '900'
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '900'
  },
  body: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    lineHeight: 21,
    fontWeight: '600'
  }
});
