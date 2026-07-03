import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';

// SECURITY: requires a valid Bearer JWT. The previous email-based fallback
// allowed unauthenticated callers to enroll any known user into the waitlist
// simply by supplying their email — that fallback has been removed.
Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse('Unauthorized', 401);
    }
    const token = authHeader.replace('Bearer ', '');
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) return errorResponse('Unauthorized', 401);

    const user = {
      id: userData.user.id,
      email: userData.user.email ?? null,
      user_metadata: userData.user.user_metadata,
    };

    const body = await req.json().catch(() => ({} as any));
    const admin = createClient(supabaseUrl, serviceKey);

    // Length-limit user-supplied text.
    const full_name =
      (typeof body?.full_name === 'string' ? body.full_name.slice(0, 200) : null) ||
      (user.user_metadata?.full_name as string | undefined)?.slice(0, 200) ||
      null;
    const reason_for_joining =
      (typeof body?.reason_for_joining === 'string' ? body.reason_for_joining.slice(0, 2000) : null) ||
      (user.user_metadata?.reason_for_joining as string | undefined)?.slice(0, 2000) ||
      null;

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
