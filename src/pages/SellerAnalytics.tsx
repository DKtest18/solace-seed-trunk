import { useState, lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/dkaiDb';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Eye, Users, CheckCircle, CreditCard, TrendingUp, DollarSign, Percent, Calendar, Star, ShoppingCart, MessageSquare, Package } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { SellerSidebar } from '@/components/SellerSidebar';
import { useHasRole } from '@/hooks/useUserRole';

type TimeRange = '7d' | '30d' | '90d' | '365d';

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(280, 65%, 60%)'];

export default function SellerAnalytics() {
  const { user } = useAuth();
  const { hasRole: isSeller } = useHasRole('seller');
  const { hasRole: isAdmin } = useHasRole('admin');
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  const getDays = (range: TimeRange) => range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
  const start = startOfDay(subDays(new Date(), getDays(timeRange)));
  const end = endOfDay(new Date());

  // Product sales analytics
  const { data: productSales, isLoading: salesLoading } = useQuery({
    queryKey: ['deep-product-sales', user?.id, timeRange],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: products } = await db.from('dkai_products').select('id, title, price, pricing_model').eq('seller_id', user.id);
      if (!products?.length) return { products: [], totals: { sales: 0, revenue: 0, avgPrice: 0 } };

      const productIds = products.map((p: any) => p.id);
      const { data: orders } = await db.from('dkai_orders').select('product_id, price, seller_earnings, status, created_at')
        .in('product_id', productIds).gte('created_at', start.toISOString());

      const { data: analytics } = await db.from('dkai_product_analytics').select('product_id, event_type, created_at')
        .in('product_id', productIds).gte('created_at', start.toISOString());

      const productMap: Record<string, any> = {};
      products.forEach((p: any) => { productMap[p.id] = { ...p, views: 0, clicks: 0, sales: 0, revenue: 0, pending: 0 }; });

      analytics?.forEach((a: any) => {
        if (productMap[a.product_id]) {
          if (a.event_type === 'view') productMap[a.product_id].views++;
          if (a.event_type === 'click') productMap[a.product_id].clicks++;
        }
      });

      orders?.forEach((o: any) => {
        if (productMap[o.product_id]) {
          if (['paid', 'completed', 'delivered', 'released', 'payment_confirmed'].includes(o.status)) {
            productMap[o.product_id].sales++;
            productMap[o.product_id].revenue += Number(o.seller_earnings || o.price || 0);
          } else if (['pending', 'processing'].includes(o.status)) {
            productMap[o.product_id].pending++;
          }
        }
      });

      const sorted = Object.values(productMap).sort((a: any, b: any) => b.revenue - a.revenue);
      const totalSales = sorted.reduce((s: number, p: any) => s + p.sales, 0);
      const totalRevenue = sorted.reduce((s: number, p: any) => s + p.revenue, 0);

      return { products: sorted, totals: { sales: totalSales, revenue: totalRevenue, avgPrice: totalSales > 0 ? totalRevenue / totalSales : 0 } };
    },
    enabled: !!user?.id,
  });

  // Reviews analytics
  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ['deep-reviews-analytics', user?.id, timeRange],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: products } = await db.from('dkai_products').select('id').eq('seller_id', user.id);
      if (!products?.length) return { avgRating: 0, totalReviews: 0, distribution: [], recentReviews: [] };

      const productIds = products.map((p: any) => p.id);
      const { data: reviews } = await db.from('dkai_reviews').select('rating, comment, created_at, product_id')
        .in('product_id', productIds).order('created_at', { ascending: false }).limit(100);

      const filtered = reviews?.filter((r: any) => new Date(r.created_at) >= start) || [];
      const allReviews = reviews || [];

      const dist = [1, 2, 3, 4, 5].map(star => ({
        star: `${star}★`,
        count: allReviews.filter((r: any) => Math.round(r.rating) === star).length,
      }));

      const avg = allReviews.length > 0
        ? allReviews.reduce((s: number, r: any) => s + r.rating, 0) / allReviews.length
        : 0;

      return {
        avgRating: avg,
        totalReviews: allReviews.length,
        periodReviews: filtered.length,
        distribution: dist,
        recentReviews: filtered.slice(0, 5),
      };
    },
    enabled: !!user?.id,
  });


  // Daily trend for revenue
  const { data: dailyTrend, isLoading: trendLoading } = useQuery({
    queryKey: ['deep-daily-trend', user?.id, timeRange],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: products } = await db.from('dkai_products').select('id').eq('seller_id', user.id);
      if (!products?.length) return [];
      const productIds = products.map((p: any) => p.id);

      const { data: orders } = await db.from('dkai_orders').select('seller_earnings, price, created_at')
        .in('product_id', productIds).in('status', ['paid', 'completed', 'delivered', 'released', 'payment_confirmed'])
        .gte('created_at', start.toISOString()).order('created_at');

      const grouped: Record<string, number> = {};
      orders?.forEach((o: any) => {
        const key = format(new Date(o.created_at), 'MMM d');
        grouped[key] = (grouped[key] || 0) + Number(o.seller_earnings || o.price || 0);
      });
      return Object.entries(grouped).map(([date, revenue]) => ({ date, revenue }));
    },
    enabled: !!user?.id,
  });

  if (!user) {
    return <div className="container mx-auto py-8"><p className="text-muted-foreground">Please log in.</p></div>;
  }

  const isLoading = salesLoading || reviewsLoading || trendLoading;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        {(isSeller || isAdmin) && <SellerSidebar />}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b bg-card/50 backdrop-blur-sm flex items-center px-6 sticky top-0 z-10">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-xl font-bold">Deep Analytics</h1>
          </header>

          <main className="flex-1 overflow-auto">
            <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-3xl font-bold">Seller Analytics</h1>
                  <p className="text-muted-foreground">Detailed breakdown of products, reviews, and revenue</p>
                </div>
                <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                  <SelectTrigger className="w-[160px]">
                    <Calendar className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                    <SelectItem value="365d">Last year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isLoading ? (
                <div className="space-y-4">
                  {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
                </div>
              ) : (
                <Tabs defaultValue="products" className="space-y-6">
                  <TabsList>
                    <TabsTrigger value="products">Products & Sales</TabsTrigger>
                    <TabsTrigger value="reviews">Reviews</TabsTrigger>
                    
                    <TabsTrigger value="revenue">Revenue</TabsTrigger>
                  </TabsList>

                  {/* Products & Sales Tab */}
                  <TabsContent value="products" className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-2 text-muted-foreground mb-2">
                            <ShoppingCart className="h-4 w-4" />
                            <span className="text-sm">Total Sales</span>
                          </div>
                          <p className="text-3xl font-bold">{productSales?.totals.sales || 0}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-2 text-muted-foreground mb-2">
                            <DollarSign className="h-4 w-4" />
                            <span className="text-sm">Total Revenue</span>
                          </div>
                          <p className="text-3xl font-bold text-green-600">${(productSales?.totals.revenue || 0).toFixed(2)}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-2 text-muted-foreground mb-2">
                            <TrendingUp className="h-4 w-4" />
                            <span className="text-sm">Avg Order Value</span>
                          </div>
                          <p className="text-3xl font-bold">${(productSales?.totals.avgPrice || 0).toFixed(2)}</p>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle>Product Performance</CardTitle>
                        <CardDescription>Views, clicks, sales & conversion per product</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {productSales?.products && productSales.products.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>Views</TableHead>
                                <TableHead>Clicks</TableHead>
                                <TableHead>Sales</TableHead>
                                <TableHead>Pending</TableHead>
                                <TableHead>Revenue</TableHead>
                                <TableHead>Conv. Rate</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {productSales.products.map((p: any) => (
                                <TableRow key={p.id}>
                                  <TableCell className="font-medium max-w-[200px] truncate">{p.title}</TableCell>
                                  <TableCell>{p.views}</TableCell>
                                  <TableCell>{p.clicks}</TableCell>
                                  <TableCell><Badge variant="outline">{p.sales}</Badge></TableCell>
                                  <TableCell>{p.pending > 0 && <Badge className="bg-yellow-100 text-yellow-800">{p.pending}</Badge>}</TableCell>
                                  <TableCell className="font-semibold text-green-600">${p.revenue.toFixed(2)}</TableCell>
                                  <TableCell>{p.views > 0 ? ((p.sales / p.views) * 100).toFixed(1) : 0}%</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <p className="text-muted-foreground text-center py-8">No products found</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Reviews Tab */}
                  <TabsContent value="reviews" className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-2 text-muted-foreground mb-2">
                            <Star className="h-4 w-4" />
                            <span className="text-sm">Average Rating</span>
                          </div>
                          <p className="text-3xl font-bold">{(reviewsData?.avgRating || 0).toFixed(1)} <span className="text-lg text-muted-foreground">/ 5</span></p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-2 text-muted-foreground mb-2">
                            <MessageSquare className="h-4 w-4" />
                            <span className="text-sm">Total Reviews</span>
                          </div>
                          <p className="text-3xl font-bold">{reviewsData?.totalReviews || 0}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-2 text-muted-foreground mb-2">
                            <TrendingUp className="h-4 w-4" />
                            <span className="text-sm">Reviews This Period</span>
                          </div>
                          <p className="text-3xl font-bold">{reviewsData?.periodReviews || 0}</p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Rating Distribution</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={reviewsData?.distribution || []} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis type="number" />
                              <YAxis type="category" dataKey="star" width={40} />
                              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Recent Reviews</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {reviewsData?.recentReviews && reviewsData.recentReviews.length > 0 ? (
                            <div className="space-y-3">
                              {reviewsData.recentReviews.map((r: any, i: number) => (
                                <div key={i} className="p-3 bg-muted/50 rounded-lg">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1">
                                      {Array.from({ length: 5 }).map((_, s) => (
                                        <Star key={s} className={`h-3 w-3 ${s < r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                                      ))}
                                    </div>
                                    <span className="text-xs text-muted-foreground">{format(new Date(r.created_at), 'MMM d')}</span>
                                  </div>
                                  {r.comment && <p className="text-sm text-muted-foreground line-clamp-2">{r.comment}</p>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-muted-foreground text-center py-8">No reviews yet</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>


                  {/* Revenue Tab */}
                  <TabsContent value="revenue" className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Revenue Over Time</CardTitle>
                        <CardDescription>Daily earnings from completed sales</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {dailyTrend && dailyTrend.length > 0 ? (
                          <ResponsiveContainer width="100%" height={350}>
                            <LineChart data={dailyTrend}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis dataKey="date" className="text-xs" />
                              <YAxis className="text-xs" tickFormatter={(v) => `$${v}`} />
                              <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                              />
                              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <p className="text-muted-foreground text-center py-8">No revenue data for this period</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
