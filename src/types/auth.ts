import { Session, User } from '@supabase/supabase-js';

export type UserRole = 'user' | 'admin' | 'super_admin';

export type Profile = {
  id: string;
  fullName: string;
  email: string;
  department: string | null;
  role: UserRole;
  authProvider?: string | null;
  isStaffVerified?: boolean;
  onboardingCompleted?: boolean;
};

export type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  needsStaffOnboarding: boolean;
  authMessage: string;
};
