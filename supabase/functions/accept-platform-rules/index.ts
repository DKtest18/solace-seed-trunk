import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { rule_type } = await req.json();
    const admin = getServiceClient();

    await admin.from('dkai_rules_acceptance').upsert({
      user_id: user.id,
      rule_type: rule_type || 'user',
      accepted_at: new Date().toISOString(),
      accepted: true,
    }, { onConflict: 'user_id,rule_type' });

    return jsonResponse({ success: true });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
