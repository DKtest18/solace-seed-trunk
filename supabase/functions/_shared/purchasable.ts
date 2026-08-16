// Shared, provider-agnostic purchase guard.
//
// A product may only be paid for when the DB function
// `public.dkai_product_purchasable(uuid)` returns TRUE — i.e. the product is
// approved/published AND its seller has a connected payout provider
// (Stripe Connect OR PayPal). Products without a provider stay fully visible
// in the public marketplace but can never be charged for.
//
// FAIL CLOSED: if the RPC errors or returns anything other than true, the
// request is rejected. Call this at the very START of every checkout entry
// point (Stripe and PayPal alike), before any payment object is created.

export const NOT_PURCHASABLE_MESSAGE =
  'This product is not yet available for purchase — the seller has not connected a payment provider (Stripe or PayPal) yet.';

export async function isProductPurchasable(
  admin: any,
  productId: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!productId) return { ok: false, reason: 'productId required' };
  const { data, error } = await admin.rpc('dkai_product_purchasable', {
    p_product_id: productId,
  });
  if (error) {
    return { ok: false, reason: `Purchase check failed: ${error.message}` };
  }
  if (data !== true) return { ok: false, reason: NOT_PURCHASABLE_MESSAGE };
  return { ok: true };
}
