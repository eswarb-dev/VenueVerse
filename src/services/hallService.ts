import { supabase } from '@/lib/supabase';
import { Hall, HallFormInput } from '@/types/venue';

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
};

export async function getActiveHalls(): Promise<Hall[]> {
  const { data, error } = await supabase
    .from('halls')
    .select('id, name, department, venue_type, location, block, floor, capacity, facilities, image_url, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapHall);
}

export async function getAllHalls(): Promise<Hall[]> {
  const { data, error } = await supabase
    .from('halls')
    .select('id, name, department, venue_type, location, block, floor, capacity, facilities, image_url, is_active')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapHall);
}

export async function getHallById(id: string): Promise<Hall | null> {
  const { data, error } = await supabase
    .from('halls')
    .select('id, name, department, venue_type, location, block, floor, capacity, facilities, image_url, is_active')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? mapHall(data as HallRow) : null;
}

export async function createHall(input: HallFormInput): Promise<void> {
  const { error } = await supabase.from('halls').insert({
    name: input.name.trim(),
    department: input.department.trim() || null,
    venue_type: input.venueType.trim() || null,
    location: input.location.trim(),
    block: input.block.trim(),
    floor: input.floor.trim() || null,
    capacity: input.capacity,
    facilities: input.facilities,
    image_url: input.imageUrl,
    is_active: input.isActive
  });

  if (error) throw error;
}

export async function updateHall(id: string, input: HallFormInput): Promise<void> {
  const { error } = await supabase
    .from('halls')
    .update({
      name: input.name.trim(),
      department: input.department.trim() || null,
      venue_type: input.venueType.trim() || null,
      location: input.location.trim(),
      block: input.block.trim(),
      floor: input.floor.trim() || null,
      capacity: input.capacity,
      facilities: input.facilities,
      image_url: input.imageUrl,
      is_active: input.isActive
    })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteHall(id: string): Promise<void> {
  const { error } = await supabase.from('halls').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadHallImage(uri: string, fileName: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const extension = fileName.split('.').pop() || 'jpg';
  const path = `halls/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

  const { error } = await supabase.storage.from('hall-images').upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
    upsert: false
  });

  if (error) throw error;

  const { data } = supabase.storage.from('hall-images').getPublicUrl(path);
  return data.publicUrl;
}

function mapHall(row: HallRow): Hall {
  return {
    id: row.id,
    name: row.name,
    department: row.department,
    venueType: row.venue_type,
    location: row.location,
    block: row.block,
    floor: row.floor,
    capacity: row.capacity,
    facilities: row.facilities ?? [],
    imageUrl: row.image_url,
    isActive: row.is_active ?? false
  };
}
