import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InfoIcon, CreditCard, CheckCircle, AlertTriangle, Loader2, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { usePlatformFee } from '@/hooks/usePlatformFee';
import { fetchStripeConnectStatus, isStripeConnectedForOnboarding } from '@/lib/stripeConnectStatus';
import { fetchSellerAcceptedMethods } from '@/lib/paypalCheckout';
import { HourglassLoader } from '@/components/HourglassLoader';

interface PaymentOptionsStepProps {
  data: { payment_methods?: string[] };
  onChange: (field: string, value: any) => void;
  errors?: Record<string, string>;
}

export function PaymentOptionsStep({ data, onChange, errors }: PaymentOptionsStepProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { feePct, sellerPct } = usePlatformFee();

  // SINGLE SOURCE OF TRUTH: query the same edge function the Payment Settings page uses.
  // It reads live status from Stripe and syncs dkai_seller_payment_configs.
  const { data: status, isLoading } = useQuery({
    queryKey: ['stripe-connect-status', user?.id],
    queryFn: fetchStripeConnectStatus,
    enabled: !!user,
    staleTime: 60_000,
  });

  const isStripeConnected = !!status && isStripeConnectedForOnboarding(status);

  // PayPal counts as a connected provider too.
  const { data: paypalReady } = useQuery({
    queryKey: ['paypal-ready', user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      if (!user) return false;
      const methods = await fetchSellerAcceptedMethods(user.id);
      return methods.paypal;
    },
  });

  const hasProvider = isStripeConnected || !!paypalReady;

  // Payment method is always recorded so the wizard can be completed even
  // without a connected provider (the product just cannot be purchased yet).
  useEffect(() => {
    if (!data.payment_methods?.includes('card')) {
      onChange('payment_methods', ['card']);
    }
  }, [isStripeConnected, paypalReady]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <HourglassLoader size={64} />
      </div>
    );
  }

  if (!hasProvider) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Payment Method</h3>
          <p className="text-sm text-muted-foreground">
            Connect Stripe or PayPal to receive payments.
          </p>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No payment provider connected yet. You can still submit this product for review, and once
            approved it will be visible to everyone on the marketplace — but it cannot be purchased
            until you connect Stripe or PayPal.
          </AlertDescription>
        </Alert>

        <Button
          variant="outline"
          onClick={() =>
            navigate(`/seller/payment-settings?from=${encodeURIComponent('/create-product?step=8')}`)
          }
          className="w-full"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Connect Stripe or PayPal
        </Button>

        {errors?.payment_methodsError && (
          <Alert variant="destructive">
            <AlertDescription>{errors.payment_methodsError}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Payment Methods</h3>
        <p className="text-sm text-muted-foreground">
          Your Stripe account is connected. Available payment methods for your product:
        </p>
      </div>

      <div className="space-y-3">
        <div className="border rounded-lg p-4 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold">Card Payments</p>
                <Badge variant="default" className="text-xs">Active</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Visa, Mastercard, Amex, and more. Payments go directly to your Stripe account. Platform fee: 0% during launch promo, {feePct}% after. Stripe's standard processing fees apply and are borne by you.
              </p>
            </div>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </div>
        </div>
      </div>

      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          All payments are processed via Stripe Connect. Manage extra methods (SEPA, iDEAL, Klarna, etc.)
          on the Payment Settings page.
        </AlertDescription>
      </Alert>

      {errors?.payment_methodsError && (
        <Alert variant="destructive">
          <AlertDescription>{errors.payment_methodsError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
