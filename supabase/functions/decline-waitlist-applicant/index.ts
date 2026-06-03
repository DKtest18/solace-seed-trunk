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
    const callerId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: roles } = await admin
      .from('dkai_user_roles')
      .select('role')
      .eq('user_id', callerId);
    if (!roles?.some((r: any) => r.role === 'admin')) {
      return errorResponse('Forbidden — admin only', 403);
    }

    const body = await req.json();
    const waitlist_id = body?.waitlist_id;
    const reason = String(body?.reason ?? '').trim().slice(0, 500);
    if (!waitlist_id || typeof waitlist_id !== 'string') {
      return errorResponse('waitlist_id is required', 400);
    }
    if (reason.length < 3) {
      return errorResponse('reason is required (min 3 chars)', 400);
    }

    const { data: row, error: rowErr } = await admin
      .from('dkai_waitlist')
      .select('id, user_id, email, full_name, status')
      .eq('id', waitlist_id)
      .maybeSingle();
    if (rowErr || !row) return errorResponse('Waitlist entry not found', 404);

    const { error: updErr } = await admin
      .from('dkai_waitlist')
      .update({
        status: 'declined',
        declined_reason: reason,
        reviewed_by: callerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', waitlist_id);
    if (updErr) return errorResponse(`Failed to update waitlist: ${updErr.message}`, 500);

    // Ensure profile stays inactive
    await admin.from('dkai_profiles').update({ is_active: false }).eq('id', row.user_id);

    try {
      const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify({
          type: 'waitlist_declined',
          recipientEmail: row.email,
          data: {
            name: row.full_name || row.email,
            reason,
          },
        }),
      });
      if (!emailRes.ok) {
        console.error('decline email non-2xx', emailRes.status, await emailRes.text().catch(() => ''));
      }
    } catch (e) {
      console.error('decline email failed', e);
    }

    return jsonResponse({ success: true });
  } catch (err: any) {
    console.error('decline-waitlist-applicant error', err);
    return errorResponse(err.message || 'Unexpected error', 500);
  }
});
