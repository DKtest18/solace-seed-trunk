import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { target_user_id, reason, details, category } = await req.json();
    if (!target_user_id || !reason) return errorResponse('target_user_id and reason required');

    const admin = getServiceClient();

    const { data: report, error: reportError } = await admin
      .from('dkai_reports')
      .insert({
        reporter_id: user.id,
        target_user_id,
        reason,
        details: details || null,
        category: category || 'other',
        status: 'pending',
      })
      .select()
      .single();

    if (reportError) throw reportError;

    return jsonResponse({ success: true, report_id: report.id });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
