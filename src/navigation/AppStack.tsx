import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminStack } from '@/navigation/AdminStack';
import { AppStackParamList } from '@/navigation/types';
import { BookingDetailsScreen } from '@/screens/bookings/BookingDetailsScreen';
import { MyBookingsScreen } from '@/screens/bookings/MyBookingsScreen';
import { HallDetailsScreen } from '@/screens/halls/HallDetailsScreen';
import { HallListScreen } from '@/screens/halls/HallListScreen';
import { BookHallScreen } from '@/screens/halls/BookHallScreen';
import { VenueAvailabilityScreen } from '@/screens/halls/VenueAvailabilityScreen';
import { UserHomeScreen } from '@/screens/home/UserHomeScreen';
import { NotificationsScreen } from '@/screens/notifications/NotificationsScreen';
import { ChangePasswordScreen } from '@/screens/profile/ChangePasswordScreen';
import { EditProfileScreen } from '@/screens/profile/EditProfileScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { SettingsScreen } from '@/screens/profile/SettingsScreen';
import { defaultScreenOptions } from '@/navigation/screenOptions';
import { NotificationProvider } from '@/hooks/useNotifications';
import { useAuth } from '@/store/AuthContext';

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppStack() {
  const { profile } = useAuth();
  const canUseAdminArea = profile?.role === 'admin' || profile?.role === 'super_admin';

  return (
    <NotificationProvider>
      <Stack.Navigator screenOptions={defaultScreenOptions}>
        <Stack.Screen name="Home" component={UserHomeScreen} options={{ title: 'Home' }} />
        <Stack.Screen name="Halls" component={HallListScreen} options={{ title: 'Book a Venue' }} />
        <Stack.Screen name="HallDetails" component={HallDetailsScreen} options={{ title: 'Hall Details' }} />
        <Stack.Screen name="VenueAvailability" component={VenueAvailabilityScreen} options={{ title: 'Venue Availability' }} />
        <Stack.Screen name="BookHall" component={BookHallScreen} options={{ title: 'Booking Request' }} />
        <Stack.Screen name="Bookings" component={MyBookingsScreen} options={{ title: 'My Bookings' }} />
        <Stack.Screen name="BookingDetails" component={BookingDetailsScreen} options={{ title: 'Booking Details' }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Change Password' }} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        {canUseAdminArea ? (
          <Stack.Screen name="AdminArea" component={AdminStack} options={{ headerShown: false }} />
        ) : null}
      </Stack.Navigator>
    </NotificationProvider>
  );
}
