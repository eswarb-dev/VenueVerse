import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform } from 'react-native';
import { AllBookingsScreen } from '@/screens/admin/AllBookingsScreen';
import { AddUserScreen } from '@/screens/admin/AddUserScreen';
import { AddHallScreen } from '@/screens/admin/AddHallScreen';
import { AdminDashboardScreen } from '@/screens/admin/AdminDashboardScreen';
import { BookingReviewScreen } from '@/screens/admin/BookingReviewScreen';
import { EditHallScreen } from '@/screens/admin/EditHallScreen';
import { HallManagementScreen } from '@/screens/admin/HallManagementScreen';
import { PendingRequestsScreen } from '@/screens/admin/PendingRequestsScreen';
import { UserDetailsScreen } from '@/screens/admin/UserDetailsScreen';
import { UserManagementScreen } from '@/screens/admin/UserManagementScreen';
import { colors } from '@/constants/theme';
import { AdminStackParamList, AdminTabParamList } from '@/navigation/types';
import { defaultScreenOptions } from '@/navigation/screenOptions';
import { useAuth } from '@/store/AuthContext';

const Stack = createNativeStackNavigator<AdminStackParamList>();
const Tab = createBottomTabNavigator<AdminTabParamList>();

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

function AdminTabNavigator() {
  const { profile } = useAuth();
  const canManageGlobally = profile?.role === 'admin' || profile?.role === 'super_admin';

  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      ...tabBarOptions,
      tabBarIcon: ({ color, focused, size }) => {
        const iconName = getAdminTabIcon(route.name, focused);
        return <Ionicons name={iconName} color={color} size={size} />;
      }
    })}>
      <Tab.Screen name="Dashboard" component={AdminDashboardScreen} />
      <Tab.Screen name="Requests" component={PendingRequestsScreen} />
      <Tab.Screen name="Bookings" component={AllBookingsScreen} />
      {canManageGlobally ? (
        <>
          <Tab.Screen name="Users" component={UserManagementScreen} />
          <Tab.Screen name="Venues" component={HallManagementScreen} />
        </>
      ) : null}
    </Tab.Navigator>
  );
}

export function AdminStack() {
  const { profile } = useAuth();
  const canManageGlobally = profile?.role === 'admin' || profile?.role === 'super_admin';

  return (
    <Stack.Navigator screenOptions={defaultScreenOptions}>
      <Stack.Screen name="AdminTabs" component={AdminTabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="BookingReview" component={BookingReviewScreen} options={{ title: 'Review Booking' }} />
      {canManageGlobally ? (
        <>
          <Stack.Screen name="AddUser" component={AddUserScreen} options={{ title: 'Add User' }} />
          <Stack.Screen name="UserDetails" component={UserDetailsScreen} options={{ title: 'User Details' }} />
        </>
      ) : null}
      <Stack.Screen name="AddHall" component={AddHallScreen} options={{ title: 'Add Venue' }} />
      <Stack.Screen name="EditHall" component={EditHallScreen} options={{ title: 'Edit Venue' }} />
    </Stack.Navigator>
  );
}

function getAdminTabIcon(routeName: keyof AdminTabParamList, focused: boolean) {
  if (routeName === 'Dashboard') return focused ? 'grid' : 'grid-outline';
  if (routeName === 'Requests') return focused ? 'time' : 'time-outline';
  if (routeName === 'Bookings') return focused ? 'file-tray-full' : 'file-tray-full-outline';
  if (routeName === 'Users') return focused ? 'people' : 'people-outline';
  return focused ? 'business' : 'business-outline';
}
