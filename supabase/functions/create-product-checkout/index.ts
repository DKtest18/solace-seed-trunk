import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { productId, paymentMethod, shippingAddress } = await req.json();
    const admin = getServiceClient();

    // Get product details
    const { data: product, error: productError } = await admin
      .from('dkai_products')
      .select('*')
      .eq('id', productId)
      .single();

    if (productError || !product) return errorResponse('Product not found', 404);

    const platformFee = product.price * 0.1;
    const sellerEarnings = product.price - platformFee;

    if (paymentMethod === 'stripe') {
      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
      if (!stripeKey) return errorResponse('Stripe not configured', 500);

      // Create Stripe checkout session
      const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'mode': 'payment',
          'success_url': `${req.headers.get('origin')}/purchase-history?success=true`,
          'cancel_url': `${req.headers.get('origin')}/checkout/${productId}?canceled=true`,
          'line_items[0][price_data][currency]': 'usd',
          'line_items[0][price_data][product_data][name]': product.title,
          'line_items[0][price_data][unit_amount]': String(Math.round(product.price * 100)),
          'line_items[0][quantity]': '1',
          'metadata[product_id]': productId,
          'metadata[buyer_id]': user.id,
        }),
      });

      const session = await stripeRes.json();
      if (session.error) throw new Error(session.error.message);

      // Create order
      await admin.from('dkai_orders').insert({
        buyer_id: user.id,
        product_id: productId,
        price: product.price,
        platform_fee: platformFee,
        seller_earnings: sellerEarnings,
        payment_method: 'stripe',
        stripe_session_id: session.id,
        escrow_status: 'pending',
        status: 'pending_payment',
      });

      return jsonResponse({ url: session.url });
    }

    // Manual payment
    const { data: order, error: orderError } = await admin.from('dkai_orders').insert({
      buyer_id: user.id,
      product_id: productId,
      price: product.price,
      platform_fee: platformFee,
      seller_earnings: sellerEarnings,
      payment_method: paymentMethod || 'manual',
      escrow_status: 'pending',
      status: 'pending_payment',
      shipping_address: shippingAddress,
    }).select().single();

    if (orderError) throw orderError;

    return jsonResponse({ success: true, order_id: order.id });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
