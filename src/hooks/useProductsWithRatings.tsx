import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';

export function useProductsWithRatings() {
  return useQuery({
    queryKey: ['products-with-ratings'],
    queryFn: async () => {
      const { data: products, error: productsError } = await db
        .from('dkai_products')
        .select('*')
        .eq('is_published', true)
        .eq('review_status', 'approved')
        .eq('exclusive_locked', false)
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
