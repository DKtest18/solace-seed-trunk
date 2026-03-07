import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { orderId, reason } = await req.json();
    const admin = getServiceClient();

    // Verify buyer owns the order
    const { data: order } = await admin
      .from('dkai_orders')
      .select('*')
      .eq('id', orderId)
      .eq('buyer_id', user.id)
      .single();

    if (!order) return errorResponse('Order not found', 404);

    // Check refund deadline
    if (order.refund_deadline && new Date(order.refund_deadline) < new Date()) {
      return errorResponse('Refund window has expired');
    }

    // Create refund request / dispute
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
      })
      .select()
      .single();

    if (disputeError) throw disputeError;

    // Update order status
    await admin.from('dkai_orders').update({
      status: 'refund_requested',
    }).eq('id', orderId);

    return jsonResponse({ success: true, dispute_id: dispute.id });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
