import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { REVIEW_STATUS } from '@/lib/reviewStatus';

export function useProductsWithRatings() {
  return useQuery({
    queryKey: ['products-with-ratings'],
    queryFn: async () => {
      // VISIBILITY RULE: admin-approved + published products are public for
      // both anon and authenticated visitors. Payment setup affects checkout,
      // never whether an approved listing can be discovered.
      const { data: products, error: productsError } = await db
        .from('dkai_products')
        .select('*')
        .eq('review_status', REVIEW_STATUS.APPROVED)
        .eq('is_published', true)
        // exclusive_locked is NULL on older rows — `.eq(false)` silently hid
        // them from guests. NULL must be treated as "not locked".
        .or('exclusive_locked.is.null,exclusive_locked.eq.false')
        .order('created_at', { ascending: false });

      if (productsError) throw productsError;

      // Ratings are best-effort: if anon has no read on dkai_reviews (or the
      // call fails for any reason) we still render the products with zeroed
      // ratings instead of blanking the whole marketplace.
      let ratingsMap = new Map<string, { average: number; count: number }>();
      try {
        const { data: reviews, error: reviewsError } = await db
          .from('dkai_reviews')
          .select('product_id, rating');

        if (!reviewsError && reviews) {
          const agg = new Map<string, { sum: number; count: number }>();
          reviews.forEach((r: any) => {
            const cur = agg.get(r.product_id) || { sum: 0, count: 0 };
            cur.sum += Number(r.rating) || 0;
            cur.count += 1;
            agg.set(r.product_id, cur);
          });
          agg.forEach((v, k) => {
            ratingsMap.set(k, {
              average: v.count ? v.sum / v.count : 0,
              count: v.count,
            });
          });
        }
      } catch {
        // swallow: ratings are optional for guests
      }

      return products?.map((product: any) => ({
        ...product,
        rating: ratingsMap.get(product.id) || { average: 0, count: 0 },
      })) ?? [];
    },
  });
}
