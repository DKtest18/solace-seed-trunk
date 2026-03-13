import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';
import { Navigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AppLayout } from '@/components/AppLayout';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, DollarSign, TrendingUp, Users, ShoppingCart, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function AdminTransactions() {
  const { user } = useAuth();
  const { hasRole: isAdmin, isLoading: roleLoading } = useHasRole('admin');

  // Fetch all orders
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => {
      const { data, error } = await db
        .from('dkai_orders')
        .select(`
          *,
          products(id, title, price, seller_id),
          payments(*)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      
      // Fetch buyer profiles separately
      if (data && data.length > 0) {
        const buyerIds = data.map(o => o.buyer_id);
        const { data: profiles } = await db
          .from('profiles')
          .select('id, full_name')
          .in('id', buyerIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]));
        
        return data.map(order => ({
          ...order,
          buyer_profile: profileMap.get(order.buyer_id)
        }));
      }
      
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch platform balance
  const { data: platformBalance } = useQuery({
    queryKey: ['platform-balance'],
    queryFn: async () => {
      const { data, error } = await db
        .from('platform_balances')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || { available_balance: 0, held_balance: 0 };
    },
    enabled: !!user,
  });

  // Fetch disputes
  const { data: disputes } = useQuery({
    queryKey: ['admin-disputes'],
    queryFn: async () => {
      const { data, error } = await db
        .from('disputes')
        .select(`
          *,
          products(title)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch buyer profiles separately
      if (data && data.length > 0) {
        const buyerIds = data.map(d => d.buyer_id);
        const { data: profiles } = await db
          .from('profiles')
          .select('id, full_name')
          .in('id', buyerIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]));
        
        return data.map(dispute => ({
          ...dispute,
          buyer_profile: profileMap.get(dispute.buyer_id)
        }));
      }
      
      return data || [];
    },
    enabled: !!user,
  });

  if (!user || roleLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const totalRevenue = orders?.reduce((sum, order) => sum + Number(order.price), 0) || 0;
  const pendingOrders = orders?.filter(o => o.status === 'awaiting_invoice').length || 0;
  const completedOrders = orders?.filter(o => o.status === 'completed').length || 0;

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Monitor all transactions, platform balance, and disputes
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Platform Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  ${Number(platformBalance?.available_balance || 0).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Held: ${Number(platformBalance?.held_balance || 0).toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Total Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  ${totalRevenue.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  All time transactions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{orders?.length || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Pending: {pendingOrders} | Completed: {completedOrders}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Disputes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">
                  {disputes?.filter(d => d.status === 'open').length || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total: {disputes?.length || 0}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Orders */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Latest 100 orders from all sellers</CardDescription>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : orders && orders.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-xs">
                          {order.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {order.products?.title || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {(order as any).buyer_profile?.full_name || 'Unknown'}
                        </TableCell>
                        <TableCell className="font-semibold">
                          ${Number(order.price).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              order.status === 'completed'
                                ? 'default'
                                : order.status === 'awaiting_invoice'
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <Button asChild variant="ghost" size="sm">
                            <Link to={`/product/${order.product_id}`}>
                              View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No transactions yet</p>
              )}
            </CardContent>
          </Card>

          {/* Disputes */}
          {disputes && disputes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Active Disputes</CardTitle>
                <CardDescription>Disputes requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dispute ID</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disputes.map((dispute) => (
                      <TableRow key={dispute.id}>
                        <TableCell className="font-mono text-xs">
                          {dispute.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>{dispute.products?.title || 'N/A'}</TableCell>
                        <TableCell>
                          {(dispute as any).buyer_profile?.full_name || 'Unknown'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {dispute.subject}
                        </TableCell>
                        <TableCell>
                          <Badge variant={dispute.status === 'open' ? 'destructive' : 'default'}>
                            {dispute.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(dispute.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <Button asChild variant="ghost" size="sm">
                            <Link to={`/disputes`}>
                              Manage
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
