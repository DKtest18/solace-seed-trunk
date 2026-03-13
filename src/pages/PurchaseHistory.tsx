import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShoppingBag, ExternalLink, Download, MessageCircle, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow, differenceInHours } from 'date-fns';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function PurchaseHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch buyer's orders (not purchases)
  const { data: orders, isLoading } = useQuery({
    queryKey: ['buyer-orders', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await db
        .from('dkai_orders')
        .select(`
          *,
          products(
            id,
            title,
            description,
            image_url,
            product_type,
            seller_id
          )
        `)
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch seller profiles separately
      if (data && data.length > 0) {
        const sellerIds = data.map(o => o.products?.seller_id).filter(Boolean);
        const { data: profiles } = await db
          .from('profiles')
          .select('id, full_name, avatar_url, username')
          .in('id', sellerIds as string[]);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]));
        
        return data.map(order => ({
          ...order,
          seller_profile: profileMap.get(order.products?.seller_id || '')
        }));
      }
      
      return data || [];
    },
    enabled: !!user,
  });

  const confirmReceipt = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.functions.invoke('buyer-confirm-receipt', {
        body: { orderId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
      toast.success('Receipt confirmed! You have 24 hours to request a refund if needed.');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to confirm receipt');
    }
  });

  const requestRefund = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      const { data, error } = await supabase.functions.invoke('request-refund', {
        body: { orderId, reason }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
      toast.success('Refund requested. An admin will review your request.');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to request refund');
    }
  });

  const downloadProduct = async (productId: string, orderId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-signed-url', {
        body: { productId, orderId }
      });
      if (error) throw error;
      if (data.signedUrl) {
        window.open(data.signedUrl, '_blank');
        toast.success('Download started');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to download product');
    }
  };

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingBag className="w-8 h-8 text-primary" />
              <h1 className="text-4xl font-bold">Purchase History</h1>
            </div>
            <p className="text-muted-foreground">
              View all your orders and track their status
            </p>
          </div>

          {orders && orders.length > 0 ? (
            <div className="grid gap-6">
              {orders.map((order: any) => {
                const seller = order.seller_profile;
                return (
                  <Card key={order.id} className="overflow-hidden">
                    <div className="flex flex-col md:flex-row">
                      {order.products?.image_url && (
                        <div className="md:w-48 md:h-48 bg-muted overflow-hidden">
                          <img
                            src={order.products.image_url}
                            alt={order.products.title || 'Product'}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <CardHeader>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <CardTitle className="mb-2">
                                {order.products?.title || 'Unknown Product'}
                              </CardTitle>
                              <CardDescription>
                                {order.products?.description || 'No description available'}
                              </CardDescription>
                            </div>
                            <Badge
                              variant={
                                order.status === 'completed'
                                  ? 'default'
                                  : order.status === 'awaiting_invoice'
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
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Order Date</p>
                              <p className="font-medium">
                                {new Date(order.created_at || '').toLocaleDateString()}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Amount</p>
                              <p className="font-medium text-lg">${Number(order.price).toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Payment Method</p>
                              <Badge variant="outline">{order.payment_method || 'email_invoice'}</Badge>
                            </div>
                          </div>

                          {/* Seller Info */}
                          {seller && (
                            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                              <p className="text-xs text-muted-foreground mb-2">Seller</p>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarImage src={seller.avatar_url || undefined} />
                                  <AvatarFallback>
                                    {seller.full_name?.[0] || seller.username?.[0] || 'S'}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <p className="font-medium">
                                    {seller.full_name || seller.username || 'Unknown Seller'}
                                  </p>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate(`/messages?seller=${order.products?.seller_id}`)}
                                >
                                  <MessageCircle className="h-4 w-4 mr-2" />
                                  Message
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Escrow Status & Actions */}
                          {order.escrow_status === 'delivered' && order.refund_deadline && (
                            <Alert className="mb-4">
                              <Clock className="h-4 w-4" />
                              <AlertDescription>
                                {new Date(order.refund_deadline) > new Date() ? (
                                  <>
                                    Refund window: {differenceInHours(new Date(order.refund_deadline), new Date())} hours remaining
                                  </>
                                ) : (
                                  'Refund window has closed'
                                )}
                              </AlertDescription>
                            </Alert>
                          )}
                          
                          <div className="flex flex-wrap gap-2">
                            <Button asChild variant="default">
                              <Link to={`/product/${order.products?.id}`}>
                                <ExternalLink className="w-4 h-4 mr-2" />
                                View Product
                              </Link>
                            </Button>

                            {/* Download button for instant download products */}
                            {order.escrow_status === 'released' && order.products?.delivery_mode === 'instant_download' && (
                              <Button 
                                variant="outline"
                                onClick={() => downloadProduct(order.products.id, order.id)}
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Download
                              </Button>
                            )}

                            {/* Confirm Receipt button */}
                            {(order.escrow_status === 'held' || order.seller_marked_delivered_at) && !order.buyer_confirmed_at && (
                              <Button
                                variant="default"
                                onClick={() => confirmReceipt.mutate(order.id)}
                                disabled={confirmReceipt.isPending}
                              >
                                {confirmReceipt.isPending ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                )}
                                I Have Received Product
                              </Button>
                            )}

                            {/* Request Refund button */}
                            {order.escrow_status === 'delivered' && 
                             order.refund_deadline && 
                             new Date(order.refund_deadline) > new Date() && 
                             order.status !== 'pending_refund' && (
                              <Button
                                variant="destructive"
                                onClick={() => {
                                  const reason = prompt('Please provide a reason for the refund:');
                                  if (reason) {
                                    requestRefund.mutate({ orderId: order.id, reason });
                                  }
                                }}
                                disabled={requestRefund.isPending}
                              >
                                {requestRefund.isPending ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 mr-2" />
                                )}
                                Request Refund
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No orders yet</h3>
                <p className="text-muted-foreground mb-6">
                  Start exploring the marketplace to find amazing AI agents and software
                </p>
                <Button asChild>
                  <Link to="/marketplace">Browse Marketplace</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
