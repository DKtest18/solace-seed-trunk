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

    // Identify caller from JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) return errorResponse('Unauthorized', 401);
    const callerId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify admin role
    const { data: roles } = await admin
      .from('dkai_user_roles')
      .select('role')
      .eq('user_id', callerId);
    if (!roles?.some((r: any) => r.role === 'admin')) {
      return errorResponse('Forbidden — admin only', 403);
    }

    const { waitlist_id } = await req.json();
    if (!waitlist_id || typeof waitlist_id !== 'string') {
      return errorResponse('waitlist_id is required', 400);
    }

    // Load applicant
    const { data: row, error: rowErr } = await admin
      .from('dkai_waitlist')
      .select('id, user_id, email, full_name, status')
      .eq('id', waitlist_id)
      .maybeSingle();
    if (rowErr || !row) return errorResponse('Waitlist entry not found', 404);
    if (row.status === 'approved') return jsonResponse({ success: true, alreadyApproved: true });

    // Update waitlist row
    const { error: updErr } = await admin
      .from('dkai_waitlist')
      .update({
        status: 'approved',
        reviewed_by: callerId,
        reviewed_at: new Date().toISOString(),
        declined_reason: null,
      })
      .eq('id', waitlist_id);
    if (updErr) return errorResponse(`Failed to update waitlist: ${updErr.message}`, 500);

    // Activate profile
    const { error: profErr } = await admin
      .from('dkai_profiles')
      .update({ is_active: true })
      .eq('id', row.user_id);
    if (profErr) console.error('profile activate error', profErr);

    // Send approval email (best-effort)
    try {
      await admin.functions.invoke('send-notification-email', {
        body: {
          type: 'waitlist_approved',
          recipientEmail: row.email,
          data: {
            name: row.full_name || row.email,
            actionUrl: 'https://dkaimarketplace.com',
          },
        },
      });
    } catch (e) {
      console.error('approval email failed', e);
    }

    return jsonResponse({ success: true });
  } catch (err: any) {
    console.error('approve-waitlist-applicant error', err);
    return errorResponse(err.message || 'Unexpected error', 500);
  }
});
