export const VENUE_TYPES = [
  'Seminar Hall',
  'Open Hall',
  'Meeting Hall',
  'Auditorium',
  'BYOD Lab',
  'Computer Lab',
  'Dining Hall'
] as const;

export type VenueType = typeof VENUE_TYPES[number];

const normalizedMap: Record<string, string> = {
  Lab: 'BYOD Lab',
  Labs: 'BYOD Lab',
  'BYOD Labs': 'BYOD Lab',
  'Byod Lab': 'BYOD Lab',
  'Byod Labs': 'BYOD Lab',
  'Computer Labs': 'Computer Lab',
  'Computer Laboratory': 'Computer Lab',
  'Comp Lab': 'Computer Lab',
  'Dinning Hall': 'Dining Hall',
  Dining: 'Dining Hall'
};

export function normalizeVenueType(value?: string | null): string {
  if (!value) return '';

  const trimmed = value.trim();
  return normalizedMap[trimmed] ?? trimmed;
}
