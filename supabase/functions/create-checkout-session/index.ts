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
import { isProductPurchasable } from '../_shared/purchasable.ts';
import { REVIEW_STATUS } from '../_shared/review-status.ts';
import { getPlatformFeePercent } from '../_shared/platform-fee.ts';


Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  // Guests allowed — auth is optional. If a Bearer token is present we resolve
  // the user; otherwise we treat it as a guest checkout (buyer_id = null,
  // Stripe collects the email at checkout).
  const authHeader = req.headers.get('Authorization');
  let user: { id: string; email: string } | null = null;
  if (authHeader?.startsWith('Bearer ')) {
    const result = await getAuthenticatedUser(req);
    if (result.user) user = { id: result.user.id, email: result.user.email };
  }

  try {
    const body = await req.json();
    const productId = body.productId ?? body.product_id;
    const shippingAddress = body.shippingAddress;
    if (!productId) return errorResponse('productId required', 400);

    const admin = getServiceClient();

    // PROVIDER-AGNOSTIC GUARD — runs before any Stripe object or order row is
    // created, so a direct API call cannot bypass the UI. Fails closed.
    const guard = await isProductPurchasable(admin, productId);
    if (!guard.ok) return errorResponse(guard.reason!, 400);

    const { data: product, error: pErr } = await admin
      .from('dkai_products')
      .select('id, title, price, seller_id, delivery_tier, review_status')
      .eq('id', productId)
      .single();
    if (pErr || !product) return errorResponse('Product not found', 404);
    if (product.review_status !== REVIEW_STATUS.APPROVED) return errorResponse('Product not available', 400);

    const tier: 'tier1' | 'tier2' | 'tier3' =
      (product.delivery_tier as any) || 'tier1';

    // SINGLE SOURCE OF TRUTH: public.dkai_seller_payment_configs (unique seller_id).
    // Legacy identity tables are never queried (they do not exist).
    const { data: cfgRow } = await admin
      .from('dkai_seller_payment_configs')
      .select('stripe_account_id, charges_enabled, card_payments_enabled, stripe_onboarded, stripe_onboarding_status, onboarding_status')
      .eq('seller_id', product.seller_id)
      .maybeSingle();

    let stripeAccountId: string | undefined = cfgRow?.stripe_account_id ?? undefined;
    let cardPaymentsEnabled =
      !!cfgRow?.charges_enabled ||
      !!cfgRow?.card_payments_enabled ||
      !!cfgRow?.stripe_onboarded ||
      cfgRow?.stripe_onboarding_status === 'connected' ||
      cfgRow?.onboarding_status === 'connected';

    // Legacy fallback: some early sellers still carry the account id on their profile.
    if (!stripeAccountId) {
      const { data: prof } = await admin
        .from('dkai_profiles')
        .select('stripe_account_id, stripe_onboarded')
        .eq('id', product.seller_id)
        .maybeSingle();
      if (prof?.stripe_account_id) {
        stripeAccountId = prof.stripe_account_id;
        cardPaymentsEnabled = cardPaymentsEnabled || !!prof.stripe_onboarded;
      }
    }

    if (!stripeAccountId) {
      return errorResponse('Seller has not connected their payout account', 400);
    }
    if (!cardPaymentsEnabled) {
      return errorResponse('Seller has not finished payment setup yet', 400);
    }


    const stripeKey = Deno.env.get('DKAIM_STRIPE_SECRET_KEY');
    if (!stripeKey) return errorResponse('Stripe not configured', 500);

    // FEE RULE (single source of truth, shared with PayPal):
    // founding sellers pay 0% on their own first 4 SETTLED sales, then the
    // normal per-seller fee. The old platform-wide 20-sale promo is retired.
    const feePercent = await getPlatformFeePercent(admin, product.seller_id);
    const feeRate = feePercent / 100;


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
        buyer_id: user?.id ?? null,
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

    const origin = req.headers.get('origin') ?? body.origin ?? '';

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
      'metadata[buyer_id]': user?.id ?? 'guest',
      'metadata[seller_id]': product.seller_id,
      'metadata[delivery_tier]': tier,
      // 5% application fee — ALWAYS at charge time, all tiers.
      'payment_intent_data[application_fee_amount]': String(appFeeCents),
      'payment_intent_data[transfer_data][destination]': stripeAccountId,
      'payment_intent_data[metadata][order_id]': order.id,
      'payment_intent_data[metadata][delivery_tier]': tier,
    };

    // Guests: let Stripe Checkout collect the email so the receipt + order
    // recovery flow still works.
    if (user?.email) {
      params['customer_email'] = user.email;
    } else {
      params['billing_address_collection'] = 'auto';
    }

    // For tier2/tier3, also set on_behalf_of so the funds settle to the
    // connected account directly; payout to seller is gated by the account's
    // manual payout schedule + our auto_release_at logic.
    if (tier !== 'tier1') {
      params['payment_intent_data[on_behalf_of]'] = stripeAccountId;
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
