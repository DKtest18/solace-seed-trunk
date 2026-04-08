import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { orderId, action, reason } = await req.json();
    const admin = getServiceClient();

    // Verify admin role
    const { data: roleData } = await admin
      .from('dkai_user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) return errorResponse('Admin access required', 403);

    const { data: order, error: orderError } = await admin
      .from('dkai_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) return errorResponse('Order not found', 404);

    const now = new Date().toISOString();

    if (action === 'release') {
      const sellerEarnings = order.seller_earnings || order.price * 0.9;
      
      await admin.from('dkai_orders').update({
        escrow_status: 'released',
        released_at: now,
        seller_earnings: sellerEarnings,
      }).eq('id', orderId);

      // Credit seller balance
      const { data: product } = await admin.from('dkai_products').select('seller_id').eq('id', order.product_id).single();
      if (product) {
        await admin.rpc('increment_seller_balance', {
          p_seller_id: product.seller_id,
          p_amount: sellerEarnings,
        });
      }
    } else if (action === 'refund') {
      await admin.from('dkai_orders').update({
        escrow_status: 'refunded',
        status: 'refunded',
      }).eq('id', orderId);
    } else if (action === 'hold') {
      const newDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await admin.from('dkai_orders').update({
        auto_confirm_deadline: newDeadline,
      }).eq('id', orderId);
    } else {
      return errorResponse('Invalid action');
    }

    // Log the action
    await admin.from('dkai_audit_logs').insert({
      user_id: user.id,
      action: `ESCROW_${action.toUpperCase()}`,
      table_name: 'dkai_orders',
      record_id: orderId,
      new_data: { reason, action },
    });

    return jsonResponse({ success: true, action });
  } catch (err: unknown) {
    return errorResponse(err instanceof Error ? err instanceof Error ? err.message : String(err) : String(err)), 500);
  }
});
