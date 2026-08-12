import { VENUE_TYPES } from '@/constants/venueTypes';

export const DEPARTMENT_OPTIONS = [
  'IT',
  'AI&DS',
  'EEE',
  'ECE',
  'BME',
  'CSE',
  'CIVIL',
  'AERO',
  'MBA',
  'NANO',
  'MECH',
  'EIE',
  'R & A',
  'MTech CSE',
  'Library',
  'Administration'
];

export const REGISTRATION_DEPARTMENT_OPTIONS = DEPARTMENT_OPTIONS;

export const ACADEMIC_DEPARTMENTS = [
  'IT',
  'AI&DS',
  'EEE',
  'ECE',
  'BME',
  'CSE',
  'CIVIL',
  'AERO',
  'MBA',
  'NANO',
  'MECH',
  'EIE'
];

export const VENUE_TYPE_OPTIONS = [...VENUE_TYPES];

export function getVenueTypeOptions(department: string) {
  return ['All', ...VENUE_TYPES];
}

export { normalizeVenueType, VENUE_TYPES } from '@/constants/venueTypes';
