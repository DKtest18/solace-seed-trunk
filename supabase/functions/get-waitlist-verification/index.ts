import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return errorResponse('Unauthorized', 401);
    const token = authHeader.replace('Bearer ', '');

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) return errorResponse('Unauthorized', 401);

    const admin = createClient(supabaseUrl, serviceKey);

    // Admin-only
    const { data: roles } = await admin
      .from('dkai_user_roles')
      .select('role')
      .eq('user_id', userData.user.id);
    if (!roles?.some((r: any) => r.role === 'admin')) {
      return errorResponse('Forbidden — admin only', 403);
    }

    const { user_ids } = await req.json();
    if (!Array.isArray(user_ids)) return errorResponse('user_ids array required', 400);
    if (user_ids.length === 0) return jsonResponse({ verification: {} });

    // Fetch each user via admin API (no batch endpoint for arbitrary ids)
    const entries = await Promise.all(
      user_ids.map(async (id: string) => {
        try {
          const { data } = await admin.auth.admin.getUserById(id);
          return [id, { email_confirmed_at: data?.user?.email_confirmed_at || null }];
        } catch {
          return [id, { email_confirmed_at: null }];
        }
      })
    );

    return jsonResponse({ verification: Object.fromEntries(entries) });
  } catch (err: any) {
    console.error('get-waitlist-verification error', err);
    return errorResponse(err.message || 'Unexpected error', 500);
  }
});
