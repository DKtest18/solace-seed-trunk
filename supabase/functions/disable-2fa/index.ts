import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { code } = await req.json();
    if (!code || code.length !== 6) {
      return jsonResponse({ success: false, error: 'Please provide your current 2FA code to disable' });
    }

    const admin = getServiceClient();

    // Verify current 2FA code before disabling (require proof of possession)
    const verifyRes = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/verify-2fa-code`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: req.headers.get('Authorization') || '',
        },
        body: JSON.stringify({ code }),
      }
    );
    const verifyData = await verifyRes.json();
    if (!verifyData.valid) {
      return jsonResponse({ success: false, error: 'Invalid 2FA code' });
    }

    // Disable in dkai_user_2fa
    await admin
      .from('dkai_user_2fa')
      .update({ enabled: false, secret: null })
      .eq('user_id', user.id);

    // Clear dkai_profiles
    await admin
      .from('dkai_profiles')
      .update({ is_2fa_enabled: false, two_fa_secret: null })
      .eq('id', user.id);

    return jsonResponse({ success: true });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
