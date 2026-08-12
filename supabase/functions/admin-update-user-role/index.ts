import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type UserRole = 'user' | 'admin' | 'super_admin';

type UpdateRoleRequest = {
  target_user_id?: string;
  new_role?: UserRole;
  reason?: string;
  user_id?: string;
  role?: UserRole;
  department?: string | null;
};

type CallerProfileRow = {
  id: string;
  role: UserRole;
};

type RoleUpdateResult = {
  success?: boolean;
  target_user_id?: string;
  old_role?: UserRole;
  new_role?: UserRole;
  department?: string | null;
};

const validRoles: UserRole[] = ['user', 'admin', 'super_admin'];
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

    const payload = (await req.json().catch(() => ({}))) as UpdateRoleRequest;
    const targetUserId = (payload.target_user_id ?? payload.user_id)?.trim();
    const newRole = payload.new_role ?? payload.role;
    if (!targetUserId || !newRole || !validRoles.includes(newRole)) {
      return jsonResponse({ error: 'Valid target_user_id and new_role are required.' }, 400);
    }

    const { data: caller, error: callerError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (callerError) throw callerError;
    if (!caller) return jsonResponse({ error: 'Caller profile not found.' }, 403);

    console.log('[role-update] actor id', authData.user.id);
    console.log('[role-update] actor role', (caller as CallerProfileRow).role);
    console.log('[role-update] target id', targetUserId);
    console.log('[role-update] requested role', newRole);

    const { data: result, error: rpcError } = await supabase.rpc('admin_apply_role_change', {
      p_actor_user_id: authData.user.id,
      p_target_user_id: targetUserId,
      p_new_role: newRole,
      p_department: payload.department === undefined ? null : payload.department
    });

    if (rpcError) {
      console.error('[role-update] rpc failed', { message: sanitizeError(rpcError.message) });
      return jsonResponse({ error: sanitizeError(rpcError.message) }, 400);
    }

    const response = (result ?? { success: true, target_user_id: targetUserId, new_role: newRole }) as RoleUpdateResult;
    console.log('[role-update] rpc success', {
      target_user_id: response.target_user_id ?? targetUserId,
      old_role: response.old_role,
      new_role: response.new_role ?? newRole
    });

    return jsonResponse(response);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? sanitizeError(error.message) : 'Unable to update user role.' }, 500);
  }
});

function sanitizeError(value: string) {
  return value.replace(/password|secret|token|apikey/gi, '[redacted]').slice(0, 500);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
