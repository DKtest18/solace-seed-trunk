import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';
import { clientMeta } from '../_shared/handover-crypto.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const { user, error: authErr } = await getAuthenticatedUser(req);
  if (authErr || !user) return errorResponse('Unauthorized', 401);

  try {
    const body = await req.json();
    const orderId = typeof body?.order_id === 'string' ? body.order_id : '';
    if (!orderId) return errorResponse('order_id is required', 400);

    const admin = getServiceClient();
    const { data: order, error: oErr } = await admin
      .from('dkai_orders')
      .select('id, buyer_id, seller_id')
      .eq('id', orderId)
      .maybeSingle();
    if (oErr || !order) return errorResponse('Order not found', 404);

    // Buyer or seller of the order may finish the handover. Admins cannot.
    const isSeller = order.seller_id === user.id;
    const isBuyer = order.buyer_id === user.id;
    if (!isSeller && !isBuyer) return errorResponse('Forbidden', 403);

    const { data: handovers } = await admin
      .from('dkai_credential_handovers')
      .select('id')
      .eq('order_id', orderId)
      .is('purged_at', null);

    const now = new Date().toISOString();
    if (handovers?.length) {
      const { error: upErr } = await admin
        .from('dkai_credential_handovers')
        .update({
          ciphertext: '',
          iv: '',
          auth_tag: '',
          purged_at: now,
          purged_reason: isBuyer ? 'buyer marked handover complete' : 'seller marked handover complete',
        })
        .eq('order_id', orderId)
        .is('purged_at', null);
      if (upErr) return errorResponse(`Purge failed: ${upErr.message}`, 500);

      await admin.from('dkai_credential_access_log').insert(
        handovers.map((h: { id: string }) => ({
          handover_id: h.id,
          order_id: orderId,
          actor_id: user.id,
          actor_role: isBuyer ? 'buyer' : 'seller',
          action: 'purge',
          ...clientMeta(req),
        })),
      );
    }

    await admin
      .from('dkai_orders')
      .update({ handover_status: 'completed', handover_completed_at: now })
      .eq('id', orderId);

    return jsonResponse({ success: true, purged: handovers?.length ?? 0 });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
