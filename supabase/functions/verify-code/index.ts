import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { code } = await req.json();
    if (!code) return errorResponse('Code required');

    const admin = getServiceClient();

    const { data: stored, error: fetchError } = await admin
      .from('dkai_verification_codes')
      .select('*')
      .eq('user_id', user.id)
      .eq('code', code)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (fetchError || !stored) {
      return jsonResponse({ success: false, error: 'Invalid or expired code' });
    }

    // Mark as verified
    await admin.from('dkai_verification_codes').update({ verified: true }).eq('id', stored.id);

    // Update profile email_verified
    await admin.from('dkai_profiles').update({
      email_verified: true,
      email_verified_at: new Date().toISOString(),
    }).eq('id', user.id);

    return jsonResponse({ success: true });
  } catch (err: unknown) {
    return errorResponse(err instanceof Error ? err instanceof Error ? err.message : String(err) : String(err)), 500);
  }
});
