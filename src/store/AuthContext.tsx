import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { registerAndSavePushToken } from '@/lib/notifications';
import { fetchProfile } from '@/services/profileService';
import { AuthState, Profile } from '@/types/auth';

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (nextSession: Session | null) => {
    if (!nextSession?.user) {
      setProfile(null);
      return null;
    }

    const nextProfile = await fetchProfile(nextSession.user.id);
    setProfile(nextProfile);
    return nextProfile;
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadProfile(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      loadProfile(nextSession).catch(() => setProfile(null));
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  useEffect(() => {
    if (!session?.user?.id) return;
    registerAndSavePushToken(session.user.id).catch(() => undefined);
  }, [session?.user?.id]);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });

    if (error) throw error;
    setSession(data.session);
    await loadProfile(data.session);
    if (data.session?.user?.id) {
      registerAndSavePushToken(data.session.user.id).catch(() => undefined);
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    if (error) throw error;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
    setProfile(null);
  };

  const refreshProfile = async () => loadProfile(session);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      login,
      resetPassword,
      logout,
      refreshProfile
    }),
    [loading, profile, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
