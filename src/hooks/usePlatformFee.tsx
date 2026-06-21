import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/dkaiDb';

const DEFAULT_SELLER_FEE = 5;
export const LAUNCH_PROMO_SALES_LIMIT = 20;

/**
 * SINGLE SOURCE OF TRUTH for the platform fee shown in the UI and used in
 * code. The displayed % and the % actually charged at checkout are derived
 * from the same logic so they can never disagree.
 *
 * Rule:
 *  - While total completed sales on the platform are < 20:
 *      effective fee = 0%   (launch promo — sellers keep 100%)
 *  - After 20 completed sales:
 *      effective fee = dkai_profiles.platform_fee_percent (default 5%)
 *
 * The same rule is enforced server-side in the `create-checkout-session`
 * edge function so the actual money charged matches the copy.
 */
export function usePlatformFee() {
  const { user } = useAuth();
  const [sellerFeePct, setSellerFeePct] = useState<number>(DEFAULT_SELLER_FEE);
  const [launchSalesUsed, setLaunchSalesUsed] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Live platform-wide completed sales count (counts all completed
        // orders across all sellers). Uses head+exact for a count-only query.
        const { count } = await db
          .from('dkai_orders')
          .select('id', { count: 'exact', head: true })
          .in('status', ['completed', 'delivered', 'released']);
        if (!cancelled && typeof count === 'number') {
          setLaunchSalesUsed(count);
        }
      } catch {
        /* keep 0 */
      }

      if (user) {
        try {
          const { data } = await db
            .from('dkai_profiles')
            .select('platform_fee_percent')
            .eq('id', user.id)
            .maybeSingle();
          if (!cancelled && data?.platform_fee_percent != null) {
            setSellerFeePct(Number(data.platform_fee_percent));
          }
        } catch {
          /* keep default */
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const launchPromoActive = launchSalesUsed < LAUNCH_PROMO_SALES_LIMIT;
  const effectiveFeePct = launchPromoActive ? 0 : sellerFeePct;
  const sellerPct = Math.max(0, 100 - effectiveFeePct);

  const feeDisplay = launchPromoActive
    ? `0% fee — zero platform fees (${launchSalesUsed} / ${LAUNCH_PROMO_SALES_LIMIT} launch sales used)`
    : `${effectiveFeePct}% platform fee`;

  const promoBanner = launchPromoActive
    ? `Launch promo: sellers keep 100% of every sale for the first ${LAUNCH_PROMO_SALES_LIMIT} sales on the platform (${launchSalesUsed} / ${LAUNCH_PROMO_SALES_LIMIT} used).`
    : '';

  return {
    // effective values — what UI should display and what is actually charged
    feePct: effectiveFeePct,
    sellerPct,
    // raw seller fee that will apply after the promo ends
    sellerFeePct,
    // promo state
    launchPromoActive,
    launchSalesUsed,
    launchSalesLimit: LAUNCH_PROMO_SALES_LIMIT,
    // ready-made copy
    feeDisplay,
    promoBanner,
    loading,
  };
}
