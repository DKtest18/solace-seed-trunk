import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

export type TimeRange = 'day' | 'week' | 'month' | 'year' | 'all';

export function useSellerAnalytics(sellerId: string | undefined, timeRange: TimeRange = 'all') {
  return useQuery({
    queryKey: ['seller-analytics', sellerId, timeRange],
    queryFn: async () => {
      if (!sellerId) throw new Error('Seller ID required');
      const now = new Date();
      let startDate: Date | null = null;
      switch (timeRange) {
        case 'day': startDate = new Date(now.setHours(0, 0, 0, 0)); break;
        case 'week': startDate = new Date(now.setDate(now.getDate() - 7)); break;
        case 'month': startDate = new Date(now.setMonth(now.getMonth() - 1)); break;
        case 'year': startDate = new Date(now.setFullYear(now.getFullYear() - 1)); break;
      }
      const { data, error } = await db.rpc('dkai_get_seller_analytics', {
        _seller_id: sellerId,
        _start_date: startDate?.toISOString() || null,
        _end_date: new Date().toISOString(),
      });
      if (error) throw error;
      return data?.[0] || { total_products: 0, total_views: 0, total_clicks: 0, total_purchases: 0, total_revenue: 0 };
    },
    enabled: !!sellerId,
  });
}

export function useProductAnalytics(productId: string | undefined, timeRange: TimeRange = 'all') {
  return useQuery({
    queryKey: ['product-analytics', productId, timeRange],
    queryFn: async () => {
      if (!productId) throw new Error('Product ID required');
      const now = new Date();
      let startDate: Date | null = null;
      switch (timeRange) {
        case 'day': startDate = new Date(now.setHours(0, 0, 0, 0)); break;
        case 'week': startDate = new Date(now.setDate(now.getDate() - 7)); break;
        case 'month': startDate = new Date(now.setMonth(now.getMonth() - 1)); break;
        case 'year': startDate = new Date(now.setFullYear(now.getFullYear() - 1)); break;
      }

      let analyticsQuery = db.from('dkai_product_analytics').select('event_type').eq('product_id', productId);
      if (startDate) analyticsQuery = analyticsQuery.gte('created_at', startDate.toISOString());
      const { data: analytics, error: analyticsError } = await analyticsQuery;
      if (analyticsError) throw analyticsError;

      let ordersQuery = db.from('dkai_orders').select('price, seller_earnings').eq('product_id', productId).in('status', ['completed', 'delivered', 'payment_confirmed']);
      if (startDate) ordersQuery = ordersQuery.gte('created_at', startDate.toISOString());
      const { data: orders, error: ordersError } = await ordersQuery;
      if (ordersError) throw ordersError;

      const views = analytics?.filter((a: any) => a.event_type === 'view').length || 0;
      const clicks = analytics?.filter((a: any) => a.event_type === 'click').length || 0;
      const purchaseCount = orders?.length || 0;
      const revenue = orders?.reduce((sum: number, o: any) => sum + Number(o.seller_earnings || o.price || 0), 0) || 0;
      return { views, clicks, purchases: purchaseCount, revenue };
    },
    enabled: !!productId,
  });
}

export function useSellerProducts(sellerId: string | undefined) {
  return useQuery({
    queryKey: ['seller-products', sellerId],
    queryFn: async () => {
      if (!sellerId) throw new Error('Seller ID required');
      const { data, error } = await db.from('dkai_products').select('*').eq('seller_id', sellerId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!sellerId,
  });
}

export function useAnalyticsTimeSeries(sellerId: string | undefined, timeRange: TimeRange = 'week') {
  return useQuery({
    queryKey: ['analytics-time-series', sellerId, timeRange],
    queryFn: async () => {
      if (!sellerId) throw new Error('Seller ID required');
      const now = new Date();
      let startDate: Date;
      let groupBy: 'hour' | 'day' | 'week' | 'month';
      switch (timeRange) {
        case 'day': startDate = new Date(now.setHours(0, 0, 0, 0)); groupBy = 'hour'; break;
        case 'week': startDate = new Date(now.setDate(now.getDate() - 7)); groupBy = 'day'; break;
        case 'month': startDate = new Date(now.setMonth(now.getMonth() - 1)); groupBy = 'day'; break;
        case 'year': startDate = new Date(now.setFullYear(now.getFullYear() - 1)); groupBy = 'month'; break;
        default: startDate = new Date(now.setDate(now.getDate() - 7)); groupBy = 'day';
      }

      const { data: products } = await db.from('dkai_products').select('id').eq('seller_id', sellerId);
      if (!products || products.length === 0) return [];
      const productIds = products.map((p: any) => p.id);

      const { data: analytics, error } = await db.from('dkai_product_analytics').select('event_type, created_at').in('product_id', productIds).gte('created_at', startDate.toISOString()).order('created_at');
      if (error) throw error;

      const { data: orders } = await db.from('dkai_orders').select('seller_earnings, created_at').in('product_id', productIds).in('status', ['completed', 'delivered', 'payment_confirmed', 'invoice_sent']).gte('created_at', startDate.toISOString()).order('created_at');

      const grouped: Record<string, { views: number; clicks: number; revenue: number }> = {};
      const getKey = (date: Date) => {
        switch (groupBy) {
          case 'hour': return `${date.getHours()}:00`;
          case 'day': return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          case 'month': return date.toLocaleDateString('en-US', { month: 'short' });
          default: return date.toLocaleDateString();
        }
      };

      analytics?.forEach((event: any) => {
        const key = getKey(new Date(event.created_at));
        if (!grouped[key]) grouped[key] = { views: 0, clicks: 0, revenue: 0 };
        if (event.event_type === 'view') grouped[key].views++;
        if (event.event_type === 'click') grouped[key].clicks++;
      });

      orders?.forEach((order: any) => {
        const key = getKey(new Date(order.created_at));
        if (!grouped[key]) grouped[key] = { views: 0, clicks: 0, revenue: 0 };
        grouped[key].revenue += Number(order.seller_earnings || 0);
      });

      return Object.entries(grouped).map(([date, data]) => ({ date, views: data.views, clicks: data.clicks, revenue: data.revenue }));
    },
    enabled: !!sellerId,
  });
}

export function useSellerRevenueAnalytics(sellerId: string | undefined) {
  return useQuery({
    queryKey: ['seller-revenue-analytics', sellerId],
    queryFn: async () => {
      if (!sellerId) return null;
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        months.push({ start: startOfMonth(date), end: endOfMonth(date), label: format(date, 'MMM yyyy') });
      }

      const { data: sellerProducts } = await db.from('dkai_products').select('id').eq('seller_id', sellerId);
      const productIds = sellerProducts?.map((p: any) => p.id) || [];

      const monthlyData = await Promise.all(
        months.map(async (month) => {
          if (productIds.length === 0) return { month: month.label, revenue: 0 };
          const { data } = await db.from('dkai_orders').select('seller_earnings, price').in('product_id', productIds).in('status', ['completed', 'delivered', 'payment_confirmed']).gte('created_at', month.start.toISOString()).lte('created_at', month.end.toISOString());
          const revenue = data?.reduce((sum: number, o: any) => sum + Number(o.seller_earnings || o.price || 0), 0) || 0;
          return { month: month.label, revenue };
        })
      );

      const { data: allOrders } = productIds.length > 0
        ? await db.from('dkai_orders').select('product_id, price, seller_earnings').in('product_id', productIds).in('status', ['completed', 'delivered', 'payment_confirmed'])
        : { data: [] };

      const { data: productTitles } = productIds.length > 0
        ? await db.from('dkai_products').select('id, title').in('id', productIds)
        : { data: [] };
      
      const titleMap: Record<string, string> = {};
      productTitles?.forEach((p: any) => { titleMap[p.id] = p.title; });

      const productSales: Record<string, { title: string; count: number; revenue: number }> = {};
      allOrders?.forEach((o: any) => {
        const id = o.product_id;
        if (!productSales[id]) productSales[id] = { title: titleMap[id] || 'Unknown', count: 0, revenue: 0 };
        productSales[id].count++;
        productSales[id].revenue += Number(o.seller_earnings || o.price || 0);
      });

      const bestSelling = Object.values(productSales).sort((a, b) => b.count - a.count).slice(0, 5);
      return { monthlyRevenue: monthlyData, bestSelling };
    },
    enabled: !!sellerId,
  });
}
