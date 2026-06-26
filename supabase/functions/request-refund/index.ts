import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

/**
 * Buyer-initiated refund request.
 *
 * Enforces the seller's product-level return policy:
 *  - Mandatory 24h floor for every product.
 *  - Optional extended window: product.return_window_days (capped at 90).
 *  - Optional return fee: product.return_fee_percentage (0-30%).
 *
 * Deadline is derived from the order's payment time (paid_at / created_at) + window.
 * Stored refund_amount = price * (100 - return_fee_percentage) / 100, in dollars.
 */
Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { orderId, reason } = await req.json();
    if (!orderId || !reason) return errorResponse('orderId and reason are required', 400);

    const admin = getServiceClient();

    // Verify buyer owns the order
    const { data: order } = await admin
      .from('dkai_orders')
      .select('*')
      .eq('id', orderId)
      .eq('buyer_id', user.id)
      .single();

    if (!order) return errorResponse('Order not found', 404);

    if (!['paid', 'completed', 'delivered'].includes(order.status)) {
      return errorResponse('Order is not eligible for refund', 400);
    }

    // Load product-level return policy
    const { data: product } = await admin
      .from('dkai_products')
      .select('title, price, return_allowed, return_window_days, return_fee_enabled, return_fee_percentage')
      .eq('id', order.product_id)
      .single();

    const windowDaysRaw = product?.return_allowed ? (product?.return_window_days ?? 1) : 1;
    const windowDays = Math.min(90, Math.max(1, windowDaysRaw)); // 24h floor, 90d cap
    const feePct = product?.return_fee_enabled
      ? Math.min(30, Math.max(0, product?.return_fee_percentage ?? 0))
      : 0;

    // Compute deadline from payment time (fallback to order created_at)
    const paidAtStr = (order as any).paid_at || order.created_at;
    const paidAt = paidAtStr ? new Date(paidAtStr) : new Date();
    const deadline = new Date(paidAt.getTime() + windowDays * 24 * 3600 * 1000);

    // Prefer the stored deadline only when it is at least as generous as the policy
    const effectiveDeadline = order.refund_deadline
      ? new Date(Math.max(new Date(order.refund_deadline).getTime(), deadline.getTime()))
      : deadline;

    if (effectiveDeadline.getTime() < Date.now()) {
      return errorResponse(`Refund window has expired (${windowDays} day${windowDays === 1 ? '' : 's'} from purchase).`, 400);
    }

    // Compute refund amount in dollars
    const price = Number(order.price ?? product?.price ?? 0);
    const refundAmount = Math.round(price * (100 - feePct)) / 100;

    const { data: dispute, error: disputeError } = await admin
      .from('dkai_disputes')
      .insert({
        order_id: orderId,
        buyer_id: user.id,
        seller_id: order.seller_id || null,
        product_id: order.product_id,
        reason,
        type: 'refund',
        status: 'open',
        refund_amount: refundAmount,
      })
      .select()
      .single();

    if (disputeError) throw disputeError;

    await admin.from('dkai_orders').update({
      status: 'refund_requested',
      refund_deadline: effectiveDeadline.toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', orderId);

    // Notify seller (fire-and-forget)
    try {
      const { data: buyerProfile } = await admin.from('dkai_profiles').select('full_name, creator_name, username').eq('id', user.id).single();
      const { data: sellerProfile } = await admin.from('dkai_profiles').select('email').eq('id', order.seller_id).single();
      const buyerName = buyerProfile?.creator_name || buyerProfile?.full_name || buyerProfile?.username || 'A buyer';
      if (sellerProfile?.email) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (supabaseUrl && serviceKey) {
          fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
            body: JSON.stringify({
              type: 'refund_requested',
              recipientEmail: sellerProfile.email,
              data: {
                productTitle: product?.title,
                buyerName,
                reason,
                orderId,
                price,
                refundAmount,
                returnFeePct: feePct,
              },
            }),
          }).catch(e => console.error('Failed to send refund_requested email:', e));
        }
      }
    } catch (e) {
      console.error('Refund notification failed (non-fatal):', e);
    }

    return jsonResponse({
      success: true,
      dispute_id: dispute.id,
      refund_amount: refundAmount,
      return_fee_pct: feePct,
      deadline: effectiveDeadline.toISOString(),
    });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
