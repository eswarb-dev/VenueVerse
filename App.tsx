import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from '@/navigation/RootNavigator';
import { colors } from '@/constants/theme';
import { configurePushNotifications, subscribeToPushNotificationResponses } from '@/lib/notifications';
import { AuthProvider } from '@/store/AuthContext';

export default function App() {
  useEffect(() => {
    configurePushNotifications().catch(() => undefined);
    const subscription = subscribeToPushNotificationResponses();
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
        <StatusBar style="light" backgroundColor={colors.primary} />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
