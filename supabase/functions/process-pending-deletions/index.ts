import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/auth.ts';

// Background job: process scheduled account deletions.
// Auth: requires SERVICE_ROLE bearer (call via cron).
Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey || req.headers.get('Authorization') !== `Bearer ${serviceKey}`) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const svc = getServiceClient();
    const nowIso = new Date().toISOString();

    const { data: due, error } = await svc
      .from('dkai_deletion_requests')
      .select('id, user_id')
      .eq('status', 'pending')
      .lte('scheduled_deletion_at', nowIso);
    if (error) return errorResponse(error.message, 500);

    const results: any[] = [];
    for (const row of due || []) {
      const uid = row.user_id;
      try {
        // Get email before anonymizing for notification
        const { data: userData } = await svc.auth.admin.getUserById(uid);
        const originalEmail = userData?.user?.email;

        const anonEmail = `deleted-user-${crypto.randomUUID()}@deleted.local`;

        await svc.from('dkai_profiles').update({
          is_deleted: true,
          is_active: false,
          deleted_at: nowIso,
          full_name: '[Deleted User]',
          username: null,
          bio: null,
          avatar_url: null,
          creator_name: null,
        }).eq('id', uid);

        // Anonymize auth user
        await svc.auth.admin.updateUserById(uid, {
          email: anonEmail,
          user_metadata: { deleted: true },
          ban_duration: '876000h', // 100 years
        });

        await svc.from('dkai_deletion_requests').update({ status: 'completed' }).eq('id', row.id);

        if (originalEmail) {
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'account_deletion_completed',
              recipientEmail: originalEmail,
              data: { deletionDate: new Date().toLocaleDateString('en-US') },
            }),
          }).catch(() => {});
        }

        results.push({ user_id: uid, status: 'completed' });
      } catch (e: any) {
        results.push({ user_id: uid, status: 'error', error: e?.message });
      }
    }

    return jsonResponse({ processed: results.length, results });
  } catch (e: any) {
    return errorResponse(e?.message || 'Job failed', 500);
  }
});
