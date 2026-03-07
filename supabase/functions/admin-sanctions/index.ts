import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { action, targetUserId, sanctionType, reason, duration } = await req.json();
    const admin = getServiceClient();

    // Verify admin
    const { data: roleData } = await admin
      .from('dkai_user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) return errorResponse('Admin access required', 403);

    if (action === 'create') {
      await admin.from('dkai_sanctions').insert({
        user_id: targetUserId,
        sanction_type: sanctionType,
        reason,
        duration,
        created_by: user.id,
      });

      // Log moderation action
      await admin.from('dkai_moderation_audit_logs').insert({
        target_type: 'user',
        target_id: targetUserId,
        action: sanctionType,
        reason,
        moderator_id: user.id,
      });

      return jsonResponse({ success: true });
    } else if (action === 'remove') {
      await admin.from('dkai_sanctions').update({
        is_active: false,
        removed_at: new Date().toISOString(),
        removed_by: user.id,
      }).eq('user_id', targetUserId).eq('is_active', true);

      return jsonResponse({ success: true });
    }

    return errorResponse('Invalid action');
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
