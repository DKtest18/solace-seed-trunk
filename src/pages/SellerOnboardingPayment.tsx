import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import { Loader2, ArrowLeft, CreditCard, Shield, CheckCircle, ExternalLink, RefreshCw, AlertTriangle, XCircle, PartyPopper, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useReauthSession } from '@/hooks/useReauthSession';
import { ReauthModal } from '@/components/ReauthModal';
import { useQueryClient } from '@tanstack/react-query';
import { useHasRole } from '@/hooks/useUserRole';
import { Badge } from '@/components/ui/badge';
import { usePlatformFee } from '@/hooks/usePlatformFee';
import { createStripeConnectOnboardingLink, emptyStripeConnectStatus, fetchStripeConnectStatus, isStripeConnectedForOnboarding, pollStripeConnectStatus, type StripeConnectStatus } from '@/lib/stripeConnectStatus';
import { buildSupabaseFunctionError, logSupabaseFunctionError } from '@/lib/supabaseFunctionErrors';
import { PayPalConnectCard } from '@/components/seller/PayPalConnectCard';

export default function SellerOnboardingPayment() {
  const { user } = useAuth();
  const { feePct, sellerPct } = usePlatformFee();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const { hasValidSession } = useReauthSession();
  const { hasRole: isAdmin } = useHasRole('admin');
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  // Stripe Connect state
  const [stripeLoading, setStripeLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<StripeConnectStatus>(emptyStripeConnectStatus);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchUserProfile();
    fetchStripeStatus();
  }, [user, navigate]);

  useEffect(() => {
    const isStripeReturn = searchParams.get("onboarding") === "complete" || searchParams.get("return") === "1";
    if (isStripeReturn) {
      setStripeLoading(true);
      setRefreshing(true);
      toast({ title: "Returned from Stripe", description: "Syncing payment status..." });
      pollStripeConnectStatus({
        stopWhen: (status) => isStripeConnectedForOnboarding(status) || status.onboardingStatus === "needs_info",
      }).then(async (status) => {
        setStripeStatus(status);
        await queryClient.invalidateQueries({ queryKey: ['seller-onboarding-progress'] });
        if (isStripeConnectedForOnboarding(status)) {
          toast({ title: "Success", description: "Stripe connected — your payment settings are saved." });
          setShowSuccessAnimation(true);
          setTimeout(() => setShowSuccessAnimation(false), 5000);
        } else if (status.onboardingStatus === "needs_info") {
          toast({ title: "Action required", description: "Stripe needs more information to finish verification." });
        } else {
          toast({ title: "Still reviewing", description: "Stripe is still reviewing your account. Use Refresh in a moment." });
        }
      }).catch((error) => {
        console.error("Error syncing Stripe status:", error);
        toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to sync Stripe status", variant: "destructive" });
      }).finally(() => {
        setStripeLoading(false);
        setRefreshing(false);
      });
      window.history.replaceState({}, "", "/seller-onboarding/payment");
    }
    if (searchParams.get("refresh") === "true") {
      fetchStripeStatus();
      window.history.replaceState({}, "", "/seller-onboarding/payment");
    }
  }, [searchParams]);

  const fetchStripeStatus = async () => {
    setRefreshing(true);
    try {
      setStripeStatus(await fetchStripeConnectStatus());
      await queryClient.invalidateQueries({ queryKey: ['seller-onboarding-progress'] });
    } catch (error) {
      console.error("Error fetching Stripe status:", error);
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to fetch Stripe status", variant: "destructive" });
    } finally {
      setStripeLoading(false);
      setRefreshing(false);
    }
  };

  const handleConnectStripe = async () => {
    setConnecting(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      toast({ title: "Sitzung abgelaufen", description: "Deine Sitzung ist abgelaufen - bitte neu anmelden", variant: "destructive" });
      setConnecting(false);
      return;
    }
    const origin = window.location.origin;

    let data: any = null;
    let error: any = null;
    try {
      const res = await supabase.functions.invoke('stripe-connect-onboarding', { body: { origin } });
      data = res.data;
      error = res.error;
    } catch (e: any) {
      console.error('stripe-connect-onboarding invoke threw:', e);
      toast({ title: "Error", description: e?.message || String(e), variant: "destructive" });
      setConnecting(false);
      return;
    }

    if (error || !data?.url) {
      let serverMsg = data?.error || error?.message;
      const ctx = error?.context;
      if (!data?.error && ctx && typeof ctx.text === 'function') {
        try {
          const txt = await ctx.clone().text();
          try { serverMsg = JSON.parse(txt)?.error || txt || serverMsg; } catch { serverMsg = txt || serverMsg; }
        } catch {}
      }
      console.error('stripe-connect-onboarding failed:', { error, data });
      toast({ title: `Stripe (${ctx?.status ?? 'error'})`, description: serverMsg || 'Unknown error from stripe-connect-onboarding', variant: "destructive" });
      setConnecting(false);
      return;
    }

    toast({ title: "Redirecting", description: "Opening Stripe onboarding..." });
    window.location.href = data.url;
  };

  const handleOpenDashboard = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-dashboard");
      if (error || data?.error || !data?.success || !data?.url) {
        throw await buildSupabaseFunctionError(
          "stripe-connect-dashboard",
          error,
          data,
          "Failed to open Stripe dashboard",
        );
      }
      window.location.href = data.url;
    } catch (error: any) {
      logSupabaseFunctionError("Error opening Stripe dashboard", error);
      toast({ title: "Error", description: error.message || "Failed to open Stripe dashboard", variant: "destructive" });
    }
  };

  const handleDisconnectStripe = async () => {
    if (!confirm("Are you sure you want to disconnect your Stripe account? This will delete the connection and disable card payments. You can connect a different account afterwards.")) return;

    setDisconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-disconnect");
      if (error || data?.error || !data?.success) {
        throw await buildSupabaseFunctionError(
          "stripe-connect-disconnect",
          error,
          data,
          "Failed to disconnect Stripe",
        );
      }

      toast({ title: "Success", description: "Stripe account disconnected. You can now connect a different account." });
      setStripeStatus(emptyStripeConnectStatus);
      await queryClient.invalidateQueries({ queryKey: ['seller-onboarding-progress'] });
    } catch (error: any) {
      logSupabaseFunctionError("Error disconnecting Stripe", error);
      toast({ title: "Error", description: error.message || "Failed to disconnect Stripe", variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  const fetchUserProfile = async () => {
    if (!user) return;
    const { data } = await db
      .from('dkai_profiles')
      .select('is_2fa_enabled')
      .eq('id', user.id)
      .single();
    setUserProfile(data);
  };

  if (!user) return null;

  const needsReauth = !isAdmin && !hasValidSession;
  const isFullyOnboarded = isStripeConnectedForOnboarding(stripeStatus);

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => {
            const params = new URLSearchParams(window.location.search);
            const from = params.get('from');
            navigate(from && from.startsWith('/') ? from : '/seller-onboarding');
          }}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Alert>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-sm flex-1">
              Connecting a payout provider is optional. You can create products and submit them for
              review without it — you only need it to receive money.
            </span>
            <Button variant="outline" size="sm" onClick={() => navigate('/seller-dashboard')}>
              Skip for now
            </Button>
          </AlertDescription>
        </Alert>

        {needsReauth && (
          <Alert className="border-destructive/50 bg-destructive/10">
            <Shield className="h-4 w-4 text-destructive" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold mb-1">Identity Verification Required</p>
                  <p className="text-sm">
                    For security, please verify your identity before managing payment settings.
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

        {/* Success Animation */}
        {showSuccessAnimation && isFullyOnboarded && (
          <div className="p-6 rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-950 text-center space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex justify-center">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
                <PartyPopper className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-green-700 dark:text-green-300">
              🎉 Stripe Successfully Connected!
            </h3>
            <p className="text-green-600 dark:text-green-400">
              Your account is fully set up. Payments will now go directly to your Stripe account.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Stripe Payment Settings</h1>
          <p className="text-muted-foreground">
            Connect your Stripe account to receive payments. Payments are processed by Stripe and go directly to your Stripe account. Platform fee: 0% during the launch promo (first 20 platform sales), otherwise {feePct}%. Stripe's standard payment processing fees apply and are borne by you.
          </p>
        </div>

        {/* Stripe Connect Section */}
        <Card className="border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Stripe Connect
                </CardTitle>
                <CardDescription>
                  Create a new Stripe Express account or connect an existing one
                </CardDescription>
              </div>
              {stripeStatus.onboardingStatus === "connected" && (
                <Badge className="bg-green-500 hover:bg-green-600">Connected{stripeStatus.isTestMode ? ' (Sandbox)' : ''}</Badge>
              )}
              {stripeStatus.onboardingStatus === "onboarding" && (
                <Badge variant="secondary">Onboarding</Badge>
              )}
              {stripeStatus.onboardingStatus === "needs_info" && (
                <Badge variant="outline" className="border-destructive text-destructive">Needs Info</Badge>
              )}
              {stripeStatus.onboardingStatus === "not_connected" && (
                <Badge variant="destructive">Not Connected</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {stripeLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : stripeStatus.connected ? (
              <>
                {/* Connected Status Display */}
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    {isFullyOnboarded ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : stripeStatus.onboardingStatus === "needs_info" ? (
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    ) : (
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    )}
                    <div>
                      <p className="font-medium">
                        {isFullyOnboarded 
                          ? "Stripe Connected" 
                          : stripeStatus.onboardingStatus === "needs_info"
                          ? "Verification Required"
                          : "Onboarding in Progress"}
                      </p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {stripeStatus.maskedAccountId || stripeStatus.email || stripeStatus.accountId}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={fetchStripeStatus} disabled={refreshing}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>

                {/* Status Grid */}
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="p-3 rounded-lg border text-center">
                    <div className={`font-medium ${stripeStatus.chargesEnabled ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {stripeStatus.chargesEnabled ? '✓' : '○'} Charges
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border text-center">
                    <div className={`font-medium ${stripeStatus.payoutsEnabled ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {stripeStatus.payoutsEnabled ? '✓' : '○'} Payouts
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border text-center">
                    <div className={`font-medium ${stripeStatus.detailsSubmitted ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {stripeStatus.detailsSubmitted ? '✓' : '○'} Details
                    </div>
                  </div>
                </div>

                {/* Requirements Alert */}
                {stripeStatus.onboardingStatus === "needs_info" && stripeStatus.requirements?.currently_due && stripeStatus.requirements.currently_due.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Action Required:</strong> Stripe needs additional information.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 flex-wrap">
                  {!isFullyOnboarded && (
                    <Button onClick={handleConnectStripe} disabled={connecting}>
                      {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                      {stripeStatus.onboardingStatus === "needs_info" ? "Complete Verification" : "Continue Onboarding"}
                    </Button>
                  )}
                  {isFullyOnboarded && (
                    <Button variant="outline" onClick={handleOpenDashboard}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Stripe Dashboard
                    </Button>
                  )}
                  {/* Always show disconnect — works for in-progress AND completed */}
                  <Button variant="destructive" onClick={handleDisconnectStripe} disabled={disconnecting}>
                    {disconnecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    {disconnecting ? "Disconnecting..." : "Delete Connection"}
                  </Button>
                </div>

              </>
            ) : (
              /* Not Connected - Show instructions + Connect button */
              <div className="space-y-6 py-4">
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    <div className="p-4 rounded-full bg-primary/10">
                      <CreditCard className="h-12 w-12 text-primary" />
                    </div>
                  </div>
                   <h3 className="text-lg font-semibold mb-2">Set Up Stripe Payments</h3>
                   <p className="text-muted-foreground max-w-md mx-auto">
                     Create a new Stripe Express account or connect an existing one. You'll receive {sellerPct}% of each sale directly to your bank account.
                   </p>
                </div>

                {/* Step-by-step instructions */}
                <div className="space-y-3 bg-muted/50 rounded-lg p-4">
                   <h4 className="font-semibold text-sm">How it works:</h4>
                   <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                     <li>Click the button below – a Stripe Express account will be created for you automatically.</li>
                     <li>Complete the short onboarding form (name, address, bank details).</li>
                     <li>Once verified, you can start receiving payments immediately.</li>
                   </ol>
                   <p className="text-xs text-muted-foreground mt-2">
                     Already have a Stripe account? No problem – you can link it during the onboarding process.
                   </p>
                </div>

                <div className="text-center">
                  <Button size="lg" onClick={handleConnectStripe} disabled={connecting} className="min-w-[200px]">
                    {connecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                         <ExternalLink className="w-4 h-4 mr-2" />
                         Create & Connect Stripe Account
                      </>
                    )}
                  </Button>
                   <p className="text-xs text-muted-foreground mt-2">
                     You'll be redirected to Stripe to set up or connect your account
                   </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PayPal — either provider satisfies this onboarding step */}
        <PayPalConnectCard
          returnPath="/seller-onboarding/payment"
          onStatusChange={async () => {
            await queryClient.invalidateQueries({ queryKey: ['seller-onboarding-progress'] });
          }}
        />



        <ReauthModal
          open={showReauthModal}
          onOpenChange={setShowReauthModal}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['reauth-session'] });
          }}
          has2FA={userProfile?.is_2fa_enabled}
        />
      </div>
    </div>
  );
}
