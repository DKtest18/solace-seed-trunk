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

    // Notify seller via email
    const { data: product } = await admin.from('dkai_products').select('title, price').eq('id', order.product_id).single();
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
            data: { productTitle: product?.title, buyerName, reason, orderId, price: product?.price || 0 },
          }),
        }).catch(e => console.error('Failed to send refund_requested email:', e));
      }
    }

    return jsonResponse({ success: true, dispute_id: dispute.id });
  } catch (err: unknown) {
    return errorResponse(err instanceof Error ? err instanceof Error ? err.message : String(err) : String(err)), 500);
  }
});
