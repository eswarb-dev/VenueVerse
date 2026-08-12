import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type OnboardingRequest = {
  full_name?: string;
  department?: string;
  role?: string;
  email?: string;
  user_id?: string;
};

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
  'Library',
  'Others'
];

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('VENUEVERSE_ALLOWED_WEB_ORIGIN') ?? '',
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Supabase environment variables are missing.' }, 500);
  }

  const authorization = req.headers.get('Authorization') ?? '';
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false }
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ error: 'Unauthorized.' }, 401);

  const emailValidation = validateStaffEmail(userData.user.email);
  if (!emailValidation.ok) return jsonResponse({ error: emailValidation.error }, 403);

  const payload = (await req.json().catch(() => ({}))) as OnboardingRequest;
  if (payload.role || payload.email || payload.user_id) {
    return jsonResponse({ error: 'Unsupported onboarding payload.' }, 400);
  }

  const fullName = payload.full_name?.trim() ?? '';
  const department = payload.department?.trim() ?? '';
  if (fullName.length < 2) return jsonResponse({ error: 'Please enter your name.' }, 400);
  if (!validDepartments.includes(department)) return jsonResponse({ error: 'Please select your department.' }, 400);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .upsert({
      id: userData.user.id,
      email: emailValidation.email,
      full_name: fullName,
      department,
      role: 'user',
      auth_provider: 'google',
      is_staff_verified: true,
      onboarding_completed: true,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' })
    .select('id, email, full_name, department, role, auth_provider, is_staff_verified, onboarding_completed')
    .single();

  if (profileError) {
    console.warn('complete-google-staff-onboarding profile upsert failed:', profileError.message);
    return jsonResponse({ error: 'Couldn’t create your account. Please try again.' }, 500);
  }

  return jsonResponse({ profile });
});

function validateStaffEmail(email?: string | null): { ok: true; email: string } | { ok: false; error: string } {
  const normalized = (email ?? '').trim().toLowerCase();
  if (!normalized.endsWith('@srec.ac.in')) return { ok: false, error: 'Use Institutional Email.' };

  const localPart = normalized.split('@')[0] ?? '';
  if (/\d/.test(localPart)) return { ok: false, error: "Students don’t have access to this app." };
  if (!/^[a-z]+(\.[a-z]+)*$/.test(localPart)) return { ok: false, error: 'Use Institutional Email.' };

  return { ok: true, email: normalized };
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
