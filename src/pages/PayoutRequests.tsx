import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, DollarSign, ExternalLink, Clock, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';

type StripeBalance = {
  available: { amount: number; currency: string }[];
  pending: { amount: number; currency: string }[];
  held?: { amount: number; currency: string }[];
  instant_available?: { amount: number; currency: string }[];
  payouts?: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    arrival_date: number;
    created: number;
    method?: string;
    description?: string | null;
  }>;
  balance_transactions?: Array<{
    id: string;
    amount: number;
    currency: string;
    type: string;
    created: number;
    description?: string | null;
  }>;
  payout_schedule?: { interval?: string; delay_days?: number };
  connected?: boolean;
};

function money(arr?: { amount: number; currency: string }[]) {
  if (!arr || arr.length === 0) return '—';
  return arr.map((b) => `${b.currency.toUpperCase()} ${b.amount.toFixed(2)}`).join(' · ');
}

export default function PayoutRequests() {
  const { user } = useAuth();
  const { hasRole: isSeller, isLoading: roleLoading } = useHasRole('seller');
  const navigate = useNavigate();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['stripe-balance-payouts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('stripe-connect-balance');
      if (error) throw error;
      return data as StripeBalance;
    },
    enabled: !!user && isSeller,
    retry: false,
  });

  const openDashboard = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-dashboard');
      if (error) throw error;
      if (data?.url) window.open(data.url, '_blank');
    } catch {
      // fallback silent
    }
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSeller) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Seller Access Required</CardTitle>
            <CardDescription>You need a seller account to access this area.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-2">
            <Button onClick={() => navigate('/seller-onboarding')} className="flex-1">Become a Seller</Button>
            <Button variant="outline" onClick={() => navigate('/')} className="flex-1">Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-background p-8">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Payouts</h1>
              <p className="text-muted-foreground">
                Live balances and payouts from your connected Stripe account
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
                {isFetching && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Refresh
              </Button>
              <Button onClick={openDashboard}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Stripe
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <Card className="border-destructive/40">
              <CardContent className="py-8 text-center">
                <p className="text-destructive font-medium mb-2">Could not load Stripe balance</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {(error as Error).message}
                </p>
                <Button variant="outline" onClick={() => navigate('/seller-onboarding/payment')}>
                  Check Stripe connection
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <DollarSign className="w-4 h-4" /> Available
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-primary">{money(data?.available)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Ready for payout</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Lock className="w-4 h-4" /> Held
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{money(data?.held)}</div>
                    <p className="text-xs text-muted-foreground mt-1">Within refund window</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Pending
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{money(data?.pending)}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Schedule:{' '}
                      {data?.payout_schedule?.interval || 'daily'}
                      {data?.payout_schedule?.delay_days
                        ? ` · +${data.payout_schedule.delay_days}d`
                        : ''}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent payouts</CardTitle>
                    <CardDescription>From your connected Stripe account</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data?.payouts && data.payouts.length > 0 ? (
                      <div className="space-y-3">
                        {data.payouts.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between border rounded-lg p-3"
                          >
                            <div>
                              <div className="font-medium">
                                {p.currency.toUpperCase()} {p.amount.toFixed(2)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(p.arrival_date * 1000).toLocaleDateString()}
                                {p.method ? ` · ${p.method}` : ''}
                              </div>
                            </div>
                            <Badge
                              variant={
                                p.status === 'paid'
                                  ? 'default'
                                  : p.status === 'in_transit' || p.status === 'pending'
                                    ? 'secondary'
                                    : 'destructive'
                              }
                            >
                              {p.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        No payouts yet
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent transactions</CardTitle>
                    <CardDescription>Charges, refunds and fees</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data?.balance_transactions && data.balance_transactions.length > 0 ? (
                      <div className="space-y-2">
                        {data.balance_transactions.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between text-sm border-b last:border-b-0 py-2"
                          >
                            <div className="min-w-0">
                              <div className="truncate">
                                {t.description || t.type}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(t.created * 1000).toLocaleDateString()} · {t.type}
                              </div>
                            </div>
                            <div
                              className={
                                t.amount >= 0 ? 'text-green-600 font-medium' : 'text-destructive font-medium'
                              }
                            >
                              {t.amount >= 0 ? '+' : ''}
                              {t.currency.toUpperCase()} {t.amount.toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-6 text-center">
                        No transactions yet
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
