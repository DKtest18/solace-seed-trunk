import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InfoIcon, CreditCard, CheckCircle, AlertTriangle, Loader2, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { usePlatformFee } from '@/hooks/usePlatformFee';

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
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('stripe-connect-status');
      if (error) throw error;
      return data as {
        connected?: boolean;
        chargesEnabled?: boolean;
        payoutsEnabled?: boolean;
        onboardingStatus?: string;
      };
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Treat as connected if Stripe says charges+payouts are enabled OR onboardingStatus==='connected'.
  const isStripeConnected =
    !!status &&
    (status.onboardingStatus === 'connected' ||
      (status.chargesEnabled === true && status.payoutsEnabled === true));

  // Auto-set card payment method once connected (effect avoids state-update during render).
  useEffect(() => {
    if (isStripeConnected && !data.payment_methods?.includes('card')) {
      onChange('payment_methods', ['card']);
    }
  }, [isStripeConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isStripeConnected) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Payment Method</h3>
          <p className="text-sm text-muted-foreground">
            Connect your Stripe account to receive payments.
          </p>
        </div>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You need to connect your Stripe account before you can list products for sale.
            Payments are processed securely via Stripe Connect.
          </AlertDescription>
        </Alert>

        <Button
          onClick={() =>
            navigate(`/seller/payment-settings?from=${encodeURIComponent('/create-product?step=8')}`)
          }
          className="w-full"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Connect Stripe Account
        </Button>
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
                Visa, Mastercard, Amex, and more. {sellerPct}% goes to you, {feePct}% platform fee.
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
