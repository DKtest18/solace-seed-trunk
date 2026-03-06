import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProductAnalytics {
  product_id: string;
  total_views: number;
  total_clicks: number;
  total_purchases: number;
  conversion_rate: number;
  click_through_rate: number;
}

export function useProductAnalytics(productId: string | undefined) {
  return useQuery({
    queryKey: ['product-analytics', productId],
    queryFn: async () => {
      if (!productId) return null;

      // Get views
      const { count: viewCount } = await supabase
        .from('dkai_product_analytics')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', productId)
        .eq('event_type', 'view');

      // Get clicks
      const { count: clickCount } = await supabase
        .from('dkai_product_analytics')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', productId)
        .eq('event_type', 'click');

      // Get purchases from orders table
      const { count: purchaseCount } = await supabase
        .from('dkai_orders')
        .select('*', { count: 'exact', head: true })
        .eq('product_id', productId)
        .in('status', ['completed', 'delivered', 'payment_confirmed']);

      const views = viewCount || 0;
      const clicks = clickCount || 0;
      const purchases = purchaseCount || 0;

      const analytics: ProductAnalytics = {
        product_id: productId,
        total_views: views,
        total_clicks: clicks,
        total_purchases: purchases,
        conversion_rate: views > 0 ? (purchases / views) * 100 : 0,
        click_through_rate: views > 0 ? (clicks / views) * 100 : 0,
      };

      return analytics;
    },
    enabled: !!productId,
  });
}

export function useAllProductsAnalytics(sellerId: string | undefined) {
  return useQuery({
    queryKey: ['all-products-analytics', sellerId],
    queryFn: async () => {
      if (!sellerId) return [];

      // Get all seller's products
      const { data: products } = await supabase
        .from('dkai_products')
        .select('id, title')
        .eq('seller_id', sellerId);

      if (!products) return [];

      // Get analytics for each product
      const analyticsPromises = products.map(async (product) => {
        const { count: viewCount } = await supabase
        .from('dkai_product_analytics')
          .select('*', { count: 'exact', head: true })
          .eq('product_id', product.id)
          .eq('event_type', 'view');

        const { count: clickCount } = await supabase
          .from('dkai_product_analytics')
          .select('*', { count: 'exact', head: true })
          .eq('product_id', product.id)
          .eq('event_type', 'click');

        const { count: purchaseCount } = await supabase
          .from('dkai_orders')
          .select('*', { count: 'exact', head: true })
          .eq('product_id', product.id)
          .in('status', ['completed', 'delivered', 'payment_confirmed']);

        const views = viewCount || 0;
        const clicks = clickCount || 0;
        const purchases = purchaseCount || 0;

        return {
          product_id: product.id,
          product_title: product.title,
          total_views: views,
          total_clicks: clicks,
          total_purchases: purchases,
          conversion_rate: views > 0 ? (purchases / views) * 100 : 0,
          click_through_rate: views > 0 ? (clicks / views) * 100 : 0,
        };
      });

      return Promise.all(analyticsPromises);
    },
    enabled: !!sellerId,
  });
}
