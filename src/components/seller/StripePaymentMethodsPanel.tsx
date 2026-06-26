import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IOSToggle } from '@/components/ui/ios-toggle';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type StripeMethod = {
  method: string;
  capability: string;
  state: 'active' | 'pending' | 'inactive' | 'unrequested' | string;
  enabled: boolean;
};

const LABELS: Record<string, string> = {
  card: 'Cards (Visa, Mastercard, Amex…)',
  klarna: 'Klarna',
  afterpay_clearpay: 'Afterpay / Clearpay',
  sepa_debit: 'SEPA Direct Debit',
  ideal: 'iDEAL',
  bancontact: 'Bancontact',
  giropay: 'giropay',
  sofort: 'Sofort',
  eps: 'EPS',
  p24: 'Przelewy24 (P24)',
  link: 'Link',
  cashapp: 'Cash App Pay',
  us_bank_account: 'US Bank Account (ACH)',
  affirm: 'Affirm',
};

function stateBadge(state: string) {
  switch (state) {
    case 'active':
      return <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>;
    case 'pending':
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">Pending</Badge>;
    case 'inactive':
      return <Badge variant="destructive">Inactive</Badge>;
    default:
      return <Badge variant="secondary">Not requested</Badge>;
  }
}

export function StripePaymentMethodsPanel() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [methods, setMethods] = useState<StripeMethod[]>([]);
  const [country, setCountry] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-payment-methods', {
        method: 'GET',
      });
      if (error) throw error;
      setMethods(data?.methods ?? []);
      setCountry(data?.country ?? null);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to load Stripe payment methods');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const toggle = async (m: StripeMethod, next: boolean) => {
    setBusy(m.method);
    try {
      const { error } = await supabase.functions.invoke('stripe-payment-methods', {
        body: { method: m.method, action: next ? 'request' : 'cancel' },
      });
      if (error) throw error;
      toast.success(`${LABELS[m.method] || m.method} ${next ? 'requested' : 'disabled'} in Stripe`);
      await load();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to update Stripe');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>Payment methods (live from Stripe)</CardTitle>
            <CardDescription>
              Enable or disable the payment methods buyers can use at checkout.
              Changes are pushed to your connected Stripe account in real time
              {country ? ` (${country})` : ''}.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {methods.map((m) => (
          <div
            key={m.method}
            className="flex items-center justify-between gap-4 p-3 border rounded-lg"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium truncate">{LABELS[m.method] || m.method}</p>
                {stateBadge(m.state)}
              </div>
              <p className="text-xs text-muted-foreground">{m.capability}</p>
            </div>
            <IOSToggle
              checked={m.enabled}
              onCheckedChange={(v) => toggle(m, v)}
              disabled={busy === m.method}
              size="md"
            />
          </div>
        ))}
        <p className="text-xs text-muted-foreground pt-2">
          Some methods may stay in <strong>Pending</strong> until Stripe verifies your
          account. Methods Stripe doesn&apos;t support for your country show as
          <em> Not requested</em> and can&apos;t be enabled.
        </p>
      </CardContent>
    </Card>
  );
}
