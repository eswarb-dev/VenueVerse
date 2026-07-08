import { supabase } from '@/lib/supabase';
import { Profile, UserRole } from '@/types/auth';
import { BookingPreview, BookingStatus } from '@/types/venue';

export type AdminCreateUserInput = {
  fullName: string;
  email: string;
  temporaryPassword: string;
  role: UserRole;
  department: string;
};

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  role: Profile['role'];
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

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, department, role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapProfile(data as ProfileRow) : null;
}

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, department, role')
    .order('full_name', { ascending: true });

  if (error) throw error;
  return ((data ?? []) as ProfileRow[]).map(mapProfile);
}

export async function getProfileById(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, department, role')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapProfile(data as ProfileRow) : null;
}

export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) throw error;
}

export async function createAdminUser(input: AdminCreateUserInput): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-create-user', {
    body: {
      full_name: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      temporary_password: input.temporaryPassword,
      role: input.role,
      department: input.department
    }
  });

  if (error) {
    const message = await getFunctionErrorMessage(error);
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
}

async function getFunctionErrorMessage(error: unknown) {
  const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
  if (context?.json) {
    const body = await context.json().catch(() => null);
    if (body && typeof body === 'object' && 'error' in body) {
      const message = (body as { error?: unknown }).error;
      if (typeof message === 'string') return message;
    }
  }

  return error instanceof Error ? error.message : 'Unable to create user. Please try again.';
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
    .select('id, full_name, email, department, role')
    .single();

  if (error) throw error;
  return mapProfile(data as ProfileRow);
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

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    department: row.department,
    role: row.role
  };
}
