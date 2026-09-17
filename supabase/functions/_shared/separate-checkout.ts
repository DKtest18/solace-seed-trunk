// SEPARATE CHARGES AND TRANSFERS — shared checkout builder.
//
// The Checkout Session / PaymentIntent is created on the PLATFORM Stripe
// account:
//   * no Stripe-Account request header
//   * no application_fee_amount
//   * no transfer_data
//   * no on_behalf_of
// The seller is paid later by the transfer-worker function, once the order has
// been paid for `hold_days` (default 7) and nothing blocks the release.
//
// Prices, commission and the seller account are ALWAYS resolved server-side.
// Nothing about the amount is read from the request body.

import { isProductPurchasable } from './purchasable.ts';
import { REVIEW_STATUS } from './review-status.ts';
import { stripeCall, stripeErrorMessage, toMinorUnits, PLATFORM_CURRENCY } from './stripe.ts';

const LICENSE_TIERS = new Set(['personal', 'commercial', 'agency', 'exclusive']);

function clampNonNegative(value: number) {
  return value < 0 ? 0 : value;
}

function resolveTierPrice(product: any, tier: string): number | null {
  const fallback = Number(product.price ?? 0);
  if (tier === 'personal') {
    if (product.license_personal_enabled === false) return null;
    return Number(product.license_personal_price ?? fallback);
  }
  if (tier === 'commercial') {
    if (product.license_commercial_enabled !== true) return null;
    return Number(product.license_commercial_price ?? fallback);
  }
  if (tier === 'agency') {
    if (product.license_agency_enabled !== true) return null;
    return Number(product.license_agency_price ?? fallback);
  }
  if (tier === 'exclusive') {
    if (product.license_exclusive_enabled !== true) return null;
    return Number(product.license_exclusive_price ?? fallback);
  }
  return null;
}

async function applyCoupon(admin: any, product: any, couponCode: string | null | undefined, basePrice: number): Promise<number> {
  let finalPrice = clampNonNegative(basePrice);
  const code = couponCode?.trim();
  if (!code) return Math.round(finalPrice * 100) / 100;

  const { data: coupons, error } = await admin
    .from('dkai_coupons')
    .select('id,code,discount_type,discount_value,usage_limit,times_redeemed,expires_at,active,product_id,seller_id')
    .eq('seller_id', product.seller_id)
    .ilike('code', code)
    .limit(1);

  if (error || !coupons?.length) return Math.round(finalPrice * 100) / 100;
  const coupon = coupons[0];
  const expired = coupon.expires_at ? new Date(coupon.expires_at) < new Date() : false;
  const usageExceeded = coupon.usage_limit != null && Number(coupon.times_redeemed ?? 0) >= Number(coupon.usage_limit);
  const productMatch = !coupon.product_id || coupon.product_id === product.id;
  if (!coupon.active || expired || usageExceeded || !productMatch) return Math.round(finalPrice * 100) / 100;

  if (coupon.discount_type === 'percent') {
    const pct = Number(coupon.discount_value);
    if (Number.isFinite(pct) && pct > 0) finalPrice = clampNonNegative(finalPrice - (finalPrice * pct / 100));
  } else if (coupon.discount_type === 'fixed') {
    const fixed = Number(coupon.discount_value);
    if (Number.isFinite(fixed) && fixed > 0) finalPrice = clampNonNegative(finalPrice - fixed);
  }
  return Math.round(finalPrice * 100) / 100;
}

export interface CheckoutInput {
  productId: string;
  buyer: { id: string; email?: string } | null;
  origin: string;
  shippingAddress?: unknown;
  successPath?: string;
  guestEmail?: string | null;
  couponCode?: string | null;
  licenseTier?: 'personal' | 'commercial' | 'agency' | 'exclusive';
  ipAssignmentAccepted?: boolean;
}

export type CheckoutResult =
  | { ok: true; url: string; orderId: string; sessionId: string }
  | { ok: false; status: number; message: string; code?: string };

export async function createSeparateChargeCheckout(
  admin: any,
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const { productId, buyer, origin } = input;
  if (!productId) return { ok: false, status: 400, message: 'productId required' };
  if (!origin) return { ok: false, status: 400, message: 'Missing origin', code: 'INVALID_ORIGIN' };

  const guard = await isProductPurchasable(admin, productId);
  if (!guard.ok) {
    return { ok: false, status: 400, message: guard.reason!, code: 'PRODUCT_NOT_PURCHASABLE' };
  }

  const { data: product, error: pErr } = await admin
    .from('dkai_products')
    .select('id, title, price, currency, seller_id, delivery_tier, review_status, is_published, license_personal_enabled, license_personal_price, license_commercial_enabled, license_commercial_price, license_agency_enabled, license_agency_price, license_exclusive_enabled, license_exclusive_price, exclusive_sold_at, exclusive_owner_id, status')
    .eq('id', productId)
    .maybeSingle();
  if (pErr || !product) {
    return { ok: false, status: 404, message: 'Product not found', code: 'PRODUCT_NOT_AVAILABLE' };
  }
  if (product.review_status !== REVIEW_STATUS.APPROVED) {
    return { ok: false, status: 400, message: 'Product not available', code: 'PRODUCT_NOT_AVAILABLE' };
  }

  // Seller payout account: canonical table, profile only as legacy fallback.
  const { data: cfg } = await admin
    .from('dkai_seller_payment_configs')
    .select(
      'stripe_account_id, charges_enabled, payouts_enabled, card_payments_enabled, stripe_onboarded, stripe_onboarding_status, onboarding_status, stripe_account_country, stripe_default_currency',
    )
    .eq('seller_id', product.seller_id)
    .maybeSingle();

  let sellerAccount: string | null = cfg?.stripe_account_id ?? null;
  if (!sellerAccount) {
    const { data: prof } = await admin
      .from('dkai_profiles')
      .select('stripe_account_id')
      .eq('id', product.seller_id)
      .maybeSingle();
    sellerAccount = prof?.stripe_account_id ?? null;
  }
  if (!sellerAccount) {
    return {
      ok: false,
      status: 400,
      message: 'Seller has not connected their payout account',
      code: 'SELLER_NOT_CONNECTED',
    };
  }


  // Live Stripe verification: cached DB flags are not enough for new platform
  // charges because seller transfers are only safe when the connected account
  // can receive transfers/payouts and has no active restriction.
  const account = await stripeCall(`accounts/${sellerAccount}`, undefined, { method: 'GET' });
  if (!account.ok) {
    return { ok: false, status: 400, message: stripeErrorMessage(account.data), code: 'SELLER_ACCOUNT_UNAVAILABLE' };
  }
  const transfersActive = account.data?.capabilities?.transfers === 'active';
  const payoutsEnabled = account.data?.payouts_enabled === true;
  const disabledReason = account.data?.requirements?.disabled_reason ?? null;
  await admin
    .from('dkai_seller_payment_configs')
    .update({
      transfers_capability_active: transfersActive,
      payouts_enabled: payoutsEnabled,
      charges_enabled: !!account.data?.charges_enabled,
      account_restricted: !!disabledReason,
      stripe_account_country: account.data?.country ?? null,
      stripe_default_currency: account.data?.default_currency ?? null,
      requirements_snapshot: account.data?.requirements ?? null,
      capabilities_synced_at: new Date().toISOString(),
    })
    .eq('seller_id', product.seller_id);
  if (!transfersActive || !payoutsEnabled || disabledReason) {
    return { ok: false, status: 400, message: 'Seller payout account is not ready for transfers', code: 'SELLER_NOT_TRANSFER_READY' };
  }

  const licenseTier = input.licenseTier && LICENSE_TIERS.has(input.licenseTier) ? input.licenseTier : 'personal';
  const isExclusiveSold = !!product.exclusive_sold_at || !!product.exclusive_owner_id || product.status === 'locked_exclusive';
  if (isExclusiveSold) {
    return { ok: false, status: 400, message: 'Product is already exclusively sold', code: 'PRODUCT_NOT_AVAILABLE' };
  }
  if (licenseTier === 'exclusive' && input.ipAssignmentAccepted !== true) {
    return { ok: false, status: 400, message: 'Exclusive buyout requires IP assignment acceptance', code: 'IP_ASSIGNMENT_REQUIRED' };
  }
  const basePrice = resolveTierPrice(product, licenseTier);
  if (basePrice === null || !Number.isFinite(basePrice)) {
    return { ok: false, status: 400, message: 'Selected license tier is not enabled', code: 'LICENSE_TIER_UNAVAILABLE' };
  }
  const finalPrice = await applyCoupon(admin, product, input.couponCode, basePrice);
  const currency = (product.currency || PLATFORM_CURRENCY).toLowerCase();
  const grossMinor = toMinorUnits(finalPrice, currency);
  if (!Number.isFinite(grossMinor) || grossMinor <= 0) {
    return { ok: false, status: 400, message: 'Invalid product price', code: 'INVALID_PRICE' };
  }

  const tier = (product.delivery_tier as string) || 'tier1';

  // 1) Order row first — its id is the transfer_group and travels in metadata.
  const { data: order, error: oErr } = await admin
    .from('dkai_orders')
    .insert({
      buyer_id: buyer?.id ?? null,
      guest_email: buyer ? null : input.guestEmail ?? null,
      product_id: productId,
      seller_id: product.seller_id,
      price: finalPrice,
      currency,
      gross_amount_minor: grossMinor,
      payment_method: 'stripe',
      status: 'pending_payment',
      delivery_tier: tier,
      charge_mode: 'separate',
      transfer_state: 'pending',
      processing_fee_bearer: 'seller',
      transfer_destination_account: sellerAccount,
      shipping_address: (input.shippingAddress as any) ?? null,
      license_tier: licenseTier,
    })
    .select('id')
    .single();
  if (oErr || !order) {
    return { ok: false, status: 500, message: oErr?.message ?? 'Failed to create order' };
  }

  // 2) Commission is locked transactionally (founding benefit: 0% on the
  //    seller's own first 4 sales, max 5 founding sellers). Concurrency-safe.
  const { data: locked, error: lockErr } = await admin.rpc('dkai_lock_order_commission', {
    _order_id: order.id,
    _gross_minor: grossMinor,
    _currency: currency,
  });
  if (lockErr) {
    await admin.from('dkai_orders').update({ status: 'failed' }).eq('id', order.id);
    return { ok: false, status: 500, message: `Commission lock failed: ${lockErr.message}` };
  }
  const lockRow = Array.isArray(locked) ? locked[0] : locked;

  const transferGroup = `order_${order.id}`;
  const successPath = input.successPath ?? '/purchase-history';

  const params: Record<string, string> = {
    mode: 'payment',
    success_url: `${origin}${successPath}?success=true&order=${order.id}`,
    cancel_url: `${origin}/checkout?productId=${productId}&tier=${licenseTier}&canceled=true`,
    'line_items[0][price_data][currency]': currency,
    'line_items[0][price_data][product_data][name]': product.title,
    'line_items[0][price_data][unit_amount]': String(grossMinor),
    'line_items[0][quantity]': '1',
    'metadata[order_id]': order.id,
    'metadata[product_id]': productId,
    'metadata[seller_id]': product.seller_id,
    'metadata[license_tier]': licenseTier,
    'metadata[buyer_id]': buyer?.id ?? 'guest',
    'metadata[charge_mode]': 'separate',
    'metadata[seller_account]': sellerAccount,
    // The PaymentIntent carries the same identifiers so any event type resolves.
    'payment_intent_data[metadata][order_id]': order.id,
    'payment_intent_data[metadata][seller_id]': product.seller_id,
    'payment_intent_data[metadata][charge_mode]': 'separate',
    'payment_intent_data[transfer_group]': transferGroup,
  };

  if (buyer?.email) {
    params['customer_email'] = buyer.email;
  } else {
    // Guest checkout: Stripe collects the email for the receipt.
    params['customer_creation'] = 'if_required';
    params['billing_address_collection'] = 'auto';
  }

  const session = await stripeCall('checkout/sessions', params, {
    idempotencyKey: `dkaim_session_${order.id}`,
  });
  if (!session.ok) {
    await admin
      .from('dkai_orders')
      .update({ status: 'failed', transfer_last_error: stripeErrorMessage(session.data) })
      .eq('id', order.id);
    return { ok: false, status: 502, message: stripeErrorMessage(session.data), code: 'STRIPE_ERROR' };
  }

  await admin
    .from('dkai_orders')
    .update({
      stripe_session_id: session.data.id,
      stripe_transfer_group: transferGroup,
      livemode: !!session.data.livemode,
      commission_rate: lockRow?.commission_rate ?? null,
    })
    .eq('id', order.id);

  return { ok: true, url: session.data.url, orderId: order.id, sessionId: session.data.id };
}
