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

      // Send suspension/ban email notification (fire-and-forget)
      sendSuspensionEmail(admin, targetUserId, sanctionType, reason, duration);

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

async function sendSuspensionEmail(
  admin: any,
  targetUserId: string,
  sanctionType: string,
  reason: string,
  duration: string | null,
) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return;

    // Get target user email
    const { data: profile } = await admin
      .from('profiles')
      .select('email')
      .eq('id', targetUserId)
      .single();

    if (!profile?.email) return;

    await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        type: 'account_suspension',
        recipientEmail: profile.email,
        data: {
          sanctionType,
          reason: reason || 'Violation of platform terms of service.',
          duration: duration || '',
        },
      }),
    });
  } catch (e) {
    console.error('Failed to send suspension email:', e);
  }
}
