export function normalizeEmail(email?: string | null): string {
  return (email ?? '').trim().toLowerCase();
}

export function isInstitutionalEmail(email?: string | null): boolean {
  return normalizeEmail(email).endsWith('@srec.ac.in');
}

export function isStudentEmail(email?: string | null): boolean {
  const localPart = normalizeEmail(email).split('@')[0] ?? '';
  return /\d/.test(localPart);
}

export function isStaffEmail(email?: string | null): boolean {
  const normalized = normalizeEmail(email);
  if (!isInstitutionalEmail(normalized)) return false;
  if (isStudentEmail(normalized)) return false;

  const localPart = normalized.split('@')[0] ?? '';
  return /^[a-z]+(\.[a-z]+)*$/.test(localPart);
}

export function getGoogleAccessError(email?: string | null): string | null {
  const normalized = normalizeEmail(email);
  if (!normalized || !isInstitutionalEmail(normalized)) return 'Use Institutional Email.';
  if (isStudentEmail(normalized)) return "Students don’t have access to this app.";
  if (!isStaffEmail(normalized)) return 'Use Institutional Email.';
  return null;
}
