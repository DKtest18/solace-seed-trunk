import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import { useHasRole } from '@/hooks/useUserRole';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { 
  Loader2, ShieldCheck, DollarSign, Clock, CheckCircle, XCircle, 
  AlertTriangle, RefreshCw, Lock, Unlock, ArrowRight 
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

type EscrowStatus = 'pending' | 'held' | 'delivered' | 'released' | 'refunded';

interface Order {
  id: string;
  buyer_id: string;
  product_id: string;
  price: number;
  status: string;
  escrow_status: EscrowStatus;
  held_amount: number | null;
  platform_fee: number | null;
  seller_earnings: number | null;
  payment_method: string | null;
  buyer_confirmed_at: string | null;
  refund_deadline: string | null;
  auto_confirm_deadline: string | null;
  released_at: string | null;
  created_at: string;
  products: { title: string; seller_id: string };
  buyer: { username: string; email: string } | null;
}

const escrowStatusConfig: Record<EscrowStatus, { color: string; icon: React.ElementType; label: string }> = {
  pending: { color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30', icon: Clock, label: 'Pending' },
  held: { color: 'bg-blue-500/10 text-blue-600 border-blue-500/30', icon: Lock, label: 'Held' },
  delivered: { color: 'bg-purple-500/10 text-purple-600 border-purple-500/30', icon: CheckCircle, label: 'Delivered' },
  released: { color: 'bg-green-500/10 text-green-600 border-green-500/30', icon: Unlock, label: 'Released' },
  refunded: { color: 'bg-red-500/10 text-red-600 border-red-500/30', icon: XCircle, label: 'Refunded' },
};

export default function EscrowManagement() {
  const { t } = useTranslation();
  const { hasRole: isAdmin, isLoading: roleLoading } = useHasRole('admin');
  const queryClient = useQueryClient();
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [actionType, setActionType] = useState<'release' | 'refund' | 'hold' | null>(null);
  const [reason, setReason] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch orders with escrow data
  const { data: orders, isLoading } = useQuery({
    queryKey: ['escrow-orders', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select(`
          *,
          products(title, seller_id),
          buyer:profiles!orders_buyer_id_fkey(username, email)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('escrow_status', statusFilter);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data as unknown as Order[];
    },
    enabled: isAdmin,
  });

  // Fetch escrow stats
  const { data: stats } = useQuery({
    queryKey: ['escrow-stats'],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from('orders')
        .select('escrow_status, held_amount, price')
        .in('escrow_status', ['held', 'delivered', 'pending']);

      const held = orders?.filter(o => o.escrow_status === 'held' || o.escrow_status === 'delivered') || [];
      const pending = orders?.filter(o => o.escrow_status === 'pending') || [];

      return {
        totalHeld: held.reduce((sum, o) => sum + (o.held_amount || o.price || 0), 0),
        heldCount: held.length,
        pendingCount: pending.length,
      };
    },
    enabled: isAdmin,
  });

  // Admin action mutation
  const escrowAction = useMutation({
    mutationFn: async ({ orderId, action, reason }: { orderId: string; action: string; reason: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-escrow-action', {
        body: { orderId, action, reason }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Escrow ${data.action} successful`);
      queryClient.invalidateQueries({ queryKey: ['escrow-orders'] });
      queryClient.invalidateQueries({ queryKey: ['escrow-stats'] });
      setSelectedOrder(null);
      setActionType(null);
      setReason('');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Action failed');
    }
  });

  const handleAction = () => {
    if (!selectedOrder || !actionType) return;
    escrowAction.mutate({ orderId: selectedOrder.id, action: actionType, reason });
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="container mx-auto px-6 py-10">
          <Card>
            <CardContent className="py-10 text-center">
              <ShieldCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">Admin Access Required</h2>
              <p className="text-muted-foreground">You need admin privileges to access escrow management.</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen">
        <div className="container mx-auto px-6 py-10 max-w-[1600px]">
          {/* Header */}
          <div className="mb-8 p-6 rounded-2xl backdrop-blur-md bg-background/80 border border-border/50">
            <div className="flex items-center gap-3 mb-2">
              <Lock className="h-8 w-8 text-primary" />
              <h1 className="text-4xl font-bold tracking-tight text-foreground">
                {t('escrow.title') || 'Escrow Management'}
              </h1>
            </div>
            <p className="text-muted-foreground">
              {t('escrow.subtitle') || 'Manage held funds, releases, and refunds'}
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="backdrop-blur-md bg-background/80 border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Held</CardTitle>
                <Lock className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">${stats?.totalHeld?.toFixed(2) || '0.00'}</div>
                <p className="text-xs text-muted-foreground">{stats?.heldCount || 0} orders in escrow</p>
              </CardContent>
            </Card>

            <Card className="backdrop-blur-md bg-background/80 border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Payment</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats?.pendingCount || 0}</div>
                <p className="text-xs text-muted-foreground">Awaiting payment</p>
              </CardContent>
            </Card>

            <Card className="backdrop-blur-md bg-background/80 border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Actions</CardTitle>
                <ShieldCheck className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['escrow-orders'] })}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Status Filter Tabs */}
          <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-6">
            <TabsList>
              <TabsTrigger value="all">All Orders</TabsTrigger>
              <TabsTrigger value="held">Held</TabsTrigger>
              <TabsTrigger value="delivered">Delivered</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="released">Released</TabsTrigger>
              <TabsTrigger value="refunded">Refunded</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Orders List */}
          <Card className="backdrop-blur-md bg-background/80 border-border/50">
            <CardHeader>
              <CardTitle>Orders</CardTitle>
              <CardDescription>Click on an order to take action</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : orders && orders.length > 0 ? (
                <div className="space-y-4">
                  {orders.map((order) => {
                    const statusConfig = escrowStatusConfig[order.escrow_status as EscrowStatus] || escrowStatusConfig.pending;
                    const StatusIcon = statusConfig.icon;

                    return (
                      <div
                        key={order.id}
                        className="p-4 rounded-lg border border-border/50 hover:border-primary/50 transition-colors cursor-pointer"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div className="flex items-center gap-4">
                            <Badge variant="outline" className={statusConfig.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusConfig.label}
                            </Badge>
                            <div>
                              <p className="font-medium">{order.products?.title}</p>
                              <p className="text-sm text-muted-foreground">
                                Order #{order.id.slice(0, 8)} • {order.buyer?.username || 'Unknown buyer'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-6 text-sm">
                            <div className="text-right">
                              <p className="font-bold text-lg">${order.price.toFixed(2)}</p>
                              <p className="text-muted-foreground">
                                Held: ${(order.held_amount || order.price * 0.9).toFixed(2)}
                              </p>
                            </div>

                            <div className="text-right text-muted-foreground">
                              <p>{format(new Date(order.created_at), 'MMM dd, yyyy')}</p>
                              {order.auto_confirm_deadline && order.escrow_status === 'held' && (
                                <p className="text-xs text-yellow-600">
                                  Auto-confirm: {formatDistanceToNow(new Date(order.auto_confirm_deadline))}
                                </p>
                              )}
                              {order.refund_deadline && order.escrow_status === 'delivered' && (
                                <p className="text-xs text-purple-600">
                                  Refund window: {formatDistanceToNow(new Date(order.refund_deadline))}
                                </p>
                              )}
                            </div>

                            <ArrowRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No orders found
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Detail Dialog */}
          {selectedOrder && (
            <AlertDialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
              <AlertDialogContent className="max-w-lg">
                <AlertDialogHeader>
                  <AlertDialogTitle>Order #{selectedOrder.id.slice(0, 8)}</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Product</p>
                          <p className="font-medium">{selectedOrder.products?.title}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Amount</p>
                          <p className="font-medium">${selectedOrder.price.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Escrow Status</p>
                          <Badge variant="outline" className={escrowStatusConfig[selectedOrder.escrow_status as EscrowStatus]?.color}>
                            {selectedOrder.escrow_status}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Payment Method</p>
                          <p className="font-medium capitalize">{selectedOrder.payment_method || 'Unknown'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Seller Earnings</p>
                          <p className="font-medium text-green-600">${(selectedOrder.seller_earnings || selectedOrder.price * 0.9).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Platform Fee</p>
                          <p className="font-medium text-blue-600">${(selectedOrder.platform_fee || selectedOrder.price * 0.1).toFixed(2)}</p>
                        </div>
                      </div>

                      {actionType && (
                        <div className="space-y-2 pt-4 border-t">
                          <Label>Reason (optional)</Label>
                          <Textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Enter reason for this action..."
                            rows={3}
                          />
                        </div>
                      )}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                  <AlertDialogCancel onClick={() => { setSelectedOrder(null); setActionType(null); setReason(''); }}>
                    Close
                  </AlertDialogCancel>
                  
                  {!actionType ? (
                    <>
                      {(selectedOrder.escrow_status === 'held' || selectedOrder.escrow_status === 'delivered') && (
                        <Button 
                          onClick={() => setActionType('release')} 
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Unlock className="h-4 w-4 mr-2" />
                          Release Funds
                        </Button>
                      )}
                      {selectedOrder.escrow_status !== 'refunded' && selectedOrder.escrow_status !== 'released' && (
                        <Button 
                          onClick={() => setActionType('refund')} 
                          variant="destructive"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Refund
                        </Button>
                      )}
                      {selectedOrder.escrow_status === 'held' && (
                        <Button 
                          onClick={() => setActionType('hold')} 
                          variant="outline"
                        >
                          <Clock className="h-4 w-4 mr-2" />
                          Extend Hold
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => setActionType(null)}>
                        Back
                      </Button>
                      <Button 
                        onClick={handleAction}
                        disabled={escrowAction.isPending}
                        className={actionType === 'release' ? 'bg-green-600 hover:bg-green-700' : actionType === 'refund' ? 'bg-red-600 hover:bg-red-700' : ''}
                      >
                        {escrowAction.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        Confirm {actionType}
                      </Button>
                    </>
                  )}
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
