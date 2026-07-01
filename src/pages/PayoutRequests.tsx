import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, DollarSign, ArrowUpRight, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useReauthSession } from '@/hooks/useReauthSession';
import { ReauthModal } from '@/components/ReauthModal';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function PayoutRequests() {
  const { user } = useAuth();
  const { hasRole: isSeller, isLoading: roleLoading } = useHasRole('seller');
  const { hasRole: isAdmin } = useHasRole('admin');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [payoutMethodId, setPayoutMethodId] = useState('');
  const { hasValidSession, isLoading: sessionLoading } = useReauthSession();
  const [userProfile, setUserProfile] = useState<any>(null);

  // Fetch user profile to check 2FA status
  useQuery({
    queryKey: ['profile-2fa', user?.id],
    queryFn: async () => {
      const { data } = await db
        .from('dkai_profiles')
        .select('is_2fa_enabled')
        .eq('id', user!.id)
        .single();
      setUserProfile(data);
      return data;
    },
    enabled: !!user,
  });

  const { data: balance } = useQuery({
    queryKey: ['seller-balance', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seller_balances')
        .select('*')
        .eq('seller_id', user!.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user && isSeller,
  });

  const { data: payoutMethods, isLoading: payoutMethodsLoading } = useQuery({
    queryKey: ['payout-methods', user?.id, hasValidSession],
    queryFn: async () => {
      // Admins bypass reauth requirement
      if (isAdmin) {
        const { data, error } = await supabase
          .from('payout_methods')
          .select('*')
          .eq('seller_id', user!.id);
        if (error) throw error;
        return data;
      }

      // For sellers, check if they have valid session
      if (!hasValidSession) {
        return null; // Don't fetch without reauth
      }

      const { data, error } = await supabase
        .from('payout_methods')
        .select('*')
        .eq('seller_id', user!.id);

      if (error) throw error;
      return data;
    },
    enabled: !!user && isSeller && (isAdmin || hasValidSession),
  });

  const { data: payouts, isLoading } = useQuery({
    queryKey: ['payouts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payouts')
        .select('*')
        .eq('seller_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user && isSeller,
  });

  const requestPayoutMutation = useMutation({
    mutationFn: async () => {
      const payoutAmount = parseFloat(amount);
      
      if (!payoutAmount || payoutAmount <= 0) {
        throw new Error('Please enter a valid amount');
      }

      if (payoutAmount > (balance?.available_balance || 0)) {
        throw new Error('Insufficient available balance');
      }

      const { error } = await supabase
        .from('payouts')
        .insert({
          seller_id: user!.id,
          amount: payoutAmount,
          payout_method_id: payoutMethodId || null,
          currency: 'usd',
          status: 'pending',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payouts'] });
      queryClient.invalidateQueries({ queryKey: ['seller-balance'] });
      toast.success('Payout request submitted successfully');
      setShowRequestDialog(false);
      setAmount('');
      setPayoutMethodId('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to request payout');
    },
  });

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
              <p className="text-muted-foreground">Request withdrawals from your earnings</p>
            </div>
            <Button onClick={() => setShowRequestDialog(true)} size="lg">
              <ArrowUpRight className="w-4 h-4 mr-2" />
              Request Payout
            </Button>
          </div>

          {/* Balance Card */}
          <Card className="mb-8 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Available Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary mb-4">
                ${Number(balance?.available_balance || 0).toFixed(2)}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Held:</span>
                  <span className="ml-2 font-semibold">${Number(balance?.held_balance || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Pending:</span>
                  <span className="ml-2 font-semibold">${Number(balance?.pending_balance || 0).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Re-authentication requirement alert for non-admin sellers */}
          {!isAdmin && !hasValidSession && (
            <Alert className="mb-8 border-orange-500/50 bg-orange-500/10">
              <Shield className="h-4 w-4 text-orange-500" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold mb-1">Identity Verification Required</p>
                    <p className="text-sm">
                      For security, please verify your identity to view payout methods and request withdrawals.
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowReauthModal(true)}
                    variant="outline"
                    size="sm"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Verify Now
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Payout Methods - Only shown if user has valid session or is admin */}
          {!isAdmin && !hasValidSession ? null : (!payoutMethods || payoutMethods.length === 0) && (
            <Card className="mb-8 border-yellow-500/50 bg-yellow-500/5">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground mb-4">
                  You haven't set up any payout methods yet. Add your payment details to receive payouts.
                </p>
                <Button onClick={() => navigate('/seller-onboarding/payment')} variant="outline">
                  Add Payout Method
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Payout History */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Payout History</h2>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : payouts && payouts.length > 0 ? (
              <div className="grid gap-4">
                {payouts.map((payout) => (
                  <Card key={payout.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">${payout.amount}</CardTitle>
                          <CardDescription>
                            {new Date(payout.created_at).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <Badge
                          variant={
                            payout.status === 'completed' ? 'default' :
                            payout.status === 'pending' ? 'secondary' :
                            payout.status === 'failed' ? 'destructive' : 'outline'
                          }
                        >
                          {payout.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    {payout.failure_reason && (
                      <CardContent>
                        <p className="text-sm text-destructive">Reason: {payout.failure_reason}</p>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-12 text-muted-foreground">
                  No payout requests yet
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Request Payout Dialog */}
        <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Payout</DialogTitle>
              <DialogDescription>
                Request a withdrawal from your available balance
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Amount (USD)</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  max={balance?.available_balance || 0}
                  step="0.01"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Available: ${Number(balance?.available_balance || 0).toFixed(2)}
                </p>
              </div>

              {payoutMethods && payoutMethods.length > 0 && (
                <div>
                  <Label>Payout Method (Optional)</Label>
                  <Select value={payoutMethodId} onValueChange={setPayoutMethodId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a method" />
                    </SelectTrigger>
                    <SelectContent>
                      {payoutMethods.map((method) => (
                        <SelectItem key={method.id} value={method.id}>
                          {method.type === 'paypal' && 'PayPal'}
                          {method.type === 'bank_account' && `Bank Account (${method.bank_country})`}
                          {method.type === 'manual_stripe_invoice' && 'Stripe Invoice'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => requestPayoutMutation.mutate()}
                  disabled={requestPayoutMutation.isPending}
                  className="flex-1"
                >
                  {requestPayoutMutation.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Submit Request
                </Button>
                <Button
                  onClick={() => setShowRequestDialog(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Re-authentication Modal */}
        <ReauthModal
          open={showReauthModal}
          onOpenChange={setShowReauthModal}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['reauth-session'] });
            queryClient.invalidateQueries({ queryKey: ['payout-methods'] });
          }}
          has2FA={userProfile?.is_2fa_enabled}
        />
      </div>
    </AppLayout>
  );
}
