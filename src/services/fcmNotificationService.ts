import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const DEFAULT_NOTIFICATION_CHANNEL_ID = 'default';
const INSTALLATION_ID_KEY = 'venueverse.device.installation_id';

type FcmRegistrationResult =
  | { success: true; registrationId: string; token: string }
  | { success: false; reason: 'unsupported_platform' | 'not_physical_device' | 'permission_denied' | 'empty_token' };

export async function registerCurrentDeviceFcmToken(options: { strict?: boolean } = {}): Promise<FcmRegistrationResult> {
  try {
    if (Platform.OS !== 'android') {
      return { success: false, reason: 'unsupported_platform' };
    }

    await configureAndroidNotificationChannel();

    const hasPermission = await ensureNotificationPermission();
    if (!hasPermission) {
      return { success: false, reason: 'permission_denied' };
    }

    if (!Device.isDevice) {
      return { success: false, reason: 'not_physical_device' };
    }

    const devicePushToken = await Notifications.getDevicePushTokenAsync();
    const fcmToken = String(devicePushToken.data ?? '').trim();

    if (!fcmToken) {
      return { success: false, reason: 'empty_token' };
    }

    if (__DEV__) console.log('[fcm-register] native token obtained', maskToken(fcmToken));

    const installationId = await getInstallationId();
    const { data, error } = await supabase.functions.invoke('register-fcm-token', {
      body: {
        fcm_token: fcmToken,
        installation_id: installationId,
        device_id: getDeviceLabel(),
        platform: 'android',
        app_variant: getAppVariant(),
        application_id: getApplicationId(),
        app_version: getNativeAppVersion(),
        is_active: true
      }
    });

    if (error) throw error;

    const registrationId = typeof data?.registration_id === 'string' ? data.registration_id : '';
    if (!registrationId) {
      throw new Error('Supabase did not return an FCM registration id.');
    }

    if (__DEV__) console.log('[fcm-register] token registered', registrationId);
    return { success: true, registrationId, token: fcmToken };
  } catch (error) {
    if (__DEV__) console.log('[fcm-register] registration failed', error);
    if (options.strict) throw error;
    return { success: false, reason: 'empty_token' };
  }
}

export async function deactivateCurrentDeviceFcmToken(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const installationId = await getInstallationId();
  const { error } = await supabase.functions.invoke('register-fcm-token', {
    body: {
      installation_id: installationId,
      device_id: getDeviceLabel(),
      platform: 'android',
      app_variant: getAppVariant(),
      application_id: getApplicationId(),
      app_version: getNativeAppVersion(),
      is_active: false
    }
  });

  if (error) throw error;
}

export function setupFcmTokenRefreshListener(shouldRegister?: () => Promise<boolean>) {
  if (Platform.OS !== 'android') return null;

  return Notifications.addPushTokenListener(async (token) => {
    if (shouldRegister && !(await shouldRegister().catch(() => false))) return;

    const fcmToken = String(token.data ?? '').trim();
    if (!fcmToken) return;

    if (__DEV__) console.log('[fcm-register] token refreshed', maskToken(fcmToken));
    registerExistingFcmToken(fcmToken).catch((error) => {
      if (__DEV__) console.log('[fcm-register] refreshed token registration failed', error);
    });
  });
}

async function registerExistingFcmToken(fcmToken: string) {
  const installationId = await getInstallationId();
  const { error } = await supabase.functions.invoke('register-fcm-token', {
    body: {
      fcm_token: fcmToken,
      installation_id: installationId,
      device_id: getDeviceLabel(),
      platform: 'android',
      app_variant: getAppVariant(),
      application_id: getApplicationId(),
      app_version: getNativeAppVersion(),
      is_active: true
    }
  });

  if (error) throw error;
}

async function configureAndroidNotificationChannel() {
  await Notifications.setNotificationChannelAsync(DEFAULT_NOTIFICATION_CHANNEL_ID, {
    name: 'VenueVerse Notifications',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0A3A66',
    enableVibrate: true,
    showBadge: true
  });
}

async function ensureNotificationPermission() {
  const existingPermission = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermission.status;

  if (existingPermission.status !== 'granted') {
    const requestedPermission = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermission.status;
  }

  if (__DEV__) console.log('[fcm-register] permission status', finalStatus);
  return finalStatus === 'granted';
}

async function getInstallationId() {
  const existingId = await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
  if (existingId) return existingId;

  const installationId = createInstallationId();
  await SecureStore.setItemAsync(INSTALLATION_ID_KEY, installationId);
  return installationId;
}

function createInstallationId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return 'vv-' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function getAppVariant() {
  const constants = Constants as typeof Constants & {
    appOwnership?: string | null;
    executionEnvironment?: string | null;
    nativeAppVersion?: string | null;
  };

  const configuredVariant = Constants.expoConfig?.extra?.appVariant;
  if (configuredVariant === 'development' || configuredVariant === 'preview' || configuredVariant === 'production') {
    return configuredVariant;
  }

  if (constants.appOwnership === 'expo') return 'development';
  if (constants.executionEnvironment === 'storeClient') return 'development';
  if (__DEV__) return 'development';
  return 'production';
}

function getNativeAppVersion() {
  const constants = Constants as typeof Constants & { nativeAppVersion?: string | null };
  return constants.nativeAppVersion ?? Constants.expoConfig?.version ?? null;
}

function getApplicationId() {
  const constants = Constants as typeof Constants & {
    expoConfig?: typeof Constants.expoConfig & {
      android?: {
        package?: string;
      };
    };
  };

  return constants.expoConfig?.android?.package ?? null;
}

function getDeviceLabel() {
  return [Device.manufacturer, Device.modelName].filter(Boolean).join(' ').trim() || null;
}

function maskToken(token: string) {
  if (token.length <= 16) return '***';
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}
