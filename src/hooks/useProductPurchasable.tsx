import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';

/**
 * Public (guest-safe) check whether a product can actually be bought.
 * Backed by the SECURITY DEFINER function `dkai_product_purchasable`, which
 * returns true only when the product is approved + published AND its seller has
 * a connected payout provider (Stripe or PayPal).
 *
 * Products without a connected provider stay VISIBLE in the marketplace for
 * everyone (including guests) but cannot be purchased.
 */
export function useProductPurchasable(productId?: string) {
  return useQuery({
    queryKey: ['product-purchasable', productId],
    enabled: !!productId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await db.rpc('dkai_product_purchasable', {
        p_product_id: productId,
      });
      // Fail open on transport errors so a temporary glitch never hides the
      // buy button for a properly connected seller; the edge function still
      // enforces the rule server-side.
      if (error) return true;
      return data !== false;
    },
  });
}
