import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/components/AppButton';
import { EmptyState } from '@/components/EmptyState';
import { LoadingView } from '@/components/LoadingView';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';
import { AppStackParamList } from '@/navigation/types';
import { useAuth } from '@/store/AuthContext';

type Props = NativeStackScreenProps<AppStackParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const { profile, loading, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const confirmLogout = () => {
    Alert.alert('Log out?', 'Are you sure you want to log out of this account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoggingOut(true);
            setLogoutError('');
            await logout();
          } catch {
            setLogoutError('Failed to log out. Please try again.');
          } finally {
            setLoggingOut(false);
          }
        }
      }
    ]);
  };

  if (loading) return <LoadingView message="Loading profile..." />;

  if (!profile) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Profile information unavailable." message="Your profile details could not be loaded right now." />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.summaryCard}>
        <Text style={styles.name}>{profile.fullName}</Text>
        <Text style={styles.email}>{profile.email}</Text>
      </View>

      <Section title="Profile Information">
        <Detail label="Full name" value={profile.fullName} />
        <Detail label="Email" value={profile.email} />
        <Detail label="Department" value={profile.department} />
        <Detail label="Role" value={profile.role} />
      </Section>

      <Section title="Password">
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Using a temporary password?</Text>
          <Text style={styles.infoText}>Change your password after your first login to keep your account secure.</Text>
        </View>
        <Text style={styles.sectionBody}>Update your temporary password after your first login.</Text>
        <AppButton title="Change Password" variant="secondary" onPress={() => navigation.navigate('ChangePassword')} />
      </Section>

      {logoutError ? <Text style={styles.errorText}>{logoutError}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={loggingOut}
        onPress={confirmLogout}
        style={({ pressed }) => [styles.logoutButton, (pressed || loggingOut) && styles.buttonPressed]}
      >
        {loggingOut ? (
          <ActivityIndicator color="#DC2626" />
        ) : (
          <Text style={styles.logoutText}>Log Out</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || 'Not provided'}</Text>
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
    padding: spacing.md,
    backgroundColor: colors.background
  },
  content: {
    padding: spacing.md,
    gap: spacing.md
  },
  summaryCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadows.card
  },
  name: {
    color: colors.surface,
    fontSize: fontSizes.xl,
    fontWeight: '900'
  },
  email: {
    color: colors.onPrimarySubtle,
    fontSize: fontSizes.sm,
    fontWeight: '700'
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '900'
  },
  sectionBody: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    lineHeight: 20
  },
  infoBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs
  },
  infoTitle: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  infoText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: '700',
    lineHeight: 20
  },
  detail: {
    gap: spacing.xs
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    fontWeight: '900',
    textTransform: 'uppercase'
  },
  detailValue: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '700',
    lineHeight: 22
  },
  errorText: {
    color: colors.status.rejected,
    backgroundColor: colors.errorSurface,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSizes.sm,
    fontWeight: '700'
  },
  logoutButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#DC2626',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md
  },
  logoutText: {
    color: '#DC2626',
    fontSize: fontSizes.sm,
    fontWeight: '900'
  },
  buttonPressed: {
    opacity: 0.65
  }
});
