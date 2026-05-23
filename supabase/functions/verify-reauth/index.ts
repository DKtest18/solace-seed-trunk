import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { password } = await req.json();
    const admin = getServiceClient();

    // Re-authentication must prove identity — require and verify the password.
    if (!password) {
      return jsonResponse({ success: false, error: 'Password is required' });
    }

    const { error: signInError } = await admin.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (signInError) return jsonResponse({ success: false, error: 'Invalid password' });

    // Create re-auth session
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min
    await admin.from('sensitive_data_sessions').insert({
      user_id: user.id,
      session_type: 'payout_access',
      expires_at: expiresAt,
    });

    return jsonResponse({ success: true });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
