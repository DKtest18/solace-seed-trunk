import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  // user_id is derived from the verified JWT, never from the request body
  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const body = await req.json().catch(() => ({}));
    const rule_type = (body?.rule_type as string) || 'user';

    const admin = getServiceClient();

    // Look up the currently active rules version for this rule_type
    const { data: rules, error: rulesErr } = await admin
      .from('dkai_platform_rules')
      .select('version')
      .eq('rule_type', rule_type)
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (rulesErr || !rules) {
      console.error('accept-platform-rules: rules lookup failed', rulesErr);
      return errorResponse('Active rules not found', 404);
    }

    const { error: upsertErr } = await admin
      .from('dkai_rules_acceptance')
      .upsert(
        {
          user_id: user.id,
          rule_type,
          rules_version: rules.version,
          accepted_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,rule_type' }
      );

    if (upsertErr) {
      console.error('accept-platform-rules: upsert failed', upsertErr);
      return errorResponse('Failed to accept rules', 500);
    }

    return jsonResponse({ success: true, rules_version: rules.version });
  } catch (err) {
    console.error('accept-platform-rules: unhandled error', err);
    return errorResponse('Failed to accept rules', 500);
  }
});
