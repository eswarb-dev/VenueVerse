import AsyncStorage from '@react-native-async-storage/async-storage';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { getNotificationPreference } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import {
  deactivateCurrentDeviceFcmToken,
  registerCurrentDeviceFcmToken,
  setupFcmTokenRefreshListener
} from '@/services/fcmNotificationService';
import { fetchProfile } from '@/services/profileService';
import { AuthState, Profile } from '@/types/auth';
import { getGoogleAccessError } from '@/utils/emailAccess';

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
  completeStaffOnboarding: () => Promise<Profile | null>;
  clearAuthMessage: () => void;
  startPasswordRecovery: () => Promise<void>;
  finishPasswordRecovery: () => Promise<void>;
  clearPasswordRecovery: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const PASSWORD_RECOVERY_STORAGE_KEY = 'venueverse_password_recovery';
const GOOGLE_REDIRECT_TO = 'venueverse://google-auth';

WebBrowser.maybeCompleteAuthSession();

async function getRecoveryFlag() {
  try {
    const value = await SecureStore.getItemAsync(PASSWORD_RECOVERY_STORAGE_KEY);
    if (value !== null) return value;

    const legacyValue = await AsyncStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY);
    if (legacyValue !== null) {
      await SecureStore.setItemAsync(PASSWORD_RECOVERY_STORAGE_KEY, legacyValue);
      await AsyncStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
    }

    return legacyValue;
  } catch {
    return null;
  }
}

async function setRecoveryFlag(enabled: boolean) {
  try {
    if (enabled) {
      await SecureStore.setItemAsync(PASSWORD_RECOVERY_STORAGE_KEY, 'true');
    } else {
      await SecureStore.deleteItemAsync(PASSWORD_RECOVERY_STORAGE_KEY);
    }
  } catch {
    // Auth state is still kept in memory for this run if secure storage fails.
  }

  await AsyncStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY).catch(() => undefined);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [needsStaffOnboarding, setNeedsStaffOnboarding] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const isPasswordRecoveryRef = useRef(false);

  const setPasswordRecovery = useCallback(async (enabled: boolean) => {
    isPasswordRecoveryRef.current = enabled;
    setIsPasswordRecovery(enabled);
    await setRecoveryFlag(enabled);
  }, []);

  const loadProfile = useCallback(async (nextSession: Session | null) => {
    if (!nextSession?.user) {
      setProfile(null);
      setNeedsStaffOnboarding(false);
      return null;
    }

    if (isGoogleSession(nextSession)) {
      const googleAccessError = getGoogleAccessError(nextSession.user.email);
      if (googleAccessError) {
        setAuthMessage(googleAccessError);
        setNeedsStaffOnboarding(false);
        setProfile(null);
        setSession(null);
        await supabase.auth.signOut();
        return null;
      }
    }

    const nextProfile = await fetchProfile(nextSession.user.id, nextSession.user.email);
    const shouldOnboard = isGoogleSession(nextSession) && (!nextProfile || nextProfile.onboardingCompleted === false);
    setNeedsStaffOnboarding(shouldOnboard);
    setProfile((current) => (profilesEqual(current, nextProfile) ? current : nextProfile));
    return nextProfile;
  }, []);

  useEffect(() => {
    let mounted = true;

    const initializeSession = async () => {
      try {
        const [recoveryFlag, { data }] = await Promise.all([
          getRecoveryFlag(),
          supabase.auth.getSession()
        ]);
        if (!mounted) return;

        const recovering = recoveryFlag === 'true' && Boolean(data.session);
        isPasswordRecoveryRef.current = recovering;
        setIsPasswordRecovery(recovering);
        setSession(data.session);
        await loadProfile(recovering ? null : data.session);
      } catch {
        if (!mounted) return;

        setSession(null);
        setProfile(null);
        await setPasswordRecovery(false);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        void setPasswordRecovery(true);
        setSession(nextSession);
        setProfile(null);
        setNeedsStaffOnboarding(false);
        return;
      }

      if (event === 'SIGNED_OUT') {
        void setPasswordRecovery(false);
        setSession(null);
        setProfile(null);
        setNeedsStaffOnboarding(false);
        return;
      }

      setSession(nextSession);
      loadProfile(isPasswordRecoveryRef.current ? null : nextSession).catch(() => setProfile(null));
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile, setPasswordRecovery]);

  useEffect(() => {
    if (isPasswordRecovery) return;
    if (!session?.user?.id) return;
    registerFcmTokenIfPreferred().catch(() => undefined);
  }, [isPasswordRecovery, session?.user?.id]);

  useEffect(() => {
    if (isPasswordRecovery) return undefined;
    if (!session?.user?.id) return undefined;

    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      registerFcmTokenIfPreferred().catch(() => undefined);
    });

    return () => subscription.remove();
  }, [isPasswordRecovery, session?.user?.id]);

  useEffect(() => {
    if (isPasswordRecovery) return undefined;
    if (!session?.user?.id) return undefined;

    const subscription = setupFcmTokenRefreshListener(async () => getNotificationPreference());
    return () => subscription?.remove();
  }, [isPasswordRecovery, session?.user?.id]);

  const login = useCallback(async (email: string, password: string) => {
    setAuthMessage('');
    await setPasswordRecovery(false);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });

    if (error) throw error;
    setSession(data.session);
    await loadProfile(data.session);
  }, [loadProfile, setPasswordRecovery]);

  const loginWithGoogle = useCallback(async () => {
    setAuthMessage('');
    await setPasswordRecovery(false);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: GOOGLE_REDIRECT_TO,
        skipBrowserRedirect: true,
        queryParams: {
          hd: 'srec.ac.in',
          prompt: 'select_account'
        }
      }
    });

    if (error || !data.url) {
      throw new Error('Google sign-in failed. Please try again.');
    }

    const response = await WebBrowser.openAuthSessionAsync(data.url, GOOGLE_REDIRECT_TO);
    if (response.type !== 'success') return;

    const session = await createSessionFromUrl(response.url);
    if (session) {
      setSession(session);
      await loadProfile(session);
    }
  }, [loadProfile, setPasswordRecovery]);

  const logout = useCallback(async () => {
    await deactivateCurrentDeviceFcmToken().catch(() => undefined);
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    await setPasswordRecovery(false);
    setSession(null);
    setProfile(null);
    setNeedsStaffOnboarding(false);
  }, [setPasswordRecovery]);

  const refreshProfile = useCallback(async () => loadProfile(session), [loadProfile, session]);
  const completeStaffOnboarding = useCallback(async () => {
    const nextProfile = await loadProfile(session);
    if (nextProfile) setNeedsStaffOnboarding(false);
    return nextProfile;
  }, [loadProfile, session]);
  const clearAuthMessage = useCallback(() => setAuthMessage(''), []);
  const startPasswordRecovery = useCallback(async () => setPasswordRecovery(true), [setPasswordRecovery]);
  const finishPasswordRecovery = useCallback(async () => setPasswordRecovery(false), [setPasswordRecovery]);
  const clearPasswordRecovery = useCallback(async () => setPasswordRecovery(false), [setPasswordRecovery]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      isPasswordRecovery,
      needsStaffOnboarding,
      authMessage,
      login,
      loginWithGoogle,
      logout,
      refreshProfile,
      completeStaffOnboarding,
      clearAuthMessage,
      startPasswordRecovery,
      finishPasswordRecovery,
      clearPasswordRecovery
    }),
    [authMessage, clearAuthMessage, clearPasswordRecovery, completeStaffOnboarding, finishPasswordRecovery, isPasswordRecovery, loading, login, loginWithGoogle, logout, needsStaffOnboarding, profile, refreshProfile, session, startPasswordRecovery]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;
  const code = params.code;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data.session;
  }

  if (!accessToken || !refreshToken) return null;

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });
  if (error) throw error;
  return data.session;
}

function isGoogleSession(session: Session | null) {
  const provider = session?.user?.app_metadata?.provider;
  if (provider === 'google') return true;
  return (session?.user?.identities ?? []).some((identity) => identity.provider === 'google');
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

function profilesEqual(first: Profile | null, second: Profile | null) {
  if (first === second) return true;
  if (!first || !second) return false;
  return (
    first.id === second.id &&
    first.fullName === second.fullName &&
    first.email === second.email &&
    first.department === second.department &&
    first.role === second.role &&
    first.onboardingCompleted === second.onboardingCompleted
  );
}

async function registerFcmTokenIfPreferred() {
  const enabled = await getNotificationPreference();
  if (!enabled) return;
  await registerCurrentDeviceFcmToken();
}
