import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/dkaiDb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IOSToggle } from '@/components/ui/ios-toggle';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { HourglassLoader } from '@/components/HourglassLoader';

interface AcceptedPaymentMethodsProps {
  stripeReady: boolean;
  paypalReady: boolean;
}

export function AcceptedPaymentMethods({ stripeReady, paypalReady }: AcceptedPaymentMethodsProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [acceptsStripe, setAcceptsStripe] = useState(true);
  const [acceptsPaypal, setAcceptsPaypal] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await db
        .from('dkai_seller_payment_configs')
        .select('accepts_stripe, accepts_paypal')
        .eq('seller_id', user.id)
        .maybeSingle();
      setAcceptsStripe(data?.accepts_stripe ?? true);
      setAcceptsPaypal(data?.accepts_paypal ?? true);
      setLoading(false);
    })();
  }, [user]);

  const save = async (field: 'accepts_stripe' | 'accepts_paypal', value: boolean) => {
    if (!user) return;
    // At least one connected provider must stay enabled.
    const nextStripe = field === 'accepts_stripe' ? value : acceptsStripe;
    const nextPaypal = field === 'accepts_paypal' ? value : acceptsPaypal;
    const anyEnabled = (stripeReady && nextStripe) || (paypalReady && nextPaypal);
    if (!anyEnabled) {
      toast.error('Keep at least one payment method enabled so buyers can pay you.');
      return;
    }

    setSaving(field);
    const previous = field === 'accepts_stripe' ? acceptsStripe : acceptsPaypal;
    if (field === 'accepts_stripe') setAcceptsStripe(value);
    else setAcceptsPaypal(value);

    const { error } = await db
      .from('dkai_seller_payment_configs')
      .upsert({ seller_id: user.id, [field]: value }, { onConflict: 'seller_id' });

    if (error) {
      if (field === 'accepts_stripe') setAcceptsStripe(previous);
      else setAcceptsPaypal(previous);
      toast.error(error.message || 'Failed to save payment method preference');
    } else {
      toast.success('Payment methods updated');
    }
    setSaving(null);
  };

  if (!stripeReady && !paypalReady) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Accepted at checkout</CardTitle>
        <CardDescription>
          Choose which of your connected providers buyers can pick when they check out.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-4">
            <HourglassLoader size={48} />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 p-3 border rounded-lg">
              <div>
                <p className="font-medium">Cards &amp; local methods (Stripe)</p>
                <p className="text-xs text-muted-foreground">
                  {stripeReady ? 'Stripe is connected' : 'Connect Stripe to enable'}
                </p>
              </div>
              <IOSToggle
                checked={stripeReady && acceptsStripe}
                onCheckedChange={(v) => save('accepts_stripe', v)}
                disabled={!stripeReady || saving === 'accepts_stripe'}
                size="md"
              />
            </div>
            <div className="flex items-center justify-between gap-4 p-3 border rounded-lg">
              <div>
                <p className="font-medium">PayPal</p>
                <p className="text-xs text-muted-foreground">
                  {paypalReady ? 'PayPal is connected' : 'Connect PayPal to enable'}
                </p>
              </div>
              <IOSToggle
                checked={paypalReady && acceptsPaypal}
                onCheckedChange={(v) => save('accepts_paypal', v)}
                disabled={!paypalReady || saving === 'accepts_paypal'}
                size="md"
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
