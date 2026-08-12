import { NavigatorScreenParams } from '@react-navigation/native';
import { BookingStatus } from '@/types/venue';

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
};

export type UserTabParamList = {
  Home: undefined;
  Book: undefined;
  Bookings: undefined;
  Notifications: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  UserTabs: NavigatorScreenParams<UserTabParamList>;
  Home: undefined;
  Halls: undefined; // Backwards compatible mapping to Book
  Book: undefined;
  HallDetails: { hallId: string };
  VenueAvailability: { hallId: string; hallName?: string };
  BookHall: { hallId: string; bookingDate: string; startTime: string; endTime: string; slotLabel: string };
  Bookings: undefined;
  BookingDetails: { bookingId: string };
  Notifications: undefined;
  Profile: undefined;
  ChangePassword: undefined;
  EditProfile: undefined;
  Settings: undefined;
  AdminArea: undefined;
};

export type AdminTabParamList = {
  AdminDashboard: undefined;
  PendingRequests: undefined;
  AllBookings: { status?: BookingStatus } | undefined;
  Users: undefined;
  ManageHalls: { isActive?: boolean } | undefined;
};

export type AdminStackParamList = {
  AdminTabs: NavigatorScreenParams<AdminTabParamList>;
  AdminDashboard: undefined;
  PendingRequests: undefined;
  BookingReview: { bookingId: string };
  AllBookings: { status?: BookingStatus } | undefined;
  ManageHalls: { isActive?: boolean } | undefined;
  AddHall: undefined;
  EditHall: { hallId: string };
  Users: undefined;
  AddUser: undefined;
  UserDetails: { userId: string };
};

export type RootStackParamList = {
  GetStarted: undefined;
  AuthLoading: undefined;
  AuthStack: undefined;
  AppStack: { screen?: keyof AppStackParamList } | undefined;
};

