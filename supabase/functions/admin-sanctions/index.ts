import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { action, targetUserId, sanctionType, reason, duration, warningNumber, consequences } = await req.json();
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

      // Send the correct email based on sanction type
      sendSanctionEmail(admin, targetUserId, sanctionType, reason, duration, warningNumber, consequences);

      return jsonResponse({ success: true });
    } else if (action === 'remove') {
      // Get the active sanction before removing it (for the email)
      const { data: activeSanction } = await admin
        .from('dkai_sanctions')
        .select('sanction_type')
        .eq('user_id', targetUserId)
        .eq('is_active', true)
        .single();

      await admin.from('dkai_sanctions').update({
        is_active: false,
        removed_at: new Date().toISOString(),
        removed_by: user.id,
      }).eq('user_id', targetUserId).eq('is_active', true);

      // Log moderation action
      await admin.from('dkai_moderation_audit_logs').insert({
        target_type: 'user',
        target_id: targetUserId,
        action: 'sanction_lifted',
        reason: `Sanction removed: ${activeSanction?.sanction_type || 'unknown'}`,
        moderator_id: user.id,
      });

      // Send sanction lifted email
      sendSanctionLiftedEmail(admin, targetUserId, activeSanction?.sanction_type || 'Temporary Suspension');

      return jsonResponse({ success: true });
    }

    return errorResponse('Invalid action');
  } catch (err: unknown) {
    return errorResponse(err instanceof Error ? err instanceof Error ? err.message : String(err) : String(err)), 500);
  }
});

async function sendSanctionEmail(
  admin: any,
  targetUserId: string,
  sanctionType: string,
  reason: string,
  duration: string | null,
  warningNumber?: string | null,
  consequences?: string | null,
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

    // Map sanction type to notification email type
    let emailType: string;
    let emailData: Record<string, any> = {
      reason: reason || 'Violation of platform terms of service.',
    };

    switch (sanctionType) {
      case 'warning':
        emailType = 'account_warning';
        emailData.warningNumber = warningNumber || '1';
        emailData.consequences = consequences || 'Repeated violations may result in temporary suspension or permanent ban.';
        break;
      case 'ban':
      case 'permanent_ban':
        emailType = 'account_ban';
        break;
      case 'deactivation':
        emailType = 'account_deactivation';
        emailData.deactivationDate = new Date().toLocaleDateString('en-US');
        break;
      case 'deletion':
        emailType = 'account_deletion';
        emailData.deletionDate = new Date().toLocaleDateString('en-US');
        break;
      default:
        // suspension or any other type
        emailType = 'account_suspension';
        emailData.sanctionType = sanctionType;
        emailData.duration = duration || '';
        break;
    }

    await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        type: emailType,
        recipientEmail: profile.email,
        data: emailData,
      }),
    });
  } catch (e) {
    console.error('Failed to send sanction email:', e);
  }
}

async function sendSanctionLiftedEmail(
  admin: any,
  targetUserId: string,
  originalSanctionType: string,
) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return;

    const { data: profile } = await admin
      .from('profiles')
      .select('email')
      .eq('id', targetUserId)
      .single();

    if (!profile?.email) return;

    const sanctionLabels: Record<string, string> = {
      suspension: 'Temporary Suspension',
      ban: 'Permanent Ban',
      permanent_ban: 'Permanent Ban',
      warning: 'Warning',
      deactivation: 'Deactivation',
    };

    await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        type: 'sanction_lifted',
        recipientEmail: profile.email,
        data: {
          originalSanction: sanctionLabels[originalSanctionType] || originalSanctionType,
          liftedDate: new Date().toLocaleDateString('en-US'),
        },
      }),
    });
  } catch (e) {
    console.error('Failed to send sanction lifted email:', e);
  }
}