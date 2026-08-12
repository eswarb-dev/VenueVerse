import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import { normalizeVenueType } from '@/constants/venueTypes';
import { Hall, HallFormInput } from '@/types/venue';
import { createNotification } from '@/services/notificationService';
import { clearCachedValue, measureAsync, withCache } from '@/utils/performanceCache';

type HallRow = {
  id: string;
  name: string;
  department: string | null;
  venue_type: string | null;
  location: string | null;
  block: string | null;
  floor: string | null;
  capacity: number;
  facilities: string[] | null;
  image_url: string | null;
  is_active: boolean | null;
  inactive_reason: string | null;
  deactivated_at: string | null;
  deactivated_by: string | null;
  reactivated_at: string | null;
  reactivated_by: string | null;
};

type HallUpdateAudit = {
  inactiveReason?: string;
  deactivatedBy?: string;
  reactivatedBy?: string;
};

const HALL_CACHE_TTL_MS = 60_000;
const HALL_SELECT = 'id, name, department, venue_type, location, block, floor, capacity, facilities, image_url, is_active, inactive_reason, deactivated_at, deactivated_by, reactivated_at, reactivated_by';

export async function getActiveHalls(options?: { forceRefresh?: boolean }): Promise<Hall[]> {
  return withCache('halls:active', HALL_CACHE_TTL_MS, () => measureAsync('hallService.getActiveHalls', loadActiveHalls), options?.forceRefresh);
}

async function loadActiveHalls(): Promise<Hall[]> {
  const { data, error } = await supabase
    .from('halls')
    .select(HALL_SELECT)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapHall);
}

export async function getAllHalls(options?: { forceRefresh?: boolean }): Promise<Hall[]> {
  return withCache('halls:all', HALL_CACHE_TTL_MS, () => measureAsync('hallService.getAllHalls', loadAllHalls), options?.forceRefresh);
}

async function loadAllHalls(): Promise<Hall[]> {
  const { data, error } = await supabase
    .from('halls')
    .select(HALL_SELECT)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapHall);
}

export async function getHallsByDepartment(department: string, options?: { activeOnly?: boolean; forceRefresh?: boolean }): Promise<Hall[]> {
  const activeOnly = options?.activeOnly ?? false;
  const cacheKey = `halls:department:${department}:${activeOnly ? 'active' : 'all'}`;
  return withCache(cacheKey, HALL_CACHE_TTL_MS, () => measureAsync('hallService.getHallsByDepartment', () => loadHallsByDepartment(department, activeOnly)), options?.forceRefresh);
}

async function loadHallsByDepartment(department: string, activeOnly: boolean): Promise<Hall[]> {
  let query = supabase
    .from('halls')
    .select(HALL_SELECT)
    .eq('department', department)
    .order('name', { ascending: true });

  if (activeOnly) query = query.eq('is_active', true);

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []).map(mapHall);
}

export async function getActiveHallsByDepartment(department: string, options?: { forceRefresh?: boolean }): Promise<Hall[]> {
  return getHallsByDepartment(department, { activeOnly: true, forceRefresh: options?.forceRefresh });
}

export async function getActiveHallDepartments(): Promise<string[]> {
  const { data, error } = await supabase
    .from('halls')
    .select('department')
    .eq('is_active', true);

  if (error) throw error;
  return Array.from(new Set((data ?? []).map((row) => row.department).filter(Boolean) as string[])).sort();
}

export async function getHallById(id: string): Promise<Hall | null> {
  const { data, error } = await supabase
    .from('halls')
    .select(HALL_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapHall(data as HallRow) : null;
}

export async function createHall(input: HallFormInput): Promise<void> {
  const { error } = await supabase.from('halls').insert({
    name: input.name.trim(),
    department: input.department.trim() || null,
    venue_type: normalizeVenueType(input.venueType) || null,
    location: input.location.trim(),
    block: input.block.trim(),
    floor: input.floor.trim() || null,
    capacity: input.capacity,
    facilities: input.facilities,
    image_url: input.imageUrl,
    is_active: input.isActive
  });

  if (error) throw error;
  clearCachedValue('halls:');
}

export async function createHallForDepartment(input: HallFormInput, department: string): Promise<void> {
  await createHall({ ...input, department });
}

export async function updateHall(id: string, input: HallFormInput, audit?: HallUpdateAudit): Promise<void> {
  const previousHall = await getHallById(id).catch(() => null);
  const { error } = await supabase
    .from('halls')
    .update(buildHallUpdatePayload(input, audit, true))
    .eq('id', id);

  if (error) throw error;
  await notifyHallActiveStatusChange(previousHall, input, audit).catch(() => undefined);
  clearCachedValue('halls:');
}

export async function updateHallForDepartment(id: string, input: HallFormInput, department: string, audit?: HallUpdateAudit): Promise<void> {
  const previousHall = await getHallById(id).catch(() => null);
  const { error } = await supabase
    .from('halls')
    .update(buildHallUpdatePayload(input, audit, false))
    .eq('id', id)
    .eq('department', department);

  if (error) throw error;
  await notifyHallActiveStatusChange(previousHall, { ...input, department }, audit).catch(() => undefined);
  clearCachedValue('halls:');
}

async function notifyHallActiveStatusChange(previousHall: Hall | null, nextHall: HallFormInput, audit?: HallUpdateAudit) {
  if (!previousHall || previousHall.isActive === nextHall.isActive) return;
  const department = nextHall.department || previousHall.department;
  if (!department) return;

  const { data: admins, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .eq('department', department);

  if (error) throw error;

  const type = nextHall.isActive ? 'venue_reactivated' : 'venue_inactivated';
  const title = nextHall.isActive ? 'Venue available' : 'Venue unavailable';
  const reason = audit?.inactiveReason?.trim();
  const message = nextHall.isActive
    ? `${nextHall.name} has been reactivated.`
    : `${nextHall.name} has been marked inactive.${reason ? ` Reason: ${reason}` : ''}`;

  await Promise.all(
    (admins ?? []).map((admin) =>
      createNotification({
        userId: admin.id,
        title,
        message,
        type,
        data: {
          venue_name: nextHall.name,
          department,
          reason: reason ?? ''
        }
      }).catch(() => undefined)
    )
  );
}

function buildHallUpdatePayload(input: HallFormInput, audit: HallUpdateAudit | undefined, includeDepartmentFields: boolean) {
  const payload: Record<string, string | number | string[] | boolean | null> = {
      name: input.name.trim(),
      venue_type: normalizeVenueType(input.venueType) || null,
      location: input.location.trim(),
      block: input.block.trim(),
      floor: input.floor.trim() || null,
      capacity: input.capacity,
      facilities: input.facilities,
      image_url: input.imageUrl,
      is_active: input.isActive
  };

  if (includeDepartmentFields) {
    payload.department = input.department.trim() || null;
  }

  if (audit?.inactiveReason && audit.deactivatedBy) {
    payload.inactive_reason = audit.inactiveReason.trim();
    payload.deactivated_at = new Date().toISOString();
    payload.deactivated_by = audit.deactivatedBy;
  }

  if (audit?.reactivatedBy) {
    payload.reactivated_at = new Date().toISOString();
    payload.reactivated_by = audit.reactivatedBy;
  }

  return payload;
}

export async function deleteHallForDepartment(id: string, department: string): Promise<void> {
  const { error } = await supabase.from('halls').delete().eq('id', id).eq('department', department);
  if (error) throw error;
  clearCachedValue('halls:');
}

export async function deleteHall(id: string): Promise<void> {
  const { error } = await supabase.from('halls').delete().eq('id', id);
  if (error) throw error;
  clearCachedValue('halls:');
}

export async function uploadHallImage(uri: string, fileName?: string | null, mimeType?: string | null): Promise<string> {
  const extension = getImageExtension(fileName, mimeType);
  const path = `halls/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const contentType = getImageContentType(extension, mimeType);
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64
  });
  const fileBytes = decode(base64);

  const { error } = await supabase.storage.from('hall-images').upload(path, fileBytes, {
    contentType,
    upsert: false
  });

  if (error) {
    if (__DEV__) {
      console.log('[hall-image-upload]', {
        bucket: 'hall-images',
        path,
        mimeType: contentType,
        errorMessage: error.message
      });
    }
    throw error;
  }

  const { data } = supabase.storage.from('hall-images').getPublicUrl(path);
  return data.publicUrl;
}

function getImageExtension(fileName?: string | null, mimeType?: string | null) {
  const mimeExtension = mimeType?.split('/')[1]?.replace('jpeg', 'jpg');
  const nameExtension = fileName?.split('.').pop()?.toLowerCase();
  const extension = mimeExtension || nameExtension || 'jpg';
  return ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(extension) ? extension.replace('jpeg', 'jpg') : 'jpg';
}

function getImageContentType(extension: string, mimeType?: string | null) {
  if (mimeType?.startsWith('image/')) return mimeType;
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'heic') return 'image/heic';
  return 'image/jpeg';
}

function mapHall(row: HallRow): Hall {
  return {
    id: row.id,
    name: row.name,
    department: row.department,
    venueType: normalizeVenueType(row.venue_type) || null,
    location: row.location,
    block: row.block,
    floor: row.floor,
    capacity: row.capacity,
    facilities: row.facilities ?? [],
    imageUrl: row.image_url,
    isActive: row.is_active ?? false,
    inactiveReason: row.inactive_reason,
    deactivatedAt: row.deactivated_at,
    deactivatedBy: row.deactivated_by,
    reactivatedAt: row.reactivated_at,
    reactivatedBy: row.reactivated_by
  };
}
