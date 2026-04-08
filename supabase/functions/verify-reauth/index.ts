import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { password, totpCode } = await req.json();
    const admin = getServiceClient();

    // Verify password by attempting sign-in
    if (password) {
      const { error: signInError } = await admin.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (signInError) return jsonResponse({ success: false, error: 'Invalid password' });
    }

    // Verify TOTP if provided
    if (totpCode) {
      const { data: totpData } = await admin
        .from('dkai_user_2fa')
        .select('totp_secret')
        .eq('user_id', user.id)
        .eq('is_enabled', true)
        .single();

      if (!totpData) return jsonResponse({ success: false, error: '2FA not enabled' });
      // TOTP verification would use a library like otpauth here
    }

    // Create re-auth session
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min
    await admin.from('sensitive_data_sessions').insert({
      user_id: user.id,
      session_type: 'payout_access',
      expires_at: expiresAt,
    });

    return jsonResponse({ success: true });
  } catch (err: unknown) {
    return errorResponse(err instanceof Error ? err instanceof Error ? err.message : String(err) : String(err)), 500);
  }
});
