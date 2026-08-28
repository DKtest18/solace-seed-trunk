import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { db } from '@/lib/dkaiDb';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, Download, Shield, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { DELIVERY_MODE, normalizeDeliveryMode } from '@/lib/reviewStatus';
import { HourglassLoader } from '@/components/HourglassLoader';

const PAID_STATUSES = ['paid', 'completed', 'delivered', 'released'];

export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const [order, setOrder] = useState<any>(null);
  const [status, setStatus] = useState<'polling' | 'paid' | 'timeout'>('polling');
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    let tries = 0;

    const poll = async () => {
      tries += 1;
      setAttempts(tries);
      const { data } = await db
        .from('dkai_orders')
        .select(`
          id, status, price, currency, payment_method, created_at,
          delivery_mode, delivery_time_hours, seller_id, product_id,
          dkai_products:product_id(id, title, image_url, delivery_mode, delivery_time_hours),
          dkai_profiles:seller_id(id, full_name, creator_name, username)
        `)
        .eq('id', orderId)
        .maybeSingle();

      if (cancelled) return;
      if (data && PAID_STATUSES.includes(data.status)) {
        setOrder(data);
        setStatus('paid');
        return;
      }
      if (tries >= 15) { setStatus('timeout'); return; }
      setTimeout(poll, 2000);
    };
    poll();
    return () => { cancelled = true; };
  }, [orderId]);

  const download = async () => {
    if (!order) return;
    try {
      const { data, error } = await db.functions.invoke('generate-signed-url', {
        body: { productId: order.product_id, orderId: order.id },
      });
      if (error) throw error;
      if (data?.signedUrl) { window.open(data.signedUrl, '_blank'); toast.success('Download started'); }
    } catch (e: any) { toast.error(e.message || 'Failed to download'); }
  };

  if (!orderId) {
    return (
      <AppLayout>
        <div className="container max-w-2xl mx-auto py-16 px-4 text-center">
          <h1 className="text-2xl font-bold mb-2">Missing order reference</h1>
          <Button asChild><Link to="/marketplace">Back to Marketplace</Link></Button>
        </div>
      </AppLayout>
    );
  }

  if (status === 'polling') {
    return (
      <AppLayout>
        <div className="container max-w-2xl mx-auto py-16 px-4 text-center">
          <HourglassLoader size="lg" label className="mx-auto" />
          <h1 className="text-2xl font-bold mb-2">Confirming your payment…</h1>
          <p className="text-muted-foreground">
            Waiting on Stripe to confirm ({attempts}/15). This usually takes a few seconds.
          </p>
        </div>
      </AppLayout>
    );
  }

  if (status === 'timeout' || !order) {
    return (
      <AppLayout>
        <div className="container max-w-2xl mx-auto py-16 px-4 text-center">
          <h1 className="text-2xl font-bold mb-2">Still processing</h1>
          <p className="text-muted-foreground mb-6">
            Stripe hasn't confirmed the payment yet. Your receipt will appear in Purchase History shortly.
          </p>
          <Button asChild><Link to="/purchase-history">View Purchase History</Link></Button>
        </div>
      </AppLayout>
    );
  }

  const product = order.dkai_products;
  const seller = order.dkai_profiles;
  const sellerName = seller?.creator_name || seller?.full_name || seller?.username || 'Unknown seller';
  const currency = (order.currency || 'USD').toUpperCase();
  const price = Number(order.price).toFixed(2);
  const deliveryMode = normalizeDeliveryMode(order.delivery_mode || product?.delivery_mode);
  const deliveryHours = order.delivery_time_hours || product?.delivery_time_hours;

  return (
    <AppLayout>
      <div className="container max-w-3xl mx-auto py-8 px-4">
        <div className="text-center mb-8">
          <CheckCircle className="w-14 h-14 text-green-600 mx-auto mb-3" />
          <h1 className="text-3xl font-bold">Payment confirmed</h1>
          <p className="text-muted-foreground">Thank you — your purchase of <strong>{product?.title}</strong> is complete.</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Receipt</CardTitle>
            <CardDescription>Order #{order.id}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Product</span><span className="font-medium">{product?.title}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Seller</span><span className="font-medium">{sellerName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-medium">{new Date(order.created_at).toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Payment method</span><span className="font-medium">Card (Stripe)</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span className="font-medium">{deliveryMode === DELIVERY_MODE.INSTANT ? 'Instant download' : deliveryMode === DELIVERY_MODE.SETUP ? `Setup by seller${deliveryHours ? ` within ${deliveryHours}h` : ''}` : `Manual delivery${deliveryHours ? ` within ${deliveryHours}h` : ''}`}</span></div>
            <div className="flex justify-between text-base pt-3 border-t"><span className="font-semibold">Total</span><span className="font-bold">{currency} {price}</span></div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardContent className="pt-6">
            {deliveryMode === DELIVERY_MODE.INSTANT ? (
              <Button onClick={download} size="lg" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Download your file
              </Button>
            ) : (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  The seller will deliver your product{deliveryHours ? ` within ${deliveryHours} hours` : ' shortly'}.
                  You'll be notified as soon as it's ready.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5 mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold mb-1">Buyer Protection</p>
                <p className="text-muted-foreground">
                  Every purchase is covered by our 14-day refund policy. If something isn't right,
                  request a refund or open a dispute from your Purchase History.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-center">
          <Button asChild variant="outline"><Link to="/purchase-history">Purchase History</Link></Button>
          <Button asChild><Link to="/marketplace">Keep browsing</Link></Button>
        </div>
      </div>
    </AppLayout>
  );
}
