/**
 * Delivery tier recommendation — single source of truth.
 *
 * IMPORTANT: This logic is mirrored byte-for-byte in
 * `supabase/functions/compute-delivery-recommendation/index.ts`.
 * If you change one, change the other.
 */

export type DeliveryTier = 'tier1' | 'tier2' | 'tier3';

export interface DeliveryThresholds {
  price_tier2_min: number;
  price_tier3_min: number;
  sales_tier2_max: number;
  sales_tier3_max: number;
  size_tier2_min: number;
  size_tier3_min: number;
}

export const DEFAULT_THRESHOLDS: DeliveryThresholds = {
  price_tier2_min: 1000,
  price_tier3_min: 10000,
  sales_tier2_max: 100,
  sales_tier3_max: 20,
  size_tier2_min: 524_288_000,        // 500 MB
  size_tier3_min: 5_368_709_120,      // 5 GB
};

export interface RecommendationInput {
  price: number;                   // CHF
  max_sales: number | null;        // null = unlimited
  file_size_bytes: number;         // 0 if not yet uploaded / seller-side
}

export interface RecommendationResult {
  recommended: DeliveryTier;
  reason: string;
  scores: { price: 1 | 2 | 3; scarcity: 1 | 2 | 3; size: 1 | 2 | 3 };
  triggers: Array<'price' | 'scarcity' | 'size'>;
}

const TIER_LABEL: Record<DeliveryTier, string> = {
  tier1: 'Instant Delivery',
  tier2: 'Protected Delivery',
  tier3: 'Direct Seller Delivery',
};

export function tierLabel(t: DeliveryTier): string {
  return TIER_LABEL[t];
}

function formatCHF(n: number): string {
  return `CHF ${n.toLocaleString('de-CH')}`;
}

function formatBytes(b: number): string {
  if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(b % 1_073_741_824 === 0 ? 0 : 1)} GB`;
  if (b >= 1_048_576) return `${Math.round(b / 1_048_576)} MB`;
  return `${b} bytes`;
}

export function computeRecommendation(
  input: RecommendationInput,
  thresholds: DeliveryThresholds = DEFAULT_THRESHOLDS
): RecommendationResult {
  const price = Number.isFinite(input.price) ? input.price : 0;
  const fileSize = Number.isFinite(input.file_size_bytes) ? input.file_size_bytes : 0;
  const maxSales = input.max_sales;

  // Price score
  let priceScore: 1 | 2 | 3;
  if (price <= thresholds.price_tier2_min) priceScore = 1;
  else if (price <= thresholds.price_tier3_min) priceScore = 2;
  else priceScore = 3;

  // Scarcity score
  let scarcityScore: 1 | 2 | 3;
  if (maxSales == null || maxSales > thresholds.sales_tier2_max) scarcityScore = 1;
  else if (maxSales < thresholds.sales_tier3_max) scarcityScore = 3;
  else scarcityScore = 2; // between sales_tier3_max and sales_tier2_max (inclusive upper)

  // Size score
  let sizeScore: 1 | 2 | 3;
  if (fileSize <= thresholds.size_tier2_min) sizeScore = 1;
  else if (fileSize <= thresholds.size_tier3_min) sizeScore = 2;
  else sizeScore = 3;

  const scores = { price: priceScore, scarcity: scarcityScore, size: sizeScore };
  const maxScore = Math.max(priceScore, scarcityScore, sizeScore) as 1 | 2 | 3;

  // Combination bump: 2+ factors scoring 2 => tier3
  const twosCount = [priceScore, scarcityScore, sizeScore].filter((s) => s === 2).length;
  let recommendedScore: 1 | 2 | 3 = maxScore;
  let bumped = false;
  if (maxScore === 2 && twosCount >= 2) {
    recommendedScore = 3;
    bumped = true;
  }

  const recommended: DeliveryTier =
    recommendedScore === 3 ? 'tier3' : recommendedScore === 2 ? 'tier2' : 'tier1';

  // Triggers = factors with the highest individual score
  const triggers: Array<'price' | 'scarcity' | 'size'> = [];
  (['price', 'scarcity', 'size'] as const).forEach((k) => {
    if (scores[k] === maxScore && maxScore >= 2) triggers.push(k);
  });

  // Build reason — mention the strongest single factor (or bump note)
  let reason: string;
  if (recommended === 'tier1') {
    reason = 'Standard delivery is fine for products at this price, availability, and file size.';
  } else {
    const tierName = tierLabel(recommended);
    const parts: string[] = [];
    if (triggers.includes('price')) {
      const threshold = priceScore === 3 ? thresholds.price_tier3_min : thresholds.price_tier2_min;
      parts.push(`price is above ${formatCHF(threshold)}`);
    }
    if (triggers.includes('scarcity') && maxSales != null) {
      if (scarcityScore === 3) parts.push(`this is a limited edition (fewer than ${thresholds.sales_tier3_max} sales)`);
      else parts.push(`limited availability (max ${maxSales} sales)`);
    }
    if (triggers.includes('size')) {
      const threshold = sizeScore === 3 ? thresholds.size_tier3_min : thresholds.size_tier2_min;
      parts.push(`the file is larger than ${formatBytes(threshold)}`);
    }
    const because = parts[0] ?? 'of elevated risk factors';
    const bumpNote = bumped ? ' Multiple medium-risk factors raised the recommendation.' : '';
    reason = `Recommended ${tierName} because ${because}.${bumpNote}`;
  }

  return { recommended, reason, scores, triggers };
}

export function tierRank(t: DeliveryTier): 1 | 2 | 3 {
  return t === 'tier3' ? 3 : t === 'tier2' ? 2 : 1;
}

export function isDownTier(chosen: DeliveryTier, recommended: DeliveryTier): boolean {
  return tierRank(chosen) < tierRank(recommended);
}
