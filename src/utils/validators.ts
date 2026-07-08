export type ValidationErrors<T extends string> = Partial<Record<T, string>>;

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string) {
  if (!email.trim()) return 'Email is required.';
  if (!emailRegex.test(email.trim())) return 'Enter a valid email address.';
  return undefined;
}

export function validateLogin(values: { email: string; password: string }) {
  const errors: ValidationErrors<'email' | 'password'> = {};
  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;
  if (!values.password) errors.password = 'Password is required.';
  return errors;
}
