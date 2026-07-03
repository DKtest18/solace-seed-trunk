import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShoppingBag, ExternalLink, Download, MessageCircle, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow, differenceInHours } from 'date-fns';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BuyerProductDownloads } from '@/components/BuyerProductDownloads';

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

  // Confirm-receipt flow retired — no-escrow model: funds settle via Stripe directly.


  // Legacy request-refund flow retired — buyers now use /refund-request/:orderId (see Part 5).


  const downloadProduct = async (productId: string, orderId: string) => {
    try {
      const { data, error } = await db.functions.invoke('generate-signed-url', {
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
    // Guest checkout success — show a public thank-you instead of redirecting to login.
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      return (
        <AppLayout>
          <div className="min-h-screen flex items-center justify-center px-4 py-12">
            <Card className="max-w-lg w-full text-center">
              <CardHeader>
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-600" />
                <CardTitle>Thank you for your purchase!</CardTitle>
                <CardDescription>
                  Your payment was processed successfully by Stripe. A receipt has been sent to
                  the email you provided at checkout.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-left bg-muted rounded-lg p-4 text-sm">
                  Create an account with the <strong>same email you used at checkout</strong> to
                  access your purchases, download files, write reviews, and ask questions.
                </div>
                <div className="flex gap-2 justify-center">
                  <Button asChild><Link to="/signup">Create Account</Link></Button>
                  <Button asChild variant="outline"><Link to="/marketplace">Keep Browsing</Link></Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </AppLayout>
      );
    }
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

                          {/* Refund window notice (14 days from purchase) */}
                          {(() => {
                            const created = new Date(order.created_at);
                            const deadline = new Date(created.getTime() + 14 * 24 * 60 * 60 * 1000);
                            if (deadline < new Date()) return null;
                            return (
                              <Alert className="mb-4">
                                <Clock className="h-4 w-4" />
                                <AlertDescription>
                                  Refund window: {differenceInHours(deadline, new Date())} hours remaining
                                </AlertDescription>
                              </Alert>
                            );
                          })()}
                          
                          <div className="flex flex-wrap gap-2">
                            <Button asChild variant="default">
                              <Link to={`/product/${order.products?.id}`}>
                                <ExternalLink className="w-4 h-4 mr-2" />
                                View Product
                              </Link>
                            </Button>

                            {/* Download button — available once order is paid/completed */}
                            {['paid', 'completed', 'delivered'].includes(order.status) && (
                              <Button
                                variant="outline"
                                onClick={() => downloadProduct(order.products.id, order.id)}
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Download
                              </Button>
                            )}

                            {/* Confirm-receipt button removed — no-escrow model. */}


                            {/* Request Refund — 14 days from purchase, support-reviewed */}
                            {(() => {
                              const created = new Date(order.created_at);
                              const withinWindow =
                                Date.now() - created.getTime() < 14 * 24 * 60 * 60 * 1000;
                              if (!withinWindow) return null;
                              if (['refunded', 'pending_refund'].includes(order.status)) return null;
                              return (
                                <Button asChild variant="destructive">
                                  <Link to={`/refund-request/${order.id}`}>
                                    <AlertCircle className="w-4 h-4 mr-2" />
                                    Request Refund
                                  </Link>
                                </Button>
                              );
                            })()}
                          </div>

                          {/* Secure delivery file downloads (post-purchase) */}
                          {order.products?.id && ['paid', 'completed', 'delivered'].includes(order.status) && (
                            <div className="mt-6 pt-6 border-t">
                              <BuyerProductDownloads productId={order.products.id} />
                            </div>
                          )}
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
