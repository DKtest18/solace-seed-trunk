// create-checkout-session
// SEPARATE CHARGES AND TRANSFERS.
// The charge is created on the PLATFORM account (no Stripe-Account header, no
// application_fee_amount, no transfer_data, no on_behalf_of). The seller is
// paid by the `transfer-worker` function after the configured hold (7 days).
// Guest checkout is supported: without a Bearer token the order has no
// buyer_id and Stripe collects the buyer's email.

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';
import { createSeparateChargeCheckout } from '../_shared/separate-checkout.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const authHeader = req.headers.get('Authorization');
    let buyer: { id: string; email?: string } | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      const result = await getAuthenticatedUser(req);
      if (result.user) buyer = { id: result.user.id, email: result.user.email || undefined };
    }

    const body = await req.json().catch(() => ({}));
    const productId = body.productId ?? body.product_id;

    let origin = req.headers.get('origin') ?? '';
    if (!origin && typeof body.origin === 'string') origin = body.origin;
    try {
      origin = new URL(origin).origin;
    } catch {
      return errorResponse('Missing or invalid origin', 400);
    }

    const admin = getServiceClient();
    const result = await createSeparateChargeCheckout(admin, {
      productId,
      buyer,
      origin,
      shippingAddress: body.shippingAddress ?? body.shipping_address,
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

    return jsonResponse({ url: result.url, order_id: result.orderId });
  } catch (err) {
    console.error('create-checkout-session error:', err);
    return errorResponse((err as Error).message ?? 'Checkout failed', 500);
  }
});
