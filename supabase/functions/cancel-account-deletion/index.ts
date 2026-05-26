import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  try {
    const { user, error } = await getAuthenticatedUser(req);
    if (!user) return errorResponse(error || 'Unauthorized', 401);

    const body = await req.json().catch(() => ({}));
    const reason: string | undefined = body?.reason;

    const svc = getServiceClient();

    const { data: existing } = await svc
      .from('dkai_deletion_requests')
      .select('id, status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existing || existing.status !== 'pending') {
      return errorResponse('No pending deletion request', 404);
    }

    const { error: updErr } = await svc
      .from('dkai_deletion_requests')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || null,
      })
      .eq('user_id', user.id);
    if (updErr) return errorResponse(`Failed: ${updErr.message}`, 500);

    await svc.from('dkai_profiles').update({ is_active: true }).eq('id', user.id);

    return jsonResponse({ success: true });
  } catch (e: any) {
    return errorResponse(e?.message || 'Cancellation failed', 500);
  }
});
