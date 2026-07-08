import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type CreateUserRequest = {
  full_name?: string;
  email?: string;
  temporary_password?: string;
  role?: string;
  department?: string;
};

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
  'Others'
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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

  const { data: callerProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError) {
    return jsonResponse({ error: profileError.message }, 500);
  }

  if (callerProfile?.role !== 'super_admin') {
    return jsonResponse({ error: 'Access denied.' }, 403);
  }

  const rateLimited = await checkRateLimit({
    supabase: supabaseAdmin,
    key: `admin-create-user:${authData.user.id}`,
    maxRequests: 10,
    windowSeconds: 300
  });

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
  const role = payload.role!;
  const department = payload.department!;

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
      : createError.message;
    return jsonResponse({ error: message }, 400);
  }

  const createdUser = createdUserData.user;
  if (!createdUser) {
    return jsonResponse({ error: 'Unable to create user.' }, 500);
  }

  const { error: profileInsertError } = await supabaseAdmin
    .from('profiles')
    .upsert(
      {
        id: createdUser.id,
        full_name: fullName,
        email,
        department,
        role
      },
      { onConflict: 'id' }
    );

  if (profileInsertError) {
    await supabaseAdmin.auth.admin.deleteUser(createdUser.id).catch(() => undefined);
    return jsonResponse({ error: profileInsertError.message }, 500);
  }

  return jsonResponse({
    success: true,
    user_id: createdUser.id,
    email
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
  if (!email.endsWith('@srec.ac.in')) return 'Use official college email ending with @srec.ac.in';
  if (!password) return 'Temporary password is required';
  if (password.length < 6) return 'Password must be at least 6 characters';
  if (!validRoles.includes(role)) return 'Please select a valid role';
  if (!validDepartments.includes(department)) return 'Please select a valid department';

  return '';
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
    throw error;
  }

  return !data;
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
