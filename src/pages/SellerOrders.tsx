import { useQuery, useMutation } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, MessageCircle, CheckCircle, Package, Bell } from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { SellerSidebar } from '@/components/SellerSidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export default function SellerOrders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { hasRole: isSeller, isLoading: roleLoading } = useHasRole('seller');

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ['seller-orders', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await db
        .from('dkai_orders')
        .select(`
          *,
          products!inner(
            seller_id,
            title,
            price
          )
        `)
        .eq('products.seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch buyer profiles separately
      if (data && data.length > 0) {
        const buyerIds = data.map(o => o.buyer_id);
        const { data: profiles } = await db
          .from('profiles')
          .select('id, full_name, avatar_url, username')
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

  const markDelivered = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await db
        .from('dkai_orders')
        .update({ 
          seller_marked_delivered_at: new Date().toISOString(),
          status: 'awaiting_buyer_confirmation'
        })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Order marked as delivered');
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to mark as delivered');
    },
  });

  const nudgeBuyer = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await db.functions.invoke('nudge-buyer-confirmation', {
        body: { orderId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Reminder sent to buyer (${data.nudgeCount}/3)`);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send reminder');
    },
  });

  const handleMarkInvoiceSent = async (orderId: string) => {
    try {
      const { error } = await db
        .from('dkai_orders')
        .update({ status: 'invoice_sent' })
        .eq('id', orderId);

      if (error) throw error;

      toast.success('Order marked as invoice sent');
      refetch();
    } catch (error: any) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order status');
    }
  };

  if (roleLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSeller) {
    return <Navigate to="/" replace />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <SellerSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b bg-card/50 backdrop-blur-sm flex items-center px-6 sticky top-0 z-10">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-xl font-bold">My Orders</h1>
          </header>

          <main className="flex-1 overflow-auto">
            <div className="container mx-auto px-6 py-8 max-w-7xl">
              <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">Order Management</h1>
                <p className="text-muted-foreground">
                  Manage all your product orders and communicate with buyers
                </p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>All Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center py-12">
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
                          <TableHead>Escrow</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order: any) => {
                          const buyer = order.buyer_profile;
                          return (
                            <TableRow key={order.id}>
                              <TableCell className="font-mono text-xs">
                                {order.id.slice(0, 8)}...
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {order.products?.title || 'N/A'}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={buyer?.avatar_url || undefined} />
                                    <AvatarFallback>
                                      {buyer?.full_name?.[0] || buyer?.username?.[0] || 'B'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium text-sm">
                                      {buyer?.full_name || buyer?.username || 'Unknown'}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="font-semibold">
                                ${Number(order.price).toFixed(2)}
                              </TableCell>
                              <TableCell>
                                <Badge variant={order.escrow_status === 'held' ? 'secondary' : order.escrow_status === 'released' ? 'default' : 'outline'}>
                                  {order.escrow_status || 'pending'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    order.status === 'completed'
                                      ? 'default'
                                      : order.status === 'invoice_sent'
                                      ? 'secondary'
                                      : 'outline'
                                  }
                                >
                                  {order.status === 'awaiting_invoice' && 'Awaiting Invoice'}
                                  {order.status === 'invoice_sent' && 'Invoice Sent'}
                                  {order.status === 'completed' && 'Completed'}
                                  {order.status === 'cancelled' && 'Cancelled'}
                                  {!['awaiting_invoice', 'invoice_sent', 'completed', 'cancelled'].includes(order.status) && order.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(order.created_at), {
                                  addSuffix: true,
                                })}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate(`/messages?seller=${buyer?.id}`)}
                                  >
                                    <MessageCircle className="h-4 w-4" />
                                  </Button>
                                  {order.status === 'awaiting_invoice' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleMarkInvoiceSent(order.id)}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      Mark Sent
                                    </Button>
                                  )}
                                  {(order.status === 'payment_confirmed' || order.status === 'paid') && !order.seller_marked_delivered_at && (
                                    <Button
                                      variant="default"
                                      size="sm"
                                      onClick={() => markDelivered.mutate(order.id)}
                                      disabled={markDelivered.isPending}
                                    >
                                      <Package className="h-4 w-4 mr-1" />
                                      Mark Delivered
                                    </Button>
                                  )}
                                  {/* Nudge buyer button - shown when awaiting confirmation or escrow held/delivered */}
                                  {(order.status === 'awaiting_buyer_confirmation' || 
                                    (order.seller_marked_delivered_at && !order.buyer_confirmed_at && order.escrow_status !== 'released')) && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => nudgeBuyer.mutate(order.id)}
                                      disabled={nudgeBuyer.isPending || (order.seller_nudge_count || 0) >= 3}
                                      title={
                                        (order.seller_nudge_count || 0) >= 3
                                          ? 'Maximum reminders sent. Contact support@dkaimarketplace.com'
                                          : `Send reminder to buyer (${order.seller_nudge_count || 0}/3 sent)`
                                      }
                                    >
                                      <Bell className="h-4 w-4 mr-1" />
                                      Nudge ({order.seller_nudge_count || 0}/3)
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground mb-4">No orders yet</p>
                      <Button asChild>
                        <Link to="/create-product">Create Your First Product</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
