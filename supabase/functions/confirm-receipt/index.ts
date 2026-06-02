// confirm-receipt
// Buyer-triggered (JWT). Tier-aware:
//   tier2: requires EU withdrawal waiver acknowledgment, unlocks download,
//          releases seller payout.
//   tier3: releases seller payout after buyer confirms direct receipt.
//   tier1: no-op (already released).
//
// Release strategy: with destination charges + on_behalf_of, the funds are
// already on the connected account. We trigger a Stripe Payout on the
// connected account to move the held balance to the seller's bank.
// (If the connected account is on automatic schedule, this is a no-op and
// the schedule pays out; we still flip our local payout_status.)

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { orderId, euWaiverAccepted } = await req.json();
    if (!orderId) return errorResponse('orderId required', 400);

    const admin = getServiceClient();

    const { data: order, error: oErr } = await admin
      .from('dkai_orders')
      .select('id, buyer_id, seller_id, price, seller_earnings, delivery_tier, payout_status, status, stripe_payment_intent_id')
      .eq('id', orderId)
      .single();
    if (oErr || !order) return errorResponse('Order not found', 404);
    if (order.buyer_id !== user.id) return errorResponse('Forbidden', 403);
    if (order.status !== 'paid' && order.status !== 'completed') {
      return errorResponse('Order not paid yet', 400);
    }
    if (order.payout_status === 'released' || order.payout_status === 'auto_released') {
      return jsonResponse({ ok: true, already: true });
    }
    if (order.payout_status === 'disputed') {
      return errorResponse('Order is in dispute', 409);
    }

    const tier = order.delivery_tier ?? 'tier1';

    // EU waiver required for tier2 (and tier1) when unlocking instant digital access.
    if (tier === 'tier2' && !euWaiverAccepted) {
      return errorResponse('EU withdrawal waiver acknowledgment required', 400);
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      buyer_confirmed_at: now,
      payout_status: 'released',
      escrow_status: 'released',
      released_at: now,
      status: 'completed',
    };
    if (tier === 'tier2' && euWaiverAccepted) {
      updates.eu_withdrawal_waiver_at = now;
    }

    await admin.from('dkai_orders').update(updates).eq('id', orderId);

    // Credit seller available balance (mirror buyer-confirm-receipt behavior)
    if (order.seller_id) {
      const earnings = order.seller_earnings ?? Number(order.price) * 0.95;
      const { data: balance } = await admin
        .from('dkai_seller_balances')
        .select('available_balance, held_balance')
        .eq('seller_id', order.seller_id)
        .single();
      if (balance) {
        await admin.from('dkai_seller_balances').update({
          available_balance: (balance.available_balance || 0) + earnings,
          held_balance: Math.max(0, (balance.held_balance || 0) - earnings),
        }).eq('seller_id', order.seller_id);
      }
    }

    // Fire-and-forget payout_released_seller email
    notify(admin, order.seller_id, 'payout_released_seller', {
      orderId: order.id, amount: order.seller_earnings, tier,
    });

    return jsonResponse({ ok: true, tier, payout_status: 'released' });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});

async function notify(admin: any, userId: string, type: string, data: Record<string, unknown>) {
  try {
    const { data: prof } = await admin.from('dkai_profiles').select('email').eq('id', userId).single();
    if (!prof?.email) return;
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return;
    await fetch(`${url}/functions/v1/send-notification-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ type, recipientEmail: prof.email, data }),
    });
  } catch (_) { /* swallow */ }
}
