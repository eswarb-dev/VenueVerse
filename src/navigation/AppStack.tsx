import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';
import { AdminStack } from '@/navigation/AdminStack';
import { colors } from '@/constants/theme';
import { AppStackParamList, UserTabParamList } from '@/navigation/types';
import { BookingDetailsScreen } from '@/screens/bookings/BookingDetailsScreen';
import { MyBookingsScreen } from '@/screens/bookings/MyBookingsScreen';
import { HallDetailsScreen } from '@/screens/halls/HallDetailsScreen';
import { HallListScreen } from '@/screens/halls/HallListScreen';
import { BookHallScreen } from '@/screens/halls/BookHallScreen';
import { VenueAvailabilityScreen } from '@/screens/halls/VenueAvailabilityScreen';
import { UserHomeScreen } from '@/screens/home/UserHomeScreen';
import { VenueScheduleScreen } from '@/screens/home/VenueScheduleScreen';
import { NotificationsScreen } from '@/screens/notifications/NotificationsScreen';
import { ChangePasswordScreen } from '@/screens/profile/ChangePasswordScreen';
import { EditProfileScreen } from '@/screens/profile/EditProfileScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { SettingsScreen } from '@/screens/profile/SettingsScreen';
import { ScanReceiptQrScreen } from '@/screens/receipt/ScanReceiptQrScreen';
import { AddHallScreen } from '@/screens/admin/AddHallScreen';
import { EditHallScreen } from '@/screens/admin/EditHallScreen';
import { HallManagementScreen } from '@/screens/admin/HallManagementScreen';
import { defaultScreenOptions } from '@/navigation/screenOptions';
import { NotificationProvider } from '@/hooks/useNotifications';
import { useAuth } from '@/store/AuthContext';

const Stack = createNativeStackNavigator<AppStackParamList>();
const Tab = createBottomTabNavigator<UserTabParamList>();

const tabBarOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.navBarSelected,
  tabBarInactiveTintColor: colors.navBarInactive,
  tabBarStyle: {
    backgroundColor: colors.navBarBackground,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 84 : 72,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    paddingTop: 8
  },
  tabBarLabelStyle: {
    fontSize: 11,
    fontWeight: '800' as const
  }
};

function UserTabNavigator() {
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      ...tabBarOptions,
      tabBarIcon: ({ color, focused, size }) => {
        const iconName = getUserTabIcon(route.name, focused);
        return <Ionicons name={iconName} color={color} size={size} />;
      }
    })}>
      <Tab.Screen name="Home" component={UserHomeScreen} />
      <Tab.Screen name="Book" component={HallListScreen} />
      <Tab.Screen name="Bookings" component={MyBookingsScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function AppStack() {
  const { profile } = useAuth();
  const canUseAdminArea = profile?.role === 'admin' || profile?.role === 'super_admin';

  return (
    <NotificationProvider>
      <Stack.Navigator screenOptions={defaultScreenOptions}>
        <Stack.Screen name="UserTabs" component={UserTabNavigator} options={{ headerShown: false }} />
        <Stack.Screen name="VenueSchedule" component={VenueScheduleScreen} options={{ title: 'Venue Schedule' }} />
        <Stack.Screen name="HallDetails" component={HallDetailsScreen} options={{ title: 'Hall Details' }} />
        <Stack.Screen name="VenueAvailability" component={VenueAvailabilityScreen} options={{ title: 'Venue Availability' }} />
        <Stack.Screen name="BookHall" component={BookHallScreen} options={{ title: 'Booking Request' }} />
        <Stack.Screen name="BookingDetails" component={BookingDetailsScreen} options={{ title: 'Booking Details' }} />
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Change Password' }} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="ScanReceiptQR" component={ScanReceiptQrScreen} options={{ title: 'Scan Receipt QR' }} />
        <Stack.Screen name="ManageHalls" component={HallManagementScreen} options={{ title: 'My Department Venues' }} />
        <Stack.Screen name="AddHall" component={AddHallScreen} options={{ title: 'Add Venue' }} />
        <Stack.Screen name="EditHall" component={EditHallScreen} options={{ title: 'Edit Venue' }} />
        {canUseAdminArea ? (
          <Stack.Screen name="AdminArea" component={AdminStack} options={{ headerShown: false }} />
        ) : null}
      </Stack.Navigator>
    </NotificationProvider>
  );
}

function getUserTabIcon(routeName: keyof UserTabParamList, focused: boolean) {
  if (routeName === 'Home') return focused ? 'home' : 'home-outline';
  if (routeName === 'Book') return focused ? 'calendar' : 'calendar-outline';
  if (routeName === 'Bookings') return focused ? 'list' : 'list-outline';
  if (routeName === 'Notifications') return focused ? 'notifications' : 'notifications-outline';
  return focused ? 'person' : 'person-outline';
}
