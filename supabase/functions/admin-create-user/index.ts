import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type CreateUserRequest = {
  full_name?: string;
  email?: string;
  temporary_password?: string;
  role?: string;
  department?: string;
};

const SUPER_ADMIN_EMAIL = 'venueverse.srec@gmail.com';
const validRoles = ['user', 'admin', 'super_admin'];
const validDepartments = [
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
  'CDPD',
  'Library',
  'Administrative Office',
  'Others'
];

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('VENUEVERSE_ALLOWED_WEB_ORIGIN') || '*',
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Supabase environment variables are missing.' }, 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });

  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(jwt);

  if (authError || !authData.user) {
    return jsonResponse({ error: 'Unauthorized.' }, 401);
  }

  const { data: callerProfileById, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, department')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError) {
    console.warn('admin-create-user profile lookup failed:', profileError.message);
    return jsonResponse({ error: 'Unable to verify admin permissions.' }, 500);
  }

  let callerProfile = callerProfileById;

  if (!callerProfile && authData.user.email) {
    const normalizedEmail = authData.user.email.trim().toLowerCase();
    const { data: callerProfileByEmail, error: profileEmailError } = await supabaseAdmin
      .from('profiles')
      .select('role, department')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (profileEmailError) {
      console.warn('admin-create-user email profile lookup failed:', profileEmailError.message);
      return jsonResponse({ error: 'Unable to verify admin permissions.' }, 500);
    }

    if (callerProfileByEmail) {
      callerProfile = callerProfileByEmail;
    }
  }

  if (!callerProfile && authData.user.email?.trim().toLowerCase() === SUPER_ADMIN_EMAIL) {
    callerProfile = { role: 'super_admin', department: '' };
  }

  if (!callerProfile || (callerProfile.role !== 'admin' && callerProfile.role !== 'super_admin')) {
    return jsonResponse({ error: 'Only admins can create users.' }, 403);
  }

  if (callerProfile.role === 'admin' && !callerProfile.department) {
    return jsonResponse({ error: 'Admin department is not assigned.' }, 403);
  }

  const { limited: rateLimited, error: rateLimitError } = await checkRateLimit({
    supabase: supabaseAdmin,
    key: `admin-create-user:${authData.user.id}`,
    maxRequests: 10,
    windowSeconds: 300
  });

  if (rateLimitError) {
    console.warn('admin-create-user rate limiter unavailable:', rateLimitError);
    return jsonResponse({ error: 'Rate limiter unavailable.' }, 500);
  }

  if (rateLimited) {
    return jsonResponse({ error: 'Rate limit exceeded. Please try again later.' }, 429);
  }

  const payload = (await req.json().catch(() => ({}))) as CreateUserRequest;
  const validationError = validatePayload(payload);
  if (validationError) {
    return jsonResponse({ error: validationError }, 400);
  }

  const fullName = payload.full_name!.trim();
  const email = payload.email!.trim().toLowerCase();
  const temporaryPassword = payload.temporary_password!;
  if (callerProfile.role === 'admin' && payload.department && payload.department !== callerProfile.department) {
    return jsonResponse({ error: 'Department admins can create users only in their own department.' }, 403);
  }

  const role = callerProfile.role === 'super_admin' ? payload.role || 'user' : 'user';
  const department = callerProfile.role === 'super_admin' ? payload.department!.trim() : callerProfile.department;

  if (callerProfile.role !== 'super_admin' && role !== 'user') {
    return jsonResponse({ error: 'Department admins can create only users.' }, 403);
  }

  if (role === 'super_admin' && email !== SUPER_ADMIN_EMAIL) {
    return jsonResponse({ error: 'Only venueverse.srec@gmail.com can be Super Admin.' }, 403);
  }

  const { data: createdUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      department,
      role
    }
  });

  if (createError) {
    const message = createError.message.toLowerCase().includes('already')
      ? 'User already exists with this email.'
      : 'Unable to create user.';
    if (!createError.message.toLowerCase().includes('already')) {
      console.warn('admin-create-user createUser failed:', createError.message);
    }
    return jsonResponse({ error: message }, 400);
  }

  const createdUser = createdUserData.user;
  if (!createdUser) {
    return jsonResponse({ error: 'Unable to create user.' }, 500);
  }

  const { error: profileInsertError } = await supabaseAdmin.rpc('admin_finalize_created_user_profile', {
    p_user_id: createdUser.id,
    p_full_name: fullName,
    p_email: email,
    p_department: department,
    p_role: role
  });

  if (profileInsertError) {
    await supabaseAdmin.auth.admin.deleteUser(createdUser.id).catch(() => undefined);
    console.warn('admin-create-user profile finalize failed:', sanitizeError(profileInsertError.message));
    return jsonResponse({ error: 'Unable to create user profile.' }, 500);
  }

  await supabaseAdmin.from('notifications').insert({
    user_id: createdUser.id,
    title: 'VenueVerse account created',
    message: 'Your VenueVerse account has been created.',
    type: 'account_created',
    data: {
      type: 'account_created',
      role,
      department
    },
    is_read: false
  }).catch((notificationError) => {
    console.warn('admin-create-user notification insert failed:', sanitizeError(notificationError.message));
  });

  return jsonResponse({
    success: true,
    message: 'User created successfully.',
    user: {
      id: createdUser.id,
      email,
      full_name: fullName,
      department,
      role
    }
  });
});

function validatePayload(payload: CreateUserRequest) {
  const fullName = payload.full_name?.trim() ?? '';
  const email = payload.email?.trim().toLowerCase() ?? '';
  const password = payload.temporary_password ?? '';
  const role = payload.role ?? '';
  const department = payload.department ?? '';

  if (!fullName) return 'Full name is required';
  if (!email) return 'College email is required';
  if (!isAllowedAccountEmail(email)) return 'Use official college email ending with @srec.ac.in';
  if (!password) return 'Temporary password is required';
  if (password.length < 6) return 'Password must be at least 6 characters';
  if (role && !validRoles.includes(role)) return 'Invalid role. Allowed roles are user, admin, and super_admin.';
  if (role === 'super_admin' && email !== SUPER_ADMIN_EMAIL) return 'Only venueverse.srec@gmail.com can be Super Admin.';
  if (!department) return 'Please select a department';
  if (!validDepartments.includes(department)) return 'Please select a valid department';

  return '';
}

function isAllowedAccountEmail(email: string) {
  return email.endsWith('@srec.ac.in') || email === SUPER_ADMIN_EMAIL;
}

async function checkRateLimit({
  supabase,
  key,
  maxRequests,
  windowSeconds
}: {
  supabase: ReturnType<typeof createClient>;
  key: string;
  maxRequests: number;
  windowSeconds: number;
}) {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    rate_key: key,
    max_requests: maxRequests,
    window_seconds: windowSeconds
  });

  if (error) {
    return { limited: false, error: error.message };
  }

  return { limited: !data, error: '' };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

function sanitizeError(value: string | null | undefined) {
  return (value ?? 'Unknown error').replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]');
}
