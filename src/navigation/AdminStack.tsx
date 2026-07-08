import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
import { AdminStackParamList } from '@/navigation/types';
import { defaultScreenOptions } from '@/navigation/screenOptions';
import { useAuth } from '@/store/AuthContext';

const Stack = createNativeStackNavigator<AdminStackParamList>();

export function AdminStack() {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  return (
    <Stack.Navigator screenOptions={defaultScreenOptions}>
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: 'Admin Dashboard' }} />
      <Stack.Screen name="PendingRequests" component={PendingRequestsScreen} options={{ title: 'Pending Requests' }} />
      <Stack.Screen name="BookingReview" component={BookingReviewScreen} options={{ title: 'Review Booking' }} />
      <Stack.Screen name="AllBookings" component={AllBookingsScreen} options={{ title: 'All Bookings' }} />
      {isSuperAdmin ? (
        <>
          <Stack.Screen name="ManageHalls" component={HallManagementScreen} options={{ title: 'Manage Venues' }} />
          <Stack.Screen name="AddHall" component={AddHallScreen} options={{ title: 'Add Venue' }} />
          <Stack.Screen name="EditHall" component={EditHallScreen} options={{ title: 'Edit Venue' }} />
          <Stack.Screen name="Users" component={UserManagementScreen} options={{ title: 'Users' }} />
          <Stack.Screen name="AddUser" component={AddUserScreen} options={{ title: 'Add User' }} />
          <Stack.Screen name="UserDetails" component={UserDetailsScreen} options={{ title: 'User Details' }} />
        </>
      ) : null}
    </Stack.Navigator>
  );
}
