import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors, fontSizes, radius, shadows, spacing } from '@/constants/theme';
import {
  getNotificationPreference,
  setNotificationPreference
} from '@/lib/notifications';
import { createNotification } from '@/services/notificationService';
import { deactivateCurrentDeviceFcmToken, registerCurrentDeviceFcmToken } from '@/services/fcmNotificationService';
import { useAuth } from '@/store/AuthContext';

export function SettingsScreen() {
  const { profile, user } = useAuth();
  const userId = profile?.id ?? user?.id ?? null;
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loadingPreference, setLoadingPreference] = useState(true);
  const [testingNotification, setTestingNotification] = useState(false);

  useEffect(() => {
    getNotificationPreference()
      .then(setNotificationsEnabled)
      .finally(() => setLoadingPreference(false));
  }, []);

  const showSettingsGuidance = () => {
    Alert.alert(
      'Notifications are disabled',
      'Open Android Settings -> Apps -> VenueVerse -> Notifications -> Allow notifications.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open App Settings', onPress: () => Linking.openSettings() }
      ]
    );
  };

  const showRemoteRegistrationFailure = (message?: string) => {
    Alert.alert(
      'Remote notifications not registered',
      message || 'VenueVerse could not register this device with Supabase. Reinstall the latest APK, open the app, sign in, and try enabling notifications again.'
    );
  };

  const handleToggleNotifications = async (enabled: boolean) => {
    setLoadingPreference(true);
    try {
      if (!enabled) {
        await deactivateCurrentDeviceFcmToken();
        await setNotificationPreference(false);
        setNotificationsEnabled(false);
        return;
      }

      if (!userId) {
        throw new Error('Sign in again before enabling remote notifications.');
      }

      const result = await registerCurrentDeviceFcmToken({ strict: true });
      if (result.success) {
        await setNotificationPreference(true);
        setNotificationsEnabled(true);
        Alert.alert('Notifications enabled', 'VenueVerse notifications are now enabled on this device.');
      } else {
        await setNotificationPreference(false);
        setNotificationsEnabled(false);
        showSettingsGuidance();
      }
    } catch (error) {
      if (__DEV__) console.log('[notifications] preference update failed', error);
      setNotificationsEnabled(false);
      showRemoteRegistrationFailure(error instanceof Error ? error.message : undefined);
    } finally {
      setLoadingPreference(false);
    }
  };

  const handleSendTestNotification = async () => {
    if (!userId) {
      Alert.alert('Sign in required', 'Sign in again before sending a test notification.');
      return;
    }

    setTestingNotification(true);
    try {
      await createNotification({
        userId,
        title: 'VenueVerse test notification',
        message: 'Push notifications are working on this device.',
        type: 'test_push',
        data: {
          source: 'settings'
        }
      });
      Alert.alert('Test notification sent', 'VenueVerse created a notification row. Supabase will dispatch it through Firebase FCM.');
    } catch (error) {
      if (__DEV__) console.log('[notifications] test notification failed', error);
      Alert.alert('Test notification failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setTestingNotification(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.panel}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name="notifications-outline" size={22} color={colors.primary} />
          </View>
          <Text style={styles.sectionTitle}>Notifications</Text>
        </View>

        <View style={styles.preferenceRow}>
          <View style={styles.preferenceCopy}>
            <Text style={styles.preferenceTitle}>App Notifications</Text>
            <Text style={styles.body}>Receive booking updates and local alerts on this device.</Text>
          </View>
          <Switch
            disabled={loadingPreference}
            value={notificationsEnabled}
            onValueChange={handleToggleNotifications}
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={notificationsEnabled ? colors.primary : colors.placeholder}
          />
        </View>

        <PrimaryButton
          title="Send Test Notification"
          icon="notifications-outline"
          variant="secondary"
          disabled={!notificationsEnabled || loadingPreference}
          loading={testingNotification}
          onPress={handleSendTestNotification}
        />
      </View>
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
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '900'
  },
  body: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    lineHeight: 21,
    fontWeight: '700'
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  preferenceCopy: {
    flex: 1,
    gap: spacing.xs
  },
  preferenceTitle: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '900'
  },
});
