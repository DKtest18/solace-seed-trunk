// auto-release-payouts
// Scheduled (pg_cron, hourly). Releases held tier2/tier3 payouts whose
// auto_release_at has passed and that have no open dispute.

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  // Authenticate as service role (cron passes the service role bearer).
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey || req.headers.get('Authorization') !== `Bearer ${serviceKey}`) {
    return errorResponse('Unauthorized', 401);
  }

  const admin = getServiceClient();
  const nowIso = new Date().toISOString();

  const { data: due, error } = await admin
    .from('dkai_orders')
    .select('id, seller_id, seller_earnings, price, delivery_tier')
    .eq('payout_status', 'held')
    .lt('auto_release_at', nowIso)
    .is('dispute_opened_at', null)
    .limit(200);

  if (error) return errorResponse(error.message, 500);
  if (!due?.length) return jsonResponse({ ok: true, released: 0 });

  let released = 0;
  for (const o of due) {
    const earnings = o.seller_earnings ?? Number(o.price) * 0.95;

    await admin.from('dkai_orders').update({
      payout_status: 'auto_released',
      escrow_status: 'released',
      released_at: nowIso,
      status: 'completed',
    }).eq('id', o.id).eq('payout_status', 'held');

    if (o.seller_id) {
      const { data: bal } = await admin
        .from('dkai_seller_balances')
        .select('available_balance, held_balance')
        .eq('seller_id', o.seller_id)
        .single();
      if (bal) {
        await admin.from('dkai_seller_balances').update({
          available_balance: (bal.available_balance || 0) + earnings,
          held_balance: Math.max(0, (bal.held_balance || 0) - earnings),
        }).eq('seller_id', o.seller_id);
      }
      // notify seller
      const { data: prof } = await admin.from('dkai_profiles').select('email').eq('id', o.seller_id).single();
      if (prof?.email) {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
          body: JSON.stringify({
            type: 'payout_released_seller',
            recipientEmail: prof.email,
            data: { orderId: o.id, amount: earnings, tier: o.delivery_tier, auto: true },
          }),
        }).catch(() => {});
      }
    }
    released++;
  }

  return jsonResponse({ ok: true, released });
});
