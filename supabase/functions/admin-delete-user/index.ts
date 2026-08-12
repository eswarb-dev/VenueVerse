import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type DeleteUserRequest = {
  user_id?: string;
  confirm_self_delete?: boolean;
};

type ProfileRow = {
  id: string;
  email: string;
  department: string | null;
  role: 'user' | 'admin' | 'super_admin';
};

const SUPER_ADMIN_EMAIL = 'venueverse.srec@gmail.com';
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('VENUEVERSE_ALLOWED_WEB_ORIGIN') ?? '',
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Supabase environment variables are missing.' }, 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
    const { data: authData, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !authData.user) return jsonResponse({ error: 'Unauthorized.' }, 401);

    const payload = (await req.json().catch(() => ({}))) as DeleteUserRequest;
    const targetUserId = payload.user_id?.trim();
    if (!targetUserId) return jsonResponse({ error: 'user_id is required.' }, 400);

    const [caller, target] = await Promise.all([
      fetchProfile(supabase, authData.user.id),
      fetchProfile(supabase, targetUserId)
    ]);
    if (!caller) return jsonResponse({ error: 'Caller profile not found.' }, 403);
    if (!target) return jsonResponse({ error: 'Target user not found.' }, 404);

    const validation = validateDelete({ caller, target, confirmSelfDelete: Boolean(payload.confirm_self_delete) });
    if (validation) return jsonResponse({ error: validation }, 403);

    if (!isCanonicalSuperAdmin(caller)) {
      const { data: unlinkedProfile, error: unlinkError } = await supabase
        .from('profiles')
        .update({
          department: null,
          role: 'user'
        })
        .eq('id', target.id)
        .eq('department', caller.department)
        .select('id, department, role')
        .maybeSingle();

      if (unlinkError) return jsonResponse({ error: sanitizeError(unlinkError.message) }, 400);
      if (!unlinkedProfile) return jsonResponse({ error: 'User was not removed from the department.' }, 400);

      return jsonResponse({ success: true, action: 'department_removed' });
    }

    const { error: prepareDeleteError } = await supabase.rpc('admin_prepare_user_delete', {
      p_target_user_id: target.id
    });
    if (prepareDeleteError) return jsonResponse({ error: sanitizeError(prepareDeleteError.message) }, 400);

    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(target.id);
    if (deleteAuthError) return jsonResponse({ error: sanitizeError(deleteAuthError.message) }, 400);

    return jsonResponse({ success: true, action: 'account_deleted' });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? sanitizeError(error.message) : 'Unable to remove user.' }, 500);
  }
});

function validateDelete(params: { caller: ProfileRow; target: ProfileRow; confirmSelfDelete: boolean }) {
  if (params.target.id === params.caller.id) {
    return 'You cannot remove your own account from user management.';
  }
  if (params.target.role === 'super_admin') return 'Super Admin accounts cannot be removed from user management.';
  if (isCanonicalSuperAdmin(params.caller)) return '';
  if (params.caller.role !== 'admin') return 'Only admins can remove users.';
  if (!params.caller.department) return 'Admin department is not assigned.';
  if (params.target.department !== params.caller.department) return 'Department admins can remove only users from their own department.';
  return '';
}

function isCanonicalSuperAdmin(profile: ProfileRow) {
  return profile.role === 'super_admin' && profile.email.toLowerCase() === SUPER_ADMIN_EMAIL;
}

async function fetchProfile(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, department, role')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as ProfileRow | null;
}

function sanitizeError(value: string) {
  return value.replace(/password|secret|token|apikey/gi, '[redacted]').slice(0, 500);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
