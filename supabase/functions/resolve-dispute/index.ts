import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { disputeId, resolution, refundBuyer, penalizeSeller, penaltyAmount, notes } = await req.json();
    const admin = getServiceClient();

    // Verify admin
    const { data: roleData } = await admin
      .from('dkai_user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) return errorResponse('Admin access required', 403);

    await admin.from('dkai_disputes').update({
      status: 'resolved',
      resolution,
      resolution_notes: notes,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    }).eq('id', disputeId);

    // Handle refund if needed
    if (refundBuyer) {
      const { data: dispute } = await admin.from('dkai_disputes').select('order_id, product_id').eq('id', disputeId).single();
      if (dispute?.order_id) {
        const { data: orderData } = await admin.from('dkai_orders').select('buyer_id, price, payment_method').eq('id', dispute.order_id).single();
        await admin.from('dkai_orders').update({
          escrow_status: 'refunded',
          status: 'refunded',
        }).eq('id', dispute.order_id);

        if (orderData) {
          const { data: buyerProfile } = await admin.from('dkai_profiles').select('email').eq('id', orderData.buyer_id).single();
          const { data: product } = await admin.from('dkai_products').select('title').eq('id', dispute.product_id).single();
          const supabaseUrl = Deno.env.get('SUPABASE_URL');
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
          const paymentMethod = orderData.payment_method === 'stripe' ? 'Stripe (Card)' : orderData.payment_method || 'Original payment method';

          if (buyerProfile?.email && supabaseUrl && serviceKey) {
            const sendEmail = (type: string, data: Record<string, any>) =>
              fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
                body: JSON.stringify({ type, recipientEmail: buyerProfile.email, data }),
              }).catch(e => console.error(`Failed to send ${type} email:`, e));

            // 1) Send refund_accepted email immediately
            await sendEmail('refund_accepted', {
              productTitle: product?.title,
              price: orderData.price,
              paymentMethod,
              orderId: dispute.order_id,
            });

            // 2) Credit buyer balance (refund the money)
            const { data: buyerBalance } = await admin
              .from('dkai_user_balances')
              .select('*')
              .eq('user_id', orderData.buyer_id)
              .single();

            if (buyerBalance) {
              await admin.from('dkai_user_balances').update({
                balance: (buyerBalance.balance || 0) + orderData.price,
              }).eq('user_id', orderData.buyer_id);
            } else {
              await admin.from('dkai_user_balances').insert({
                user_id: orderData.buyer_id,
                balance: orderData.price,
              });
            }

            // 3) Send refund_completed confirmation after balance credit
            sendEmail('refund_completed', {
              productTitle: product?.title,
              price: orderData.price,
              paymentMethod,
              orderId: dispute.order_id,
            });
          }
        }
      }
    } else {
      // Refund denied – send refund_declined email
      const { data: dispute } = await admin.from('dkai_disputes').select('order_id, product_id, buyer_id').eq('id', disputeId).single();
      if (dispute) {
        const { data: buyerProfile } = await admin.from('dkai_profiles').select('email').eq('id', dispute.buyer_id).single();
        const { data: product } = await admin.from('dkai_products').select('title').eq('id', dispute.product_id).single();
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (buyerProfile?.email && supabaseUrl && serviceKey) {
          fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
            body: JSON.stringify({
              type: 'refund_declined',
              recipientEmail: buyerProfile.email,
              data: { productTitle: product?.title, reason: notes || 'No reason provided', orderId: dispute.order_id },
            }),
          }).catch(e => console.error('Failed to send refund_declined email:', e));
        }
      }
    }

    return jsonResponse({ success: true, resolution });
  } catch (err: unknown) {
    return errorResponse(err instanceof Error ? err instanceof Error ? err.message : String(err) : String(err)), 500);
  }
});
