import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { orderId } = await req.json();
    const admin = getServiceClient();

    // Verify buyer owns the order
    const { data: order, error: orderError } = await admin
      .from('dkai_orders')
      .select('*, dkai_products(seller_id)')
      .eq('id', orderId)
      .eq('buyer_id', user.id)
      .single();

    if (orderError || !order) return errorResponse('Order not found', 404);

    const now = new Date().toISOString();
    const sellerEarnings = order.seller_earnings || order.price * 0.9;

    // Update order status
    await admin.from('dkai_orders').update({
      escrow_status: 'released',
      buyer_confirmed_at: now,
      released_at: now,
      status: 'completed',
    }).eq('id', orderId);

    // Credit seller balance
    if (order.dkai_products?.seller_id) {
      const { data: balance } = await admin
        .from('dkai_seller_balances')
        .select('*')
        .eq('seller_id', order.dkai_products.seller_id)
        .single();

      if (balance) {
        await admin.from('dkai_seller_balances').update({
          available_balance: (balance.available_balance || 0) + sellerEarnings,
          held_balance: Math.max(0, (balance.held_balance || 0) - sellerEarnings),
        }).eq('seller_id', order.dkai_products.seller_id);
      }
    }

    return jsonResponse({ success: true });
  } catch (err: unknown) {
    return errorResponse(err instanceof Error ? err instanceof Error ? err.message : String(err) : String(err)), 500);
  }
});
