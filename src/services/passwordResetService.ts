import { supabase } from '@/lib/supabase';

export const PASSWORD_RESET_OTP_EXPIRY_SECONDS = 300;
export const PASSWORD_RESET_COOLDOWN_SECONDS = 60;

export async function sendPasswordResetOtp(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail);

  if (error) {
    logSupabaseError('resetPasswordForEmail', error);
    throw new Error(getPasswordResetSendErrorMessage(error.message));
  }
}

export async function verifyPasswordResetOtp(email: string, otp: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: otp.trim(),
    type: 'recovery'
  });

  if (error) {
    logSupabaseError('verifyOtp recovery', error);
    throw new Error('Invalid or expired code.');
  }
}

export async function updateRecoveredPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password
  });

  if (error) {
    logSupabaseError('updateUser password', error);
    throw new Error(getPasswordUpdateErrorMessage(error.message));
  }
}

export async function clearRecoverySession(): Promise<void> {
  await supabase.auth.signOut().catch(() => undefined);
}

function logSupabaseError(label: string, error: unknown) {
  const maybeError = error as { message?: string; status?: number };
  console.warn(`${label} failed:`, {
    message: maybeError.message,
    status: maybeError.status
  });
}

function getPasswordResetSendErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('rate limit') ||
    normalized.includes('rate_limit') ||
    normalized.includes('over_email_send_rate_limit') ||
    normalized.includes('email rate limit exceeded')
  ) {
    return 'Too many reset requests. Please wait before trying again.';
  }

  if (
    normalized.includes('smtp') ||
    normalized.includes('email provider') ||
    normalized.includes('failed to send') ||
    normalized.includes('error sending') ||
    normalized.includes('send email')
  ) {
    return 'Could not send reset code. Please check SMTP settings or try again later.';
  }

  if (
    normalized.includes('user not found') ||
    normalized.includes('not found') ||
    normalized.includes('no user') ||
    normalized.includes('does not exist')
  ) {
    return 'If an account exists, a reset code has been sent.';
  }

  return 'Could not send reset code. Please try again.';
}

function getPasswordUpdateErrorMessage(message: string) {
  if (message.toLowerCase().includes('password')) {
    return 'Password must be at least 6 characters.';
  }

  return 'Could not update password. Please try again.';
}
