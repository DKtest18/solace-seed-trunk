// Shared money + subscription-label helpers used across the marketplace, product
// pages, checkout, seller listings, etc. — so the seller's chosen currency and
// recurring interval always render correctly instead of a hardcoded "$".

export function formatMoney(
  amount: number | string | null | undefined,
  currency: string | null | undefined = 'usd',
  locale?: string
): string {
  const value = Number(amount ?? 0);
  const curr = (currency || 'usd').toUpperCase();
  try {
    return new Intl.NumberFormat(locale || (typeof navigator !== 'undefined' ? navigator.language : 'en-US'), {
      style: 'currency',
      currency: curr,
    }).format(value);
  } catch {
    return `${curr} ${value.toFixed(2)}`;
  }
}

/**
 * Human label for the recurring cadence stored on a product. Handles both the
 * legacy pricing_model values ('monthly' / 'yearly') and the new
 * billing_interval + billing_interval_count pair.
 */
export function subscriptionLabel(product: {
  pricing_model?: string | null;
  billing_interval?: string | null;
  billing_interval_count?: number | null;
}): string | null {
  const pm = (product.pricing_model || '').toLowerCase();
  if (pm === 'one_time' || pm === 'onetime' || pm === '' || pm === null) {
    // legacy string 'one_time' / 'once'
    if (!product.billing_interval) return null;
  }
  const count = Math.max(1, Number(product.billing_interval_count ?? 1));
  const interval = (product.billing_interval || '').toLowerCase();

  if (interval) {
    const unit =
      interval === 'day' ? (count === 1 ? 'day' : 'days')
      : interval === 'week' ? (count === 1 ? 'week' : 'weeks')
      : interval === 'month' ? (count === 1 ? 'month' : 'months')
      : interval === 'year' ? (count === 1 ? 'year' : 'years')
      : interval;
    return count === 1 ? `per ${unit}` : `every ${count} ${unit}`;
  }
  if (pm === 'monthly') return 'per month';
  if (pm === 'yearly') return 'per year';
  if (pm === 'weekly') return 'per week';
  if (pm === 'daily') return 'per day';
  if (pm === 'recurring') return 'recurring';
  return null;
}

export function isRecurring(product: {
  pricing_model?: string | null;
  billing_interval?: string | null;
}) {
  const pm = (product.pricing_model || '').toLowerCase();
  return pm === 'recurring' || pm === 'monthly' || pm === 'yearly' || pm === 'weekly' || pm === 'daily' || !!product.billing_interval;
}

export function formatProductPrice(product: {
  price: number | string | null | undefined;
  currency?: string | null;
  pricing_model?: string | null;
  billing_interval?: string | null;
  billing_interval_count?: number | null;
}, opts: { withSuffix?: boolean } = { withSuffix: true }): string {
  const base = formatMoney(product.price, product.currency);
  if (!opts.withSuffix) return base;
  const sub = subscriptionLabel(product);
  return sub ? `${base} ${sub}` : base;
}
