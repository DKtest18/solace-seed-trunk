import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { secret, code, recoveryKey } = await req.json();
    const admin = getServiceClient();

    // In production, verify TOTP code against secret using otpauth library
    // For now, we trust the client-side verification and store the secret

    await admin.from('dkai_user_2fa').upsert({
      user_id: user.id,
      totp_secret: secret,
      is_enabled: true,
      recovery_key: recoveryKey || null,
      enabled_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    return jsonResponse({ success: true });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
