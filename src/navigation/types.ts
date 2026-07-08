import { BookingStatus } from '@/types/venue';

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
};

export type AppStackParamList = {
  Home: undefined;
  Halls: undefined;
  HallDetails: { hallId: string };
  VenueAvailability: { hallId?: string } | undefined;
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

export type AdminStackParamList = {
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
  AuthLoading: undefined;
  AuthStack: undefined;
  AppStack: { screen?: keyof AppStackParamList } | undefined;
};
