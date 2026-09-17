// create-product-checkout
// Authenticated checkout entry point. The card path now uses SEPARATE CHARGES
// AND TRANSFERS via the shared builder (platform charge, no application fee,
// no transfer_data, no on_behalf_of). Manual payment orders are unchanged.

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';
import { isProductPurchasable } from '../_shared/purchasable.ts';
import { getPlatformFeePercent } from '../_shared/platform-fee.ts';
import { createSeparateChargeCheckout } from '../_shared/separate-checkout.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const body = await req.json().catch(() => ({}));
    const productId = body.productId ?? body.product_id;
    const paymentMethod = body.paymentMethod ?? 'card';
    const shippingAddress = body.shippingAddress ?? null;
    const licenseTier = body.license_tier ?? body.licenseTier;
    const couponCode = body.couponCode ?? body.coupon_code;
    const ipAssignmentAccepted = body.ip_assignment_accepted === true || body.ipAssignmentAccepted === true;

    const admin = getServiceClient();

    const guard = await isProductPurchasable(admin, productId);
    if (!guard.ok) return errorResponse(guard.reason ?? 'Product is not available for purchase', 400);

    const { data: product, error: productError } = await admin
      .from('dkai_products')
      .select('id, title, price, seller_id, dkai_profiles:seller_id(email, display_name, username)')
      .eq('id', productId)
      .maybeSingle();
    if (productError || !product) return errorResponse('Product not found', 404);

    const { data: buyerProfile } = await admin
      .from('dkai_profiles')
      .select('email, display_name, username')
      .eq('id', user.id)
      .maybeSingle();

    const buyerName = buyerProfile?.display_name || buyerProfile?.username || 'A buyer';
    const buyerEmail = buyerProfile?.email || user.email;
    const sellerName =
      (product as any).dkai_profiles?.display_name ||
      (product as any).dkai_profiles?.username ||
      'the seller';
    const sellerEmail = (product as any).dkai_profiles?.email ?? null;

    if (paymentMethod === 'stripe' || paymentMethod === 'card') {
      let origin = req.headers.get('origin') ?? '';
      if (!origin && typeof body.origin === 'string') origin = body.origin;
      try {
        origin = new URL(origin).origin;
      } catch {
        return errorResponse('Missing or invalid origin', 400);
      }

      const result = await createSeparateChargeCheckout(admin, {
        productId,
        buyer: { id: user.id, email: buyerEmail || undefined },
        origin,
        shippingAddress,
        couponCode,
        licenseTier,
        ipAssignmentAccepted,
      });
      if (!result.ok) {
        return new Response(
          JSON.stringify({ error: result.message, code: result.code ?? 'CHECKOUT_FAILED' }),
          {
            status: result.status,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          },
        );
      }

      sendNotificationEmails(admin, {
        productTitle: product.title,
        price: Number(product.price),
        buyerName,
        buyerEmail: buyerEmail ?? '',
        sellerName,
        sellerEmail,
        orderId: result.orderId,
        paymentMethod: 'Stripe (Card)',
      });

      return jsonResponse({ url: result.url, order_id: result.orderId });
    }

    // ---- Manual payment (no Stripe object involved) --------------------------
    const feePercent = await getPlatformFeePercent(admin, product.seller_id);
    const platformFee = Math.round(Number(product.price) * feePercent) / 100;
    const sellerEarnings = Math.round((Number(product.price) - platformFee) * 100) / 100;

    const { data: order, error: orderError } = await admin
      .from('dkai_orders')
      .insert({
        buyer_id: user.id,
        product_id: productId,
        seller_id: product.seller_id,
        price: product.price,
        platform_fee: platformFee,
        seller_earnings: sellerEarnings,
        payment_method: paymentMethod || 'manual',
        status: 'pending_payment',
        charge_mode: 'manual',
        transfer_state: 'not_applicable',
        shipping_address: shippingAddress,
      })
      .select('id')
      .single();
    if (orderError || !order) throw orderError ?? new Error('Failed to create order');

    sendNotificationEmails(admin, {
      productTitle: product.title,
      price: Number(product.price),
      buyerName,
      buyerEmail: buyerEmail ?? '',
      sellerName,
      sellerEmail,
      orderId: order.id,
      paymentMethod: 'Manual Payment',
    });

    return jsonResponse({ success: true, order_id: order.id });
  } catch (err) {
    console.error('create-product-checkout error:', err);
    return errorResponse((err as Error).message ?? 'Checkout failed', 500);
  }
});

function sendNotificationEmails(
  _admin: any,
  data: {
    productTitle: string;
    price: number;
    buyerName: string;
    buyerEmail: string;
    sellerName: string;
    sellerEmail: string | null;
    orderId: string;
    paymentMethod: string;
  },
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return;

  const send = (payload: unknown) =>
    fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify(payload),
    }).catch((e) => console.error('notification email failed:', e));

  if (data.buyerEmail) {
    send({
      type: 'purchase_confirmation',
      recipientEmail: data.buyerEmail,
      data: {
        productTitle: data.productTitle,
        price: data.price,
        sellerName: data.sellerName,
        paymentMethod: data.paymentMethod,
        orderId: data.orderId,
      },
    });
  }
  if (data.sellerEmail) {
    send({
      type: 'new_sale',
      recipientEmail: data.sellerEmail,
      data: {
        productTitle: data.productTitle,
        price: data.price,
        buyerName: data.buyerName,
        orderId: data.orderId,
      },
    });
  }
}
