import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from '@/navigation/types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateToNotifications() {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('AppStack', { screen: 'Notifications' });
}
