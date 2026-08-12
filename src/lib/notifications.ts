import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { navigateToBookingDetails, navigateToNotifications } from '@/navigation/navigationRef';

const DEFAULT_NOTIFICATION_CHANNEL_ID = 'default';
export const NOTIFICATION_PREFERENCE_KEY = 'venueverse.notifications.enabled';

type VenueVerseLocalNotificationType =
  | 'booking_rejected'
  | 'booking_approved'
  | 'booking_request'
  | 'booking_cancelled'
  | 'test_notification'
  | 'receipt_email_sent'
  | 'app_notification';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true
  })
});

export async function configureAndroidNotificationChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(DEFAULT_NOTIFICATION_CHANNEL_ID, {
      name: 'VenueVerse Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0A3A66',
      sound: 'default'
    });
    console.log('[notifications] channel configured');
  }
}

export async function getNotificationPreference(): Promise<boolean> {
  return (await AsyncStorage.getItem(NOTIFICATION_PREFERENCE_KEY)) === 'true';
}

export async function setNotificationPreference(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATION_PREFERENCE_KEY, enabled ? 'true' : 'false');
  console.log('[notifications] preference enabled', enabled);
}

export async function ensureNotificationPermission() {
  const existingPermission = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermission.status;
  let canAskAgain = existingPermission.canAskAgain;

  if (existingPermission.status !== 'granted') {
    const requestedPermission = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermission.status;
    canAskAgain = requestedPermission.canAskAgain;
  }

  console.log('[notifications] permission', finalStatus);
  console.log('[notifications] canAskAgain', canAskAgain);
  return finalStatus === 'granted';
}

export async function hasNotificationPermission() {
  const existingPermission = await Notifications.getPermissionsAsync();
  console.log('[notifications] permission', existingPermission.status);
  console.log('[notifications] canAskAgain', existingPermission.canAskAgain);
  return existingPermission.status === 'granted';
}

export async function configurePushNotifications() {
  await configureAndroidNotificationChannel();
}

export async function scheduleVenueVerseLocalNotification(params: {
  title: string;
  body: string;
  type?: VenueVerseLocalNotificationType;
  bookingId?: string | null;
  notificationId?: string | null;
  data?: Record<string, unknown>;
  seconds?: number;
}) {
  const enabled = await getNotificationPreference();
  console.log('[notifications] preference enabled', enabled);
  if (!enabled) {
    return null;
  }

  const hasPermission = await hasNotificationPermission();
  if (!hasPermission) {
    await setNotificationPreference(false);
    return null;
  }

  await configureAndroidNotificationChannel();

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: params.title,
      body: params.body,
      data: {
        ...(params.data ?? {}),
        type: params.type ?? params.data?.type ?? 'app_notification',
        booking_id: params.bookingId ?? params.data?.booking_id ?? null,
        notification_id: params.notificationId ?? params.data?.notification_id ?? null
      },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH
    },
    trigger: {
      seconds: params.seconds ?? 1,
      channelId: DEFAULT_NOTIFICATION_CHANNEL_ID
    }
  });
  console.log('[notifications] local scheduled', notificationId);
  return notificationId;
}

export async function scheduleLocalNotification(params: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  seconds?: number;
}) {
  return scheduleVenueVerseLocalNotification(params);
}

export async function scheduleTestNotification() {
  const notificationId = await scheduleVenueVerseLocalNotification({
    title: 'VenueVerse notifications are on',
    body: 'You will receive booking and app alerts on this device.',
    type: 'test_notification',
    data: {
      type: 'test_notification'
    },
    seconds: 1
  });

  console.log('[notifications] test scheduled', notificationId);
  return notificationId;
}


export function subscribeToPushNotificationReceived(onReceived?: () => void) {
  return Notifications.addNotificationReceivedListener((notification) => {
    if (__DEV__) console.log('[push] notification received', notification.request.content.data?.type ?? 'unknown');
    onReceived?.();
  });
}

export function subscribeToPushNotificationResponses() {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    const bookingId = typeof data?.booking_id === 'string' ? data.booking_id : null;
    if (bookingId) {
      navigateToBookingDetails(bookingId);
      return;
    }

    navigateToNotifications();
  });
}
