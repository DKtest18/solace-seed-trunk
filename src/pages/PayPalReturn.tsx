import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { capturePayPalOrder } from '@/lib/paypalCheckout';
import { HourglassLoader } from '@/components/HourglassLoader';

/**
 * PayPal sends the buyer back here after approval with ?token=<paypal order id>.
 * We capture server-side (never trusting query params for amounts) and then
 * forward to the normal purchase confirmation.
 */
export default function PayPalReturn() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<'capturing' | 'done' | 'error'>('capturing');
  const [message, setMessage] = useState('');
  const started = useRef(false);

  const paypalOrderId = searchParams.get('token') || searchParams.get('paypal_order_id') || '';
  const orderId = searchParams.get('order') || undefined;

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!paypalOrderId) {
      setState('error');
      setMessage('Missing PayPal order reference.');
      return;
    }

    capturePayPalOrder({ paypalOrderId, orderId })
      .then((res) => {
        setState('done');
        setTimeout(() => {
          navigate(`/purchase-history?success=true&order=${res.orderId ?? orderId ?? ''}`);
        }, 1200);
      })
      .catch((err: any) => {
        setState('error');
        setMessage(err?.message || 'PayPal payment could not be completed.');
      });
  }, [paypalOrderId, orderId, navigate]);

  return (
    <AppLayout>
      <div className="container max-w-lg mx-auto py-16 px-4">
        <Card className="p-8 text-center space-y-4">
          {state === 'capturing' && (
            <>
              <HourglassLoader size="lg" label className="mx-auto" />
              <h1 className="text-xl font-semibold">Confirming your PayPal payment…</h1>
              <p className="text-sm text-muted-foreground">Please don't close this window.</p>
            </>
          )}
          {state === 'done' && (
            <>
              <CheckCircle2 className="w-8 h-8 mx-auto text-primary" />
              <h1 className="text-xl font-semibold">Payment confirmed</h1>
              <p className="text-sm text-muted-foreground">Taking you to your purchases…</p>
            </>
          )}
          {state === 'error' && (
            <>
              <XCircle className="w-8 h-8 mx-auto text-destructive" />
              <h1 className="text-xl font-semibold">Payment not completed</h1>
              <p className="text-sm text-muted-foreground">{message}</p>
              <Button onClick={() => navigate('/marketplace')} className="w-full">
                Back to marketplace
              </Button>
            </>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
