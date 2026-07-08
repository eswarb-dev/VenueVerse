import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { navigateToNotifications } from '@/navigation/navigationRef';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

export async function configurePushNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1E3A8A'
    });
  }
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  await configurePushNotifications();

  if (!Device.isDevice) {
    return null;
  }

  const existingPermission = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermission.status;

  if (existingPermission.status !== 'granted') {
    const requestedPermission = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermission.status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    return null;
  }

  const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });

  return tokenResult.data;
}

export async function savePushToken(userId: string, token: string): Promise<void> {
  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      expo_push_token: token,
      platform: Platform.OS,
      device_name: Device.deviceName ?? null,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id,expo_push_token' }
  );

  if (error) throw error;
}

export async function registerAndSavePushToken(userId: string): Promise<void> {
  try {
    const token = await registerForPushNotificationsAsync();
    if (token) {
      await savePushToken(userId, token);
    }
  } catch {
    // Push permission/token failures should never block authentication.
  }
}

export async function sendPushNotification(params: {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.functions.invoke('send-push-notification', {
    body: {
      user_id: params.userId,
      title: params.title,
      body: params.body,
      data: params.data ?? {}
    }
  });

  if (error) throw error;
}

export function subscribeToPushNotificationResponses() {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data?.booking_id) {
      navigateToNotifications();
      return;
    }

    navigateToNotifications();
  });
}
