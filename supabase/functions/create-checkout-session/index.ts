// create-checkout-session
// Tier-aware Stripe Connect destination charge.
// - 5% application_fee_amount is ALWAYS collected at charge time.
// - Tier1: standard payout (Stripe handles automatic payout to seller).
// - Tier2/Tier3: on_behalf_of=seller + transfer_data.destination with payout
//   timing controlled by the connected account's manual payout schedule.
//   We additionally store payout_status='held' and auto_release_at, and only
//   release via Stripe Payouts API (or rely on schedule) after buyer confirm.
//
// Note: The application_fee_amount is independent of payout timing. Holding
// the seller's portion is achieved by setting the connected account on a
// manual payout schedule + our own auto_release_at gate.

import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

// Fallback fee if seller profile has no platform_fee_percent set.
const DEFAULT_PLATFORM_FEE_PERCENT = 5;

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { productId, shippingAddress } = await req.json();
    if (!productId) return errorResponse('productId required', 400);

    const admin = getServiceClient();

    const { data: product, error: pErr } = await admin
      .from('dkai_products')
      .select('id, title, price, seller_id, delivery_tier, review_status')
      .eq('id', productId)
      .single();
    if (pErr || !product) return errorResponse('Product not found', 404);
    if (product.review_status !== 'approved') return errorResponse('Product not available', 400);

    const tier: 'tier1' | 'tier2' | 'tier3' =
      (product.delivery_tier as any) || 'tier1';

    const { data: sellerStripe } = await admin
      .from('dkaim_user_id')
      .select('stripe_account_id, stripe_onboarded')
      .eq('id', product.seller_id)
      .single();

    if (!sellerStripe?.stripe_account_id || !sellerStripe.stripe_onboarded) {
      return errorResponse('Seller has not connected their payout account', 400);
    }

    const stripeKey = Deno.env.get('DKAIM_STRIPE_SECRET_KEY');
    if (!stripeKey) return errorResponse('Stripe not configured', 500);

    // Read per-seller platform fee from dkai_profiles (dynamic, not hardcoded).
    const { data: sellerProfile } = await admin
      .from('dkai_profiles')
      .select('platform_fee_percent, seller_type')
      .eq('id', product.seller_id)
      .single();
    const feePercent = Number(
      sellerProfile?.platform_fee_percent ?? DEFAULT_PLATFORM_FEE_PERCENT
    );
    const feeRate = Math.max(0, Math.min(100, feePercent)) / 100;

    const priceCents = Math.round(Number(product.price) * 100);
    const appFeeCents = Math.round(priceCents * feeRate);
    const sellerEarnings = (priceCents - appFeeCents) / 100;
    const appFee = appFeeCents / 100;

    // Compute auto-release window from config
    const { data: cfg } = await admin
      .from('dkai_payout_config')
      .select('auto_release_days')
      .eq('tier', tier)
      .single();
    const releaseDays = cfg?.auto_release_days ?? (tier === 'tier3' ? 14 : tier === 'tier2' ? 7 : 0);

    const payoutStatus = tier === 'tier1' ? 'pending' : 'held';
    const autoReleaseAt = tier === 'tier1'
      ? null
      : new Date(Date.now() + releaseDays * 24 * 3600 * 1000).toISOString();

    // Create order first so its id rides in Stripe metadata
    const { data: order, error: oErr } = await admin
      .from('dkai_orders')
      .insert({
        buyer_id: user.id,
        product_id: productId,
        seller_id: product.seller_id,
        price: product.price,
        platform_fee: appFee,
        seller_earnings: sellerEarnings,
        held_amount: tier === 'tier1' ? 0 : product.price,
        payment_method: 'stripe',
        escrow_status: tier === 'tier1' ? 'pending' : 'pending',
        status: 'pending_payment',
        delivery_tier: tier,
        payout_status: payoutStatus,
        auto_release_at: autoReleaseAt,
        application_fee_amount: appFee,
        shipping_address: shippingAddress ?? null,
      })
      .select('id')
      .single();
    if (oErr || !order) throw oErr ?? new Error('Failed to create order');

    const origin = req.headers.get('origin') ?? '';

    const params: Record<string, string> = {
      'mode': 'payment',
      'success_url': `${origin}/purchase-history?success=true&order=${order.id}`,
      'cancel_url': `${origin}/checkout?productId=${productId}&canceled=true`,
      'line_items[0][price_data][currency]': 'chf',
      'line_items[0][price_data][product_data][name]': product.title,
      'line_items[0][price_data][unit_amount]': String(priceCents),
      'line_items[0][quantity]': '1',
      'metadata[order_id]': order.id,
      'metadata[product_id]': productId,
      'metadata[buyer_id]': user.id,
      'metadata[seller_id]': product.seller_id,
      'metadata[delivery_tier]': tier,
      // 5% application fee — ALWAYS at charge time, all tiers.
      'payment_intent_data[application_fee_amount]': String(appFeeCents),
      'payment_intent_data[transfer_data][destination]': sellerStripe.stripe_account_id,
      'payment_intent_data[metadata][order_id]': order.id,
      'payment_intent_data[metadata][delivery_tier]': tier,
    };

    // For tier2/tier3, also set on_behalf_of so the funds settle to the
    // connected account directly; payout to seller is gated by the account's
    // manual payout schedule + our auto_release_at logic.
    if (tier !== 'tier1') {
      params['payment_intent_data[on_behalf_of]'] = sellerStripe.stripe_account_id;
    }

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
    });
    const session = await stripeRes.json();
    if (session.error) throw new Error(session.error.message);

    await admin.from('dkai_orders')
      .update({ stripe_session_id: session.id })
      .eq('id', order.id);

    return jsonResponse({ url: session.url, order_id: order.id, tier });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
