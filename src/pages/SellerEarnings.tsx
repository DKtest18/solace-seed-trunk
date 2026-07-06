import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, DollarSign, TrendingUp, ShoppingCart, CreditCard, Lock, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const PAID = ['paid', 'completed', 'delivered', 'released', 'payment_confirmed'];

export default function SellerEarnings() {
  const { user } = useAuth();
  const { hasRole: isSeller, isLoading: roleLoading } = useHasRole('seller');
  const { hasRole: isAdmin } = useHasRole('admin');
  const [timeRange] = useState('all');

  // Real balance from Stripe Connect
  const { data: stripeBalance } = useQuery({
    queryKey: ['stripe-balance', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('stripe-connect-balance');
      if (error) throw error;
      return data as {
        available: { amount: number; currency: string }[];
        pending: { amount: number; currency: string }[];
        held?: { amount: number; currency: string }[];
        payouts?: any[];
        balance_transactions?: any[];
      };
    },
    enabled: !!user && (isSeller || isAdmin),
    retry: false,
  });

  const fmt = (arr?: { amount: number; currency: string }[]) => {
    if (!arr || arr.length === 0) return '$0.00';
    const t = arr[0];
    return `${t.currency.toUpperCase()} ${t.amount.toFixed(2)}`;
  };
  const balance = {
    available_balance: stripeBalance?.available?.[0]?.amount ?? 0,
    held_balance: stripeBalance?.held?.[0]?.amount ?? 0,
    pending_balance: stripeBalance?.pending?.[0]?.amount ?? 0,
  };

  // Fetch seller's products and sales
  const { data: salesData, isLoading } = useQuery({
    queryKey: ['seller-earnings', user?.id, timeRange],
    queryFn: async () => {
      if (!user) return null;

      // Get all seller's products
      const { data: products, error: productsError } = await db
        .from('dkai_products')
        .select('id, title, product_type, price')
        .eq('seller_id', user.id);

      if (productsError) throw productsError;

      // Get all purchases for these products
      const { data: purchases, error: purchasesError } = await db
        .from('dkai_orders')
        .select('*')
        .eq('seller_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (purchasesError) throw purchasesError;

      // Calculate metrics
      const totalRevenue = purchases.reduce((sum, p) => sum + Number(p.amount), 0);
      const pendingRevenue = 0; // Placeholder for future payout logic
      const totalSales = purchases.length;
      const averageSale = totalSales > 0 ? totalRevenue / totalSales : 0;

      // Revenue by month (last 6 months)
      const monthlyRevenue = new Map<string, number>();
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        monthlyRevenue.set(monthKey, 0);
      }

      purchases.forEach((purchase) => {
        const date = new Date(purchase.created_at || '');
        const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        if (monthlyRevenue.has(monthKey)) {
          monthlyRevenue.set(monthKey, monthlyRevenue.get(monthKey)! + Number(purchase.amount));
        }
      });

      const monthlyData = Array.from(monthlyRevenue.entries()).map(([month, revenue]) => ({
        month,
        revenue: Number(revenue.toFixed(2)),
      }));

      // Revenue by product type
      const revenueByType = new Map<string, number>();
      purchases.forEach((purchase) => {
        const product = products.find(p => p.id === purchase.product_id);
        if (product) {
          const type = product.product_type;
          revenueByType.set(type, (revenueByType.get(type) || 0) + Number(purchase.amount));
        }
      });

      const typeData = Array.from(revenueByType.entries()).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: Number(value.toFixed(2)),
      }));

      return {
        totalRevenue,
        pendingRevenue,
        totalSales,
        averageSale,
        monthlyData,
        typeData,
        transactions: purchases,
        products,
      };
    },
    enabled: !!user && (isSeller || isAdmin),
  });

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))'];

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSeller && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold">Seller Earnings</h1>
          </div>
          <p className="text-muted-foreground">
            Track your revenue, transactions, and payout status
          </p>
        </div>

        {/* Overview Cards - Show actual balances */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">${(balance?.available_balance || 0).toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">Ready for withdrawal</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Held Balance</CardTitle>
              <Lock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(balance?.held_balance || 0).toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">Held until delivery</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Balance</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(balance?.pending_balance || 0).toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">Payment pending</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{salesData?.totalSales || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Completed transactions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Sale</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(salesData?.averageSale || 0).toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">Per transaction</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="charts" className="space-y-6">
          <TabsList>
            <TabsTrigger value="charts">Revenue Charts</TabsTrigger>
            <TabsTrigger value="transactions">Transaction History</TabsTrigger>
          </TabsList>

          <TabsContent value="charts" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Revenue Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Revenue</CardTitle>
                  <CardDescription>Revenue trend over the last 6 months</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={salesData?.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Revenue by Product Type */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Product Type</CardTitle>
                  <CardDescription>Distribution of earnings across product categories</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={salesData?.typeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: $${value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {salesData?.typeData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>All your completed sales</CardDescription>
              </CardHeader>
              <CardContent>
                {salesData?.transactions && salesData.transactions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Transaction ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesData.transactions.map((transaction) => {
                        const product = salesData.products.find(p => p.id === transaction.product_id);
                        return (
                          <TableRow key={transaction.id}>
                            <TableCell>
                              {new Date(transaction.created_at || '').toLocaleDateString()}
                            </TableCell>
                            <TableCell>{product?.title || 'Unknown Product'}</TableCell>
                            <TableCell className="font-medium">
                              ${Number(transaction.amount).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="default">{transaction.status}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {transaction.stripe_payment_intent_id || transaction.id.slice(0, 8)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No transactions yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
