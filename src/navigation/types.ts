import { NavigatorScreenParams } from '@react-navigation/native';
import { BookingStatus } from '@/types/venue';

export type VenueManagementMode = 'admin' | 'department';

export type VenueManagementParams = {
  mode?: VenueManagementMode;
  department?: string;
  isActive?: boolean;
} | undefined;

export type AuthStackParamList = {
  GetStarted: undefined;
  Login: undefined;
  StaffAccountCreation: undefined;
  ForgotPassword: undefined;
  VerifyResetOtp: { email: string };
  ResetPassword: { email?: string } | undefined;
};

export type AppStackParamList = {
  UserTabs: NavigatorScreenParams<UserTabParamList> | undefined;
  Home: undefined;
  VenueSchedule: undefined;
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
  ScanReceiptQR: undefined;
  AdminArea: undefined;
  ManageHalls: VenueManagementParams;
  AddHall: VenueManagementParams;
  EditHall: { hallId: string; mode?: VenueManagementMode; department?: string };
};

export type AdminStackParamList = {
  AdminTabs: NavigatorScreenParams<AdminTabParamList> | undefined;
  AdminDashboard: undefined;
  PendingRequests: undefined;
  BookingReview: { bookingId: string };
  AllBookings: { status?: BookingStatus } | undefined;
  ManageHalls: VenueManagementParams;
  AddHall: VenueManagementParams;
  EditHall: { hallId: string; mode?: VenueManagementMode; department?: string };
  Users: undefined;
  AddUser: undefined;
  UserDetails: { userId: string };
};

export type UserTabParamList = {
  Home: undefined;
  Book: undefined;
  Bookings: undefined;
  Notifications: undefined;
  Profile: undefined;
};

export type AdminTabParamList = {
  Dashboard: undefined;
  Requests: undefined;
  Bookings: { status?: BookingStatus; department?: string } | undefined;
  Users: undefined;
  Venues: VenueManagementParams;
};

export type RootStackParamList = {
  AuthLoading: undefined;
  AuthStack: undefined;
  AppStack: { screen?: keyof AppStackParamList } | undefined;
};
