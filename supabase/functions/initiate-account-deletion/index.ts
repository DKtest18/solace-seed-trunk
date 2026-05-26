import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient, getSupabaseClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    const { user, error } = await getAuthenticatedUser(req);
    if (!user) return errorResponse(error || 'Unauthorized', 401);

    const body = await req.json().catch(() => ({}));
    const password: string | undefined = body?.password;
    const confirmation: string | undefined = body?.confirmation;

    if (confirmation !== 'DELETE') return errorResponse('Confirmation required', 400);
    if (!password) return errorResponse('Password required', 400);

    // Verify password by re-authenticating
    const authHeader = req.headers.get('Authorization')!;
    const userClient = getSupabaseClient(authHeader);
    const { error: signinErr } = await userClient.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (signinErr) return errorResponse('Invalid password', 401);

    const svc = getServiceClient();

    const scheduled = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Upsert deletion request
    const { error: insErr } = await svc
      .from('dkai_deletion_requests')
      .upsert({
        user_id: user.id,
        requested_at: new Date().toISOString(),
        scheduled_deletion_at: scheduled.toISOString(),
        status: 'pending',
        cancelled_at: null,
        cancellation_reason: null,
      }, { onConflict: 'user_id' });
    if (insErr) return errorResponse(`Failed: ${insErr.message}`, 500);

    // Soft-disable profile
    await svc.from('dkai_profiles').update({ is_active: false }).eq('id', user.id);

    // Notify
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'account_deletion_initiated',
        recipientEmail: user.email,
        data: { scheduledDate: scheduled.toLocaleDateString('en-US') },
      }),
    }).catch(() => {});

    return jsonResponse({ success: true, scheduledDeletionAt: scheduled.toISOString() });
  } catch (e: any) {
    return errorResponse(e?.message || 'Initiation failed', 500);
  }
});
