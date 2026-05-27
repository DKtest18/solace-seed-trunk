import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const body = await req.json().catch(() => ({} as any));
    const admin = createClient(supabaseUrl, serviceKey);

    // Try to resolve user via session token first
    let user: { id: string; email: string | null; user_metadata?: any } | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData } = await userClient.auth.getUser(token);
      if (userData?.user) {
        user = { id: userData.user.id, email: userData.user.email ?? null, user_metadata: userData.user.user_metadata };
      }
    }

    // Fallback: email confirmation enabled -> no session yet at signup time.
    // Look the just-created user up by email via service role.
    if (!user && body?.email) {
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = list?.users?.find((u: any) => (u.email || '').toLowerCase() === String(body.email).toLowerCase());
      if (found) {
        user = { id: found.id, email: found.email ?? null, user_metadata: found.user_metadata };
      }
    }

    if (!user) return errorResponse('Unauthorized', 401);

    const full_name = (body?.full_name as string | undefined) || (user.user_metadata?.full_name as string | undefined) || null;
    const reason_for_joining = (body?.reason_for_joining as string | undefined) || (user.user_metadata?.reason_for_joining as string | undefined) || null;

    const { data: existing } = await admin
      .from('dkai_waitlist')
      .select('id, status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      return jsonResponse({ success: true, alreadyOnWaitlist: true, id: existing.id });
    }

    const { data: inserted, error: insErr } = await admin
      .from('dkai_waitlist')
      .insert({
        user_id: user.id,
        email: user.email,
        full_name,
        reason_for_joining,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insErr) return errorResponse(`Failed to join waitlist: ${insErr.message}`, 500);
    return jsonResponse({ success: true, id: inserted.id });

  } catch (err: any) {
    console.error('join-waitlist error', err);
    return errorResponse(err.message || 'Unexpected error', 500);
  }
});
