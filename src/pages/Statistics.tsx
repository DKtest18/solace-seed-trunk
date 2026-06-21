import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { db } from '@/lib/dkaiDb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Loader2, TrendingUp, DollarSign, ShoppingBag, Package, BarChart3, 
  Download, Calendar, Filter, ShieldCheck 
} from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { useHasRole } from '@/hooks/useUserRole';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area 
} from 'recharts';
import { format, subDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import { toast } from 'sonner';

// High-contrast color scheme: Green = profit, Red = costs, Blue = revenue
const CHART_COLORS = {
  revenue: '#3B82F6',    // Blue
  profit: '#22C55E',     // Green  
  costs: '#EF4444',      // Red
  sales: '#8B5CF6',      // Purple
  primary: '#6366F1',    // Indigo
  secondary: '#F59E0B',  // Amber
  neutral: '#6B7280',    // Gray
};

const PIE_COLORS = ['#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function Statistics() {
  const { t } = useTranslation();
  const { hasRole: isAdmin } = useHasRole('admin');
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  
  // Admin-only date range filters
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showAdminFilters, setShowAdminFilters] = useState(false);

  // Fetch aggregated statistics
  const { data: stats, isLoading } = useQuery({
    queryKey: ['platform-statistics', period, isAdmin ? startDate : null, isAdmin ? endDate : null],
    queryFn: async () => {
      const now = new Date();
      let queryStartDate: Date;
      
      if (isAdmin && showAdminFilters) {
        queryStartDate = startOfDay(parseISO(startDate));
      } else {
        switch (period) {
          case 'daily':
            queryStartDate = startOfDay(now);
            break;
          case 'weekly':
            queryStartDate = subDays(now, 7);
            break;
          case 'monthly':
            queryStartDate = subDays(now, 30);
            break;
        }
      }

      const queryEndDate = isAdmin && showAdminFilters 
        ? endOfDay(parseISO(endDate))
        : now;

      // Fetch orders with time-series data
      const { data: orders, error: ordersError } = await db
        .from('dkai_orders')
        .select('id, price, seller_earnings, platform_fee, created_at, status, product_id')
        .gte('created_at', queryStartDate.toISOString())
        .lte('created_at', queryEndDate.toISOString())
        .in('status', ['completed', 'payment_confirmed', 'delivered']);

      if (ordersError) throw ordersError;

      // Fetch products with categories
      const { data: products, error: productsError } = await db
        .from('dkai_products')
        .select('id, product_type, title, total_sales, trending_score, recent_7day_sales, average_rating, category_id, product_categories(name)')
        .eq('is_published', true)
        .eq('review_status', 'approved');

      if (productsError) throw productsError;

      // Fetch sellers
      const { data: sellers, error: sellersError } = await db
        .from('seller_rankings')
        .select('id')
        .limit(1000);

      if (sellersError) throw sellersError;

      // Calculate stats
      const totalSales = orders?.length || 0;
      const totalRevenue = orders?.reduce((sum, o) => sum + (o.price || 0), 0) || 0;
      const totalProfit = orders?.reduce((sum, o) => sum + (o.platform_fee || 0), 0) || 0;
      const totalCosts = totalRevenue - totalProfit; // Seller earnings = costs to platform
      const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

      // Products by type
      const productsByType = products?.reduce((acc, p) => {
        acc[p.product_type] = (acc[p.product_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Top categories
      const categoryCounts = products?.reduce((acc, p: any) => {
        const categoryName = p.product_categories?.name || 'Uncategorized';
        acc[categoryName] = (acc[categoryName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const topCategories = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      // Trending products (top 10 by 7-day sales)
      const trendingProducts = products
        ?.filter(p => p.recent_7day_sales && p.recent_7day_sales > 0)
        .sort((a, b) => (b.recent_7day_sales || 0) - (a.recent_7day_sales || 0))
        .slice(0, 10)
        .map(p => ({
          id: p.id,
          title: p.title,
          sales: p.recent_7day_sales || 0,
          rating: p.average_rating || 0,
          trendingScore: p.trending_score || 0,
        })) || [];

      // Time-series data for charts (group by date)
      const ordersByDate = orders?.reduce((acc, order) => {
        const date = format(new Date(order.created_at), 'MMM dd');
        if (!acc[date]) {
          acc[date] = { date, revenue: 0, profit: 0, costs: 0, sales: 0 };
        }
        acc[date].revenue += order.price || 0;
        acc[date].profit += order.platform_fee || 0;
        acc[date].costs += order.seller_earnings || 0;
        acc[date].sales += 1;
        return acc;
      }, {} as Record<string, { date: string; revenue: number; profit: number; costs: number; sales: number }>) || {};

      const timeSeriesData = Object.values(ordersByDate).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      return {
        totalSales,
        totalRevenue,
        totalProfit,
        totalCosts,
        avgOrderValue,
        totalProducts: products?.length || 0,
        totalSellers: sellers?.length || 0,
        productsByType,
        topCategories,
        trendingProducts,
        timeSeriesData,
        orders: orders || [],
      };
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  // Prepare chart data
  const pieData = useMemo(() => {
    if (!stats?.productsByType) return [];
    return Object.entries(stats.productsByType).map(([name, value]) => ({ name, value }));
  }, [stats?.productsByType]);

  const categoryPieData = useMemo(() => {
    return stats?.topCategories?.map(c => ({ name: c.name, value: c.count })) || [];
  }, [stats?.topCategories]);

  // CSV Export function
  const exportToCSV = () => {
    if (!stats) return;

    const csvData = [
      ['Metric', 'Value'],
      ['Total Sales', stats.totalSales.toString()],
      ['Total Revenue', `$${stats.totalRevenue.toFixed(2)}`],
      ['Platform Profit', `$${stats.totalProfit.toFixed(2)}`],
      ['Seller Earnings', `$${stats.totalCosts.toFixed(2)}`],
      ['Average Order Value', `$${stats.avgOrderValue.toFixed(2)}`],
      ['Total Products', stats.totalProducts.toString()],
      ['Total Sellers', stats.totalSellers.toString()],
      [''],
      ['Daily Breakdown'],
      ['Date', 'Revenue', 'Profit', 'Costs', 'Sales'],
      ...stats.timeSeriesData.map(d => [d.date, d.revenue.toFixed(2), d.profit.toFixed(2), d.costs.toFixed(2), d.sales.toString()]),
      [''],
      ['Top Categories'],
      ['Category', 'Products'],
      ...stats.topCategories.map(c => [c.name, c.count.toString()]),
      [''],
      ['Trending Products'],
      ['Title', '7-Day Sales', 'Rating'],
      ...stats.trendingProducts.map(p => [p.title, p.sales.toString(), p.rating.toFixed(1)]),
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `statistics_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(t('stats.exportSuccess') || 'CSV exported successfully');
  };

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.name.toLowerCase().includes('sale') ? entry.value : `$${entry.value.toFixed(2)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen">
        <div className="container mx-auto px-6 py-10 max-w-[1600px]">
          {/* Header */}
          <div className="mb-10 p-6 rounded-2xl backdrop-blur-md bg-background/80 border border-border/50">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-primary" />
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
                  {t('stats.title') || 'Platform Statistics'}
                </h1>
              </div>
              <div className="flex items-center gap-3">
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAdminFilters(!showAdminFilters)}
                    className="gap-2"
                  >
                    <Filter className="h-4 w-4" />
                    {t('stats.advancedFilters') || 'Advanced Filters'}
                  </Button>
                )}
                <Button onClick={exportToCSV} variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  {t('stats.exportCSV') || 'Export CSV'}
                </Button>
              </div>
            </div>
            {isAdmin && (
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                {t('stats.adminView') || 'Admin View - Full access to detailed statistics'}
              </div>
            )}
          </div>

          {/* Admin Date Range Filters */}
          {isAdmin && showAdminFilters && (
            <Card className="mb-6 backdrop-blur-md bg-background/80 border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {t('stats.dateRange') || 'Custom Date Range'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="space-y-2">
                    <Label>{t('stats.startDate') || 'Start Date'}</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-44"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('stats.endDate') || 'End Date'}</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-44"
                    />
                  </div>
                  <Button 
                    onClick={() => {
                      setStartDate(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
                      setEndDate(format(new Date(), 'yyyy-MM-dd'));
                    }}
                    variant="outline"
                    size="sm"
                  >
                    {t('stats.last7Days') || 'Last 7 Days'}
                  </Button>
                  <Button 
                    onClick={() => {
                      setStartDate(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
                      setEndDate(format(new Date(), 'yyyy-MM-dd'));
                    }}
                    variant="outline"
                    size="sm"
                  >
                    {t('stats.last30Days') || 'Last 30 Days'}
                  </Button>
                  <Button 
                    onClick={() => {
                      setStartDate(format(subDays(new Date(), 90), 'yyyy-MM-dd'));
                      setEndDate(format(new Date(), 'yyyy-MM-dd'));
                    }}
                    variant="outline"
                    size="sm"
                  >
                    {t('stats.last90Days') || 'Last 90 Days'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Period Tabs */}
          {!showAdminFilters && (
            <Tabs value={period} onValueChange={(v) => setPeriod(v as 'daily' | 'weekly' | 'monthly')} className="mb-6">
              <TabsList>
                <TabsTrigger value="daily">{t('stats.daily') || 'Daily'}</TabsTrigger>
                <TabsTrigger value="weekly">{t('stats.weekly') || 'Weekly'}</TabsTrigger>
                <TabsTrigger value="monthly">{t('stats.monthly') || 'Monthly'}</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <Card className="backdrop-blur-md bg-background/80 border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('stats.totalSales') || 'Total Sales'}</CardTitle>
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" style={{ color: CHART_COLORS.sales }}>{stats?.totalSales || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">{t('stats.ordersCompleted') || 'Orders completed'}</p>
              </CardContent>
            </Card>

            <Card className="backdrop-blur-md bg-background/80 border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('stats.totalRevenue') || 'Total Revenue'}</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" style={{ color: CHART_COLORS.revenue }}>
                  ${stats?.totalRevenue?.toFixed(2) || '0.00'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t('stats.grossRevenue') || 'Gross revenue'}</p>
              </CardContent>
            </Card>

            <Card className="backdrop-blur-md bg-background/80 border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('stats.platformProfit') || 'Platform Profit'}</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" style={{ color: CHART_COLORS.profit }}>
                  ${stats?.totalProfit?.toFixed(2) || '0.00'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t('stats.platformFees') || 'Platform fees collected'}</p>
              </CardContent>
            </Card>

            <Card className="backdrop-blur-md bg-background/80 border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('stats.sellerEarnings') || 'Seller Earnings'}</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" style={{ color: CHART_COLORS.costs }}>
                  ${stats?.totalCosts?.toFixed(2) || '0.00'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t('stats.paidToSellers') || '95% paid to sellers'}</p>
              </CardContent>
            </Card>

            <Card className="backdrop-blur-md bg-background/80 border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('stats.avgOrderValue') || 'Avg Order Value'}</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">${stats?.avgOrderValue?.toFixed(2) || '0.00'}</div>
                <p className="text-xs text-muted-foreground mt-1">{t('stats.perOrder') || 'Per order'}</p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue & Profit Chart */}
          <Card className="mb-8 backdrop-blur-md bg-background/80 border-border/50">
            <CardHeader>
              <CardTitle>{t('stats.revenueOverview') || 'Revenue Overview'}</CardTitle>
              <CardDescription>
                {t('stats.revenueDescription') || 'Revenue breakdown by day showing total revenue, platform profit, and seller earnings'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.timeSeriesData && stats.timeSeriesData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={stats.timeSeriesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.revenue} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={CHART_COLORS.revenue} stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.profit} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={CHART_COLORS.profit} stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCosts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.costs} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={CHART_COLORS.costs} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(val) => `$${val}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke={CHART_COLORS.revenue} 
                      fillOpacity={1} 
                      fill="url(#colorRevenue)" 
                      name={t('stats.revenue') || 'Revenue'}
                      strokeWidth={2}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="profit" 
                      stroke={CHART_COLORS.profit} 
                      fillOpacity={1} 
                      fill="url(#colorProfit)" 
                      name={t('stats.profit') || 'Profit'}
                      strokeWidth={2}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="costs" 
                      stroke={CHART_COLORS.costs} 
                      fillOpacity={1} 
                      fill="url(#colorCosts)" 
                      name={t('stats.sellerCosts') || 'Seller Earnings'}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                  {t('stats.noData') || 'No data available for this period'}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sales Bar Chart */}
          <Card className="mb-8 backdrop-blur-md bg-background/80 border-border/50">
            <CardHeader>
              <CardTitle>{t('stats.salesByDay') || 'Sales by Day'}</CardTitle>
              <CardDescription>{t('stats.salesDescription') || 'Number of orders completed each day'}</CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.timeSeriesData && stats.timeSeriesData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.timeSeriesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey="sales" 
                      fill={CHART_COLORS.sales} 
                      radius={[4, 4, 0, 0]}
                      name={t('stats.sales') || 'Sales'}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  {t('stats.noData') || 'No data available for this period'}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Product Types Pie Chart */}
            <Card className="backdrop-blur-md bg-background/80 border-border/50">
              <CardHeader>
                <CardTitle>{t('stats.productsByType') || 'Products by Type'}</CardTitle>
                <CardDescription>{t('stats.productTypeDescription') || 'Distribution of product types on the marketplace'}</CardDescription>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    {t('stats.noData') || 'No data available'}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Categories Pie Chart */}
            <Card className="backdrop-blur-md bg-background/80 border-border/50">
              <CardHeader>
                <CardTitle>{t('stats.topCategories') || 'Top Categories'}</CardTitle>
                <CardDescription>{t('stats.categoryDescription') || 'Most popular product categories'}</CardDescription>
              </CardHeader>
              <CardContent>
                {categoryPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categoryPieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categoryPieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    {t('stats.noCategories') || 'No category data available'}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Trending Products & Platform Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Trending Products */}
            <Card className="backdrop-blur-md bg-background/80 border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" style={{ color: CHART_COLORS.profit }} />
                  {t('stats.trendingProducts') || 'Trending Products'}
                </CardTitle>
                <CardDescription>{t('stats.trendingDescription') || 'Top performing products by 7-day sales'}</CardDescription>
              </CardHeader>
              <CardContent>
                {stats?.trendingProducts && stats.trendingProducts.length > 0 ? (
                  <div className="space-y-3">
                    {stats.trendingProducts.map((product, index) => (
                      <div key={product.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>
                          <div>
                            <p className="font-medium text-foreground line-clamp-1">{product.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {product.sales} {t('stats.salesLast7Days') || 'sales (7d)'} • ⭐ {product.rating.toFixed(1)}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-medium" style={{ color: CHART_COLORS.profit }}>
                          +{product.sales}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    {t('stats.noTrending') || 'No trending products'}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Platform Summary */}
            <Card className="backdrop-blur-md bg-background/80 border-border/50">
              <CardHeader>
                <CardTitle>{t('stats.platformSummary') || 'Platform Summary'}</CardTitle>
                <CardDescription>{t('stats.summaryDescription') || 'Overview of marketplace activity'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-muted-foreground">{t('stats.activeSellers') || 'Active Sellers'}</span>
                  <span className="font-bold">{stats?.totalSellers || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                  <span className="text-muted-foreground">{t('stats.totalProducts') || 'Total Products'}</span>
                  <span className="font-bold">{stats?.totalProducts || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: `${CHART_COLORS.profit}15` }}>
                  <span style={{ color: CHART_COLORS.profit }}>{t('stats.platformEarnings') || 'Platform Earnings'}</span>
                  <span className="font-bold" style={{ color: CHART_COLORS.profit }}>${stats?.totalProfit?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: `${CHART_COLORS.revenue}15` }}>
                  <span style={{ color: CHART_COLORS.revenue }}>{t('stats.avgOrderValue') || 'Average Order Value'}</span>
                  <span className="font-bold" style={{ color: CHART_COLORS.revenue }}>${stats?.avgOrderValue?.toFixed(2) || '0.00'}</span>
                </div>
                {isAdmin && (
                  <>
                    <div className="border-t border-border my-4" />
                    <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: `${CHART_COLORS.costs}15` }}>
                      <span style={{ color: CHART_COLORS.costs }}>{t('stats.totalPayouts') || 'Total Payouts (Sellers)'}</span>
                      <span className="font-bold" style={{ color: CHART_COLORS.costs }}>${stats?.totalCosts?.toFixed(2) || '0.00'}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
