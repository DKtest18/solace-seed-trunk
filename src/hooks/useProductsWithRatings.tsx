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
        .eq('approval_status', 'approved')
        .order('created_at', { ascending: false });

      if (productsError) throw productsError;

      const { data: reviews, error: reviewsError } = await db
        .from('dkai_reviews')
        .select('product_id, rating');

      if (reviewsError) throw reviewsError;

      const ratingsMap = new Map<string, { average: number; count: number }>();
      
      reviews?.forEach((review: any) => {
        const existing = ratingsMap.get(review.product_id) || { sum: 0, count: 0 };
        ratingsMap.set(review.product_id, {
          average: 0,
          count: existing.count + 1,
          ...existing,
        });
      });

      reviews?.forEach((review: any) => {
        const current = ratingsMap.get(review.product_id)!;
        const sum = (current.average * (current.count - 1)) + review.rating;
        ratingsMap.set(review.product_id, {
          average: sum / current.count,
          count: current.count,
        });
      });

      return products?.map((product: any) => ({
        ...product,
        rating: ratingsMap.get(product.id) || { average: 0, count: 0 },
      }));
    },
  });
}
