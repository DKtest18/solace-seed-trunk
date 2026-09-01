// Single source of truth for the platform fee, shared by every payment path
// (Stripe Checkout, Stripe legacy product checkout, PayPal).
//
// RULE (replaces the retired platform-wide "first 20 sales" promo):
//   - A seller marked as founding (max 5 accounts, granted manually by an admin)
//     pays 0% on their OWN first 4 settled sales.
//   - From their 5th settled sale on, they pay the normal per-seller fee.
//   - "Settled" means the order actually completed and the money stayed:
//     status in (completed, delivered, released), not refunded/reversed.
//     Merely 'paid' does NOT count toward the 4.
//   - The founding badge itself is permanent and has no fee effect afterwards.
//
// The rule lives in the SQL function dkai_effective_platform_fee_percent so
// Stripe and PayPal can never drift apart.

export const DEFAULT_PLATFORM_FEE_PERCENT = 5;

/** Resolve the fee percentage for a seller. Falls back to the per-seller fee. */
export async function getPlatformFeePercent(
  admin: any,
  sellerId: string,
): Promise<number> {
  const { data, error } = await admin.rpc('dkai_effective_platform_fee_percent', {
    _seller_id: sellerId,
  });

  if (!error && data !== null && data !== undefined && !Number.isNaN(Number(data))) {
    return clampPercent(Number(data));
  }

  // Defensive fallback: if the RPC is unavailable we must NOT silently charge 0.
  const { data: profile } = await admin
    .from('dkai_profiles')
    .select('platform_fee_percent')
    .eq('id', sellerId)
    .maybeSingle();

  return clampPercent(Number(profile?.platform_fee_percent ?? DEFAULT_PLATFORM_FEE_PERCENT));
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value) || value < 0) return DEFAULT_PLATFORM_FEE_PERCENT;
  return Math.max(0, Math.min(100, value));
}
