import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';
import {
  useSellerAnalytics,
  useSellerProducts,
  useAnalyticsTimeSeries,
  useSellerRevenueAnalytics,
  TimeRange,
} from '@/hooks/useAnalytics';
import { useAllProductsAnalytics } from '@/hooks/useProductAnalytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ProfileCompletionIndicator } from '@/components/ProfileCompletionIndicator';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Loader2, Eye, MousePointer, ShoppingCart, DollarSign, TrendingUp, Package } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { SellerSidebar } from '@/components/SellerSidebar';
import { MessagesSidebar } from '@/components/MessagesSidebar';

export default function SellerDashboard() {
  const { user } = useAuth();
  const { hasRole: isSeller, isLoading: roleLoading } = useHasRole('seller');
  const { hasRole: isAdmin } = useHasRole('admin');
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>('month');

  const { data: analytics, isLoading: analyticsLoading } = useSellerAnalytics(user?.id, timeRange);
  const { data: products, isLoading: productsLoading } = useSellerProducts(user?.id);
  const { data: timeSeries, isLoading: timeSeriesLoading } = useAnalyticsTimeSeries(
    user?.id,
    timeRange
  );
  const { data: revenueAnalytics, isLoading: revenueLoading } = useSellerRevenueAnalytics(user?.id);
  const { data: productsAnalytics, isLoading: productsAnalyticsLoading } = useAllProductsAnalytics(user?.id);

  if (roleLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSeller && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Seller Access Required</CardTitle>
            <CardDescription>
              You need a seller account to access the dashboard. Please contact an administrator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = analyticsLoading || productsLoading || timeSeriesLoading || revenueLoading || productsAnalyticsLoading;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <SellerSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b bg-card/50 backdrop-blur-sm flex items-center px-6 sticky top-0 z-10">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-xl font-bold">Seller Dashboard</h1>
          </header>

          <main className="flex-1 overflow-auto">
            <div className="container mx-auto px-6 py-8 max-w-7xl">
              <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold mb-2">Dashboard Overview</h1>
                  <p className="text-muted-foreground">Track your product performance and earnings</p>
                </div>
                <Button asChild size="lg" className="rounded-full">
                  <Link to="/create-product">Create New Product</Link>
                </Button>
              </div>

              <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)} className="mb-8">
                <TabsList className="rounded-full">
                  <TabsTrigger value="day" className="rounded-full">Today</TabsTrigger>
                  <TabsTrigger value="week" className="rounded-full">Week</TabsTrigger>
                  <TabsTrigger value="month" className="rounded-full">Month</TabsTrigger>
                  <TabsTrigger value="year" className="rounded-full">Year</TabsTrigger>
                  <TabsTrigger value="all" className="rounded-full">All Time</TabsTrigger>
                </TabsList>
              </Tabs>

              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-8">
                  <ProfileCompletionIndicator />

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <Card className="rounded-2xl border-2 hover:border-primary/50 transition-colors">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                          <Package className="h-4 w-4" />
                          Products
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">{analytics?.total_products || 0}</div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-2 hover:border-primary/50 transition-colors">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                          <Eye className="h-4 w-4" />
                          Views
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">{analytics?.total_views || 0}</div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-2 hover:border-primary/50 transition-colors">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                          <MousePointer className="h-4 w-4" />
                          Clicks
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">{analytics?.total_clicks || 0}</div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-2 hover:border-primary/50 transition-colors">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                          <ShoppingCart className="h-4 w-4" />
                          Sales
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">{analytics?.total_purchases || 0}</div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-2 hover:border-primary/50 transition-colors">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                          <DollarSign className="h-4 w-4" />
                          Revenue
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-green-600">
                          ${Number(analytics?.total_revenue || 0).toFixed(2)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="rounded-2xl">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <TrendingUp className="h-5 w-5" />
                          Views & Clicks Over Time
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={timeSeries || []}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="views" stroke="#3b82f6" name="Views" />
                            <Line type="monotone" dataKey="clicks" stroke="#8b5cf6" name="Clicks" />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card className="rounded-2xl">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <DollarSign className="h-5 w-5" />
                          Revenue Over Time
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={timeSeries || []}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="revenue"
                              stroke="#10b981"
                              name="Revenue"
                              strokeWidth={2}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="rounded-2xl">
                    <CardHeader>
                      <CardTitle>Engagement Metrics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          data={[
                            {
                              name: 'Metrics',
                              Views: analytics?.total_views || 0,
                              Clicks: analytics?.total_clicks || 0,
                              Sales: analytics?.total_purchases || 0,
                            },
                          ]}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="Views" fill="#3b82f6" />
                          <Bar dataKey="Clicks" fill="#8b5cf6" />
                          <Bar dataKey="Sales" fill="#10b981" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl">
                    <CardHeader>
                      <CardTitle>Monthly Revenue Trend</CardTitle>
                      <CardDescription>Last 6 months</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={revenueAnalytics?.monthlyRevenue || []}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="revenue"
                            stroke="#10b981"
                            name="Revenue"
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {revenueAnalytics?.bestSelling && revenueAnalytics.bestSelling.length > 0 && (
                    <Card className="rounded-2xl">
                      <CardHeader>
                        <CardTitle>Best Selling Products</CardTitle>
                        <CardDescription>Top 5 products by sales volume</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Product</TableHead>
                              <TableHead>Sales</TableHead>
                              <TableHead>Revenue</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {revenueAnalytics.bestSelling.map((product, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium">{product.title}</TableCell>
                                <TableCell>{product.count}</TableCell>
                                <TableCell>${product.revenue.toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  <Card className="rounded-2xl">
                    <CardHeader>
                      <CardTitle>Your Products</CardTitle>
                      <CardDescription>Manage and track individual product performance</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {products && products.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Product</TableHead>
                              <TableHead>Price</TableHead>
                              <TableHead>Views</TableHead>
                              <TableHead>Clicks</TableHead>
                              <TableHead>Sales</TableHead>
                              <TableHead>Conv. Rate</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {products.map((product) => {
                              const analytics = productsAnalytics?.find(a => a.product_id === product.id);
                              return (
                                <TableRow key={product.id}>
                                  <TableCell className="font-medium max-w-[200px] truncate">
                                    {product.title}
                                  </TableCell>
                                  <TableCell className="font-semibold">
                                    ${product.price}
                                    {product.pricing_model === 'monthly' && '/mo'}
                                    {product.pricing_model === 'yearly' && '/yr'}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Eye className="h-3 w-3 text-muted-foreground" />
                                      {analytics?.total_views || 0}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <MousePointer className="h-3 w-3 text-muted-foreground" />
                                      {analytics?.total_clicks || 0}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <ShoppingCart className="h-3 w-3 text-muted-foreground" />
                                      {analytics?.total_purchases || 0}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="rounded-full">
                                      {analytics?.conversion_rate.toFixed(1) || 0}%
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={product.is_published ? 'default' : 'secondary'}
                                      className="rounded-full"
                                    >
                                      {product.is_published ? 'Published' : 'Unpublished'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      asChild
                                      variant="outline"
                                      size="sm"
                                      className="rounded-full"
                                    >
                                      <Link to={`/edit-product/${product.id}`}>
                                        Edit
                                      </Link>
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="text-center py-12 text-muted-foreground">
                          <p className="mb-4">No products yet</p>
                          <Button asChild size="lg" className="rounded-full">
                            <Link to="/create-product">Create Your First Product</Link>
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </main>
        </div>
        <div className="hidden xl:flex w-80 flex-shrink-0 border-l bg-card">
          <MessagesSidebar />
        </div>
      </div>
    </SidebarProvider>
  );
}
