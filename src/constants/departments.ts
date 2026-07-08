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
  'Library',
  'Others'
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

export const VENUE_TYPE_OPTIONS = ['Seminar Hall', 'Lab', 'Auditorium'];

export function getVenueTypeOptions(department: string) {
  if (ACADEMIC_DEPARTMENTS.includes(department)) {
    return ['All', 'Seminar Hall', 'Lab'];
  }

  if (department === 'Library') {
    return ['All', 'Seminar Hall'];
  }

  if (department === 'Others') {
    return ['All', 'Auditorium'];
  }

  return ['All', 'Seminar Hall', 'Lab', 'Auditorium'];
}
