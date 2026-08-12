import { supabase } from '@/lib/supabase';
import { clearCachedValue, measureAsync, withCache } from '@/utils/performanceCache';
import { Profile, UserRole } from '@/types/auth';
import { BookingPreview, BookingStatus } from '@/types/venue';

export type AdminCreateUserInput = {
  fullName: string;
  email: string;
  temporaryPassword: string;
  role: UserRole;
  department: string;
};

export type AdminCreateUserResult = {
  success: boolean;
  message?: string;
  user?: {
    id: string;
    email: string;
    full_name: string;
    department: string;
    role: UserRole;
  };
};

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  role: Profile['role'];
  auth_provider?: string | null;
  is_staff_verified?: boolean | null;
  onboarding_completed?: boolean | null;
};

type UserBookingRow = {
  id: string;
  event_title: string;
  status: BookingStatus;
  start_time: string;
  end_time: string;
  created_at: string | null;
  halls: { name: string } | { name: string }[] | null;
};

type AdminFunctionResponse = {
  success?: boolean;
  action?: 'account_deleted' | 'department_removed';
  error?: string;
};

const PROFILE_CACHE_TTL_MS = 30_000;
const PROFILE_LIST_CACHE_TTL_MS = 20_000;
const PROFILE_SELECT = 'id, full_name, email, department, role, auth_provider, is_staff_verified, onboarding_completed';

export async function fetchProfile(userId: string, email?: string | null): Promise<Profile | null> {
  return withCache(
    `profile:${userId}:${email?.trim().toLowerCase() ?? ''}`,
    PROFILE_CACHE_TTL_MS,
    () => measureAsync('profileService.fetchProfile', () => loadProfile(userId, email))
  );
}

async function loadProfile(userId: string, email?: string | null): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) return mapProfile(data as ProfileRow);

  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const { data: emailData, error: emailError } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .ilike('email', normalizedEmail)
    .maybeSingle();

  if (emailError) {
    throw emailError;
  }

  return emailData ? mapProfile(emailData as ProfileRow) : null;
}

export async function listProfiles(department?: string | null): Promise<Profile[]> {
  return withCache(
    `profiles:list:${department ?? 'all'}`,
    PROFILE_LIST_CACHE_TTL_MS,
    () => measureAsync('profileService.listProfiles', () => loadProfiles(department))
  );
}

async function loadProfiles(department?: string | null): Promise<Profile[]> {
  let query = supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .order('full_name', { ascending: true });

  if (department) query = query.eq('department', department);

  const { data, error } = await query;

  if (error) throw error;
  return ((data ?? []) as ProfileRow[]).map(mapProfile);
}

export async function listAllProfiles(): Promise<Profile[]> {
  return listProfiles();
}

export async function getProfileById(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapProfile(data as ProfileRow) : null;
}

export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  await callAdminUserFunction('admin-update-user-role', {
    target_user_id: userId,
    new_role: role
  });
}

export async function updateUserDepartmentAndRole(userId: string, department: string | null, role: UserRole): Promise<void> {
  await callAdminUserFunction('admin-update-user-role', {
    target_user_id: userId,
    new_role: role,
    department
  });
}

export async function deleteManagedUser(userId: string): Promise<AdminFunctionResponse> {
  return callAdminUserFunction('admin-delete-user', {
    user_id: userId
  });
}

export async function createAdminUser(input: AdminCreateUserInput): Promise<AdminCreateUserResult> {
  const payload = {
    full_name: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    temporary_password: input.temporaryPassword,
    role: input.role,
    department: input.department
  };

  const { data, error } = await supabase.functions.invoke('admin-create-user', {
    body: payload
  });

  if (error) {
    console.error('admin-create-user error:', error);
    const message = await getFunctionErrorMessage(error);
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  clearProfileCaches();

  if (data?.success) {
    return data as AdminCreateUserResult;
  }

  return {
    success: true,
    message: 'User created successfully.',
    user: {
      id: '',
      email: payload.email,
      full_name: payload.full_name,
      department: payload.department,
      role: payload.role
    }
  };
}

async function getFunctionErrorMessage(error: unknown) {
  const context = (error as { context?: Response | { json?: () => Promise<unknown>; text?: () => Promise<string>; clone?: () => Response } }).context;
  if (context) {
    const response = context.clone ? context.clone() : context;
    const body = response.json
      ? await response.json().catch(async () => {
        const textResponse = context.clone ? context.clone() : context;
        if (!textResponse.text) return null;
        const text = await textResponse.text().catch(() => '');
        try {
          return text ? JSON.parse(text) : null;
        } catch {
          return text ? { error: text } : null;
        }
      })
      : context.text
        ? await context.text().then((text) => {
      try {
        return text ? JSON.parse(text) : null;
      } catch {
        return text ? { error: text } : null;
      }
    }).catch(() => null)
        : null;

    if (body && typeof body === 'object' && 'error' in body) {
      const message = (body as { error?: unknown }).error;
      if (typeof message === 'string') return message;
    }
  }

  const fallback = error instanceof Error ? error.message : '';
  if (!fallback || fallback.includes('non-2xx')) {
    return 'Could not create user. Please check admin permissions and try again.';
  }

  return fallback;
}

async function callAdminUserFunction(functionName: string, body: Record<string, unknown>): Promise<AdminFunctionResponse> {
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  if (error) throw new Error(await getFunctionErrorMessage(error));
  const response = data as AdminFunctionResponse;
  if (response?.error) throw new Error(response.error);
  clearProfileCaches();
  return response ?? { success: true };
}

export async function updateOwnProfile(userId: string, input: {
  fullName: string;
  department: string;
}): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: input.fullName.trim(),
      department: input.department.trim() || null
    })
    .eq('id', userId)
    .select(PROFILE_SELECT)
    .single();

  if (error) throw error;
  clearProfileCaches();
  return mapProfile(data as ProfileRow);
}

export async function completeGoogleStaffOnboarding(input: {
  fullName: string;
  department: string;
}): Promise<Profile> {
  const { data, error } = await supabase.functions.invoke('complete-google-staff-onboarding', {
    body: {
      full_name: input.fullName.trim(),
      department: input.department.trim()
    }
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  clearProfileCaches();
  return mapProfile({
    id: data.profile.id,
    full_name: data.profile.full_name,
    email: data.profile.email,
    department: data.profile.department,
    role: data.profile.role,
    auth_provider: data.profile.auth_provider,
    is_staff_verified: data.profile.is_staff_verified,
    onboarding_completed: data.profile.onboarding_completed
  } as ProfileRow);
}

function clearProfileCaches() {
  clearCachedValue('profile:');
  clearCachedValue('profiles:list:');
}

export async function getUserBookingHistory(userId: string): Promise<BookingPreview[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, event_title, status, start_time, end_time, created_at, halls(name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as UserBookingRow[]).map((row) => {
    const hall = Array.isArray(row.halls) ? row.halls[0] : row.halls;

    return {
      id: row.id,
      eventTitle: row.event_title,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time,
      hallName: hall?.name ?? null,
      createdAt: row.created_at ?? undefined
    };
  });
}

export async function getUserBookingHistoryForVenueDepartment(userId: string, venueDepartment: string): Promise<BookingPreview[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, event_title, status, start_time, end_time, created_at, halls!inner(name, department)')
    .eq('user_id', userId)
    .eq('halls.department', venueDepartment)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as UserBookingRow[]).map((row) => {
    const hall = Array.isArray(row.halls) ? row.halls[0] : row.halls;

    return {
      id: row.id,
      eventTitle: row.event_title,
      status: row.status,
      startTime: row.start_time,
      endTime: row.end_time,
      hallName: hall?.name ?? null,
      createdAt: row.created_at ?? undefined
    };
  });
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    department: row.department,
    role: row.role,
    authProvider: row.auth_provider ?? null,
    isStaffVerified: row.is_staff_verified ?? false,
    onboardingCompleted: row.onboarding_completed ?? true
  };
}
