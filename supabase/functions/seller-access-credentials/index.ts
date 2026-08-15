import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';
import { decryptSecret, clientMeta } from '../_shared/handover-crypto.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const { user, error: authErr } = await getAuthenticatedUser(req);
  if (authErr || !user) return errorResponse('Unauthorized', 401);

  try {
    const body = await req.json();
    const handoverId = typeof body?.handover_id === 'string' ? body.handover_id : '';
    if (!handoverId) return errorResponse('handover_id is required', 400);

    const admin = getServiceClient();
    const { data: h, error } = await admin
      .from('dkai_credential_handovers')
      .select('*')
      .eq('id', handoverId)
      .maybeSingle();
    if (error || !h) return errorResponse('Credential not found', 404);

    // ONLY the seller of this order may decrypt. Admins are deliberately excluded:
    // buyer-supplied credentials are never readable by platform staff.
    if (h.seller_id !== user.id) return errorResponse('Forbidden', 403);
    if (h.purged_at) return errorResponse('These credentials were already purged', 410);
    if (new Date(h.access_expires_at).getTime() <= Date.now()) {
      await admin
        .from('dkai_credential_handovers')
        .update({
          purged_at: new Date().toISOString(),
          purged_reason: 'access window expired',
          ciphertext: '',
          iv: '',
          auth_tag: '',
        })
        .eq('id', h.id);
      await admin.from('dkai_credential_access_log').insert({
        handover_id: h.id,
        order_id: h.order_id,
        actor_id: user.id,
        actor_role: 'system',
        action: 'expired_auto_purge',
        ...clientMeta(req),
      });
      return errorResponse('The access window has expired — credentials were purged', 410);
    }

    const plaintext = await decryptSecret({
      ciphertext: h.ciphertext,
      iv: h.iv,
      auth_tag: h.auth_tag,
    });

    await admin.from('dkai_credential_access_log').insert({
      handover_id: h.id,
      order_id: h.order_id,
      actor_id: user.id,
      actor_role: 'seller',
      action: 'decrypt',
      ...clientMeta(req),
    });

    return jsonResponse({
      success: true,
      spec_key: h.spec_key,
      spec_label: h.spec_label,
      plaintext,
      access_expires_at: h.access_expires_at,
    });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
