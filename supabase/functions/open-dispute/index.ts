// open-dispute
// Buyer-triggered (JWT). Within the dispute window, marks order disputed,
// freezes the payout, and notifies admin + seller.

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { orderId, reason } = await req.json();
    if (!orderId) return errorResponse('orderId required', 400);
    if (!reason || String(reason).trim().length < 10) {
      return errorResponse('Dispute reason (min 10 chars) required', 400);
    }

    const admin = getServiceClient();
    const { data: order, error: oErr } = await admin
      .from('dkai_orders')
      .select('id, buyer_id, seller_id, payout_status, auto_release_at, delivery_tier')
      .eq('id', orderId)
      .single();
    if (oErr || !order) return errorResponse('Order not found', 404);
    if (order.buyer_id !== user.id) return errorResponse('Forbidden', 403);
    if (order.payout_status === 'released' || order.payout_status === 'auto_released') {
      return errorResponse('Payout already released — too late to dispute here', 409);
    }
    if (order.payout_status === 'disputed') {
      return jsonResponse({ ok: true, already: true });
    }
    if (order.auto_release_at && new Date(order.auto_release_at) < new Date()) {
      return errorResponse('Dispute window has closed', 409);
    }

    const now = new Date().toISOString();
    await admin.from('dkai_orders').update({
      payout_status: 'disputed',
      dispute_opened_at: now,
      status: 'disputed',
    }).eq('id', orderId);

    // Notify seller
    const { data: sellerProf } = await admin.from('dkai_profiles').select('email').eq('id', order.seller_id).single();
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const send = (body: any) => fetch(`${url}/functions/v1/send-notification-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify(body),
    }).catch(() => {});

    if (sellerProf?.email) {
      send({ type: 'dispute_opened_seller', recipientEmail: sellerProf.email,
             data: { orderId, reason, tier: order.delivery_tier } });
    }

    // Notify admins
    const { data: admins } = await admin
      .from('dkai_user_roles')
      .select('user_id, dkai_profiles!inner(email)')
      .eq('role', 'admin');
    for (const a of admins ?? []) {
      const email = (a as any).dkai_profiles?.email;
      if (email) send({ type: 'dispute_opened_admin', recipientEmail: email,
                        data: { orderId, reason, tier: order.delivery_tier, buyerId: user.id } });
    }

    return jsonResponse({ ok: true, payout_status: 'disputed' });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
