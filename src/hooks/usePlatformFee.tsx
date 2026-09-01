import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/dkaiDb';

const DEFAULT_SELLER_FEE = 5;

/** Free settled sales a founding seller gets at 0% fee. */
export const FOUNDING_FREE_SALES = 4;
/** How many accounts may hold founding status at the same time. */
export const FOUNDING_SELLER_SLOTS = 5;

/**
 * SINGLE SOURCE OF TRUTH for the platform fee shown in the UI.
 *
 * Rule (the platform-wide "first 20 sales" promo is retired):
 *  - Founding seller (max 5 accounts, granted manually by an admin):
 *      0% on their OWN first 4 SETTLED sales, then the normal per-seller fee.
 *  - Everyone else: dkai_profiles.platform_fee_percent (default 5%).
 *  - "Settled" = order completed/delivered/released and not refunded. An order
 *    that is merely 'paid' does not consume one of the 4, and a refunded order
 *    never permanently consumes one either.
 *  - The founding badge stays visible forever; after the 4 sales it is a marker
 *    only and has no fee effect.
 *
 * The identical rule is enforced server-side by the SQL function
 * `dkai_effective_platform_fee_percent`, which every payment path (Stripe and
 * PayPal) calls, so displayed copy and charged money cannot disagree.
 */
export function usePlatformFee() {
  const { user } = useAuth();
  const [sellerFeePct, setSellerFeePct] = useState<number>(DEFAULT_SELLER_FEE);
  const [effectiveFeePct, setEffectiveFeePct] = useState<number>(DEFAULT_SELLER_FEE);
  const [isFounding, setIsFounding] = useState(false);
  const [freeSalesLimit, setFreeSalesLimit] = useState(FOUNDING_FREE_SALES);
  const [settledSales, setSettledSales] = useState(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const { data } = await db
          .from('dkai_profiles')
          .select('platform_fee_percent, is_founding_seller, founding_free_sales_limit')
          .eq('id', user.id)
          .maybeSingle();
        const row = data as any;
        if (!cancelled && row) {
          const raw = row.platform_fee_percent != null
            ? Number(row.platform_fee_percent)
            : DEFAULT_SELLER_FEE;
          setSellerFeePct(Number.isFinite(raw) ? raw : DEFAULT_SELLER_FEE);
          setIsFounding(row.is_founding_seller === true);
          setFreeSalesLimit(Number(row.founding_free_sales_limit ?? FOUNDING_FREE_SALES));
        }
      } catch {
        /* keep defaults */
      }

      try {
        const { data: used } = await db.rpc('dkai_seller_settled_sales_count', {
          _seller_id: user.id,
        });
        if (!cancelled && used != null) setSettledSales(Number(used));
      } catch {
        /* keep 0 */
      }

      try {
        const { data: pct } = await db.rpc('dkai_effective_platform_fee_percent', {
          _seller_id: user.id,
        });
        if (!cancelled && pct != null) setEffectiveFeePct(Number(pct));
      } catch {
        /* fall back below */
      }

      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const freeSalesLeft = Math.max(0, freeSalesLimit - settledSales);
  const foundingFeeActive = isFounding && freeSalesLeft > 0;
  const feePct = foundingFeeActive ? 0 : effectiveFeePct;
  const sellerPct = Math.max(0, 100 - feePct);

  const feeDisplay = foundingFeeActive
    ? `0% fee — founding seller (${settledSales} / ${freeSalesLimit} free sales used)`
    : `${feePct}% platform fee`;

  const promoBanner = foundingFeeActive
    ? `Founding seller: you keep 100% of your first ${freeSalesLimit} completed sales (${freeSalesLeft} left).`
    : isFounding
      ? 'Founding seller badge active. Your 4 free sales are used — the standard platform fee now applies.'
      : '';

  return {
    // effective values — what UI displays and what is actually charged
    feePct,
    sellerPct,
    // raw seller fee that applies once the founding free sales are used
    sellerFeePct,
    // founding state
    isFounding,
    foundingFeeActive,
    settledSales,
    freeSalesLimit,
    freeSalesLeft,
    // ready-made copy
    feeDisplay,
    promoBanner,
    loading,
  };
}
