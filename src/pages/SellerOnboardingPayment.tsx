import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import { Loader2, ArrowLeft, CreditCard, Shield, CheckCircle, ExternalLink, RefreshCw, AlertTriangle, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useReauthSession } from '@/hooks/useReauthSession';
import { ReauthModal } from '@/components/ReauthModal';
import { useQueryClient } from '@tanstack/react-query';
import { useHasRole } from '@/hooks/useUserRole';
import { Badge } from '@/components/ui/badge';
import { IOSToggle } from '@/components/ui/ios-toggle';

interface StripeConnectStatus {
  connected: boolean;
  accountId?: string;
  maskedAccountId?: string;
  onboardingStatus: "not_connected" | "onboarding" | "connected" | "needs_info";
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  cardPaymentsEnabled: boolean;
  email?: string;
  requirements?: {
    currently_due?: string[];
    eventually_due?: string[];
    past_due?: string[];
  };
  isTestMode?: boolean;
}

export default function SellerOnboardingPayment() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const { hasValidSession } = useReauthSession();
  const { hasRole: isAdmin } = useHasRole('admin');

  // Stripe Connect state
  const [stripeLoading, setStripeLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingCard, setTogglingCard] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<StripeConnectStatus>({
    connected: false,
    onboardingStatus: "not_connected",
    chargesEnabled: false,
    payoutsEnabled: false,
    detailsSubmitted: false,
    cardPaymentsEnabled: false,
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchUserProfile();
    fetchStripeStatus();
  }, [user, navigate]);

  useEffect(() => {
    if (searchParams.get("onboarding") === "complete") {
      toast({ title: "Success", description: "Stripe onboarding completed! Checking status..." });
      fetchStripeStatus();
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
      const { data, error } = await supabase.functions.invoke("stripe-connect-status");
      if (error) throw error;
      setStripeStatus(data);
    } catch (error) {
      console.error("Error fetching Stripe status:", error);
    } finally {
      setStripeLoading(false);
      setRefreshing(false);
    }
  };

  const handleConnectStripe = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-onboard");
      if (error) throw error;
      if (!data.success || !data.url) throw new Error(data.error || "Failed to create onboarding link");

      toast({ title: "Redirecting", description: "Opening Stripe onboarding in a new tab..." });
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      console.error("Error connecting Stripe:", error);
      toast({ title: "Error", description: error.message || "Failed to start Stripe onboarding", variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const handleOpenDashboard = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-dashboard");
      if (error) throw error;
      if (!data.success || !data.url) throw new Error(data.error || "Failed to open dashboard");
      window.open(data.url, "_blank");
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to open Stripe dashboard", variant: "destructive" });
    }
  };

  const handleDisconnectStripe = async () => {
    if (!confirm("Are you sure you want to disconnect your Stripe account? Card payments will be disabled.")) return;

    setDisconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-disconnect");
      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Failed to disconnect");

      toast({ title: "Success", description: "Stripe account disconnected" });
      setStripeStatus({
        connected: false,
        onboardingStatus: "not_connected",
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        cardPaymentsEnabled: false,
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to disconnect Stripe", variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleToggleCardPayments = async (enabled: boolean) => {
    if (enabled && stripeStatus.onboardingStatus !== "connected") {
      toast({ title: "Not Ready", description: "Complete Stripe onboarding first", variant: "destructive" });
      return;
    }

    setTogglingCard(true);
    try {
      const { error } = await supabase
        .from("seller_payment_configs")
        .update({ card_payments_enabled: enabled, updated_at: new Date().toISOString() })
        .eq("seller_id", user?.id);

      if (error) throw error;
      setStripeStatus(prev => ({ ...prev, cardPaymentsEnabled: enabled }));
      toast({ title: "Success", description: enabled ? "Card payments enabled" : "Card payments disabled" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update settings", variant: "destructive" });
    } finally {
      setTogglingCard(false);
    }
  };

  const fetchUserProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('dkai_profiles')
      .select('is_2fa_enabled')
      .eq('id', user.id)
      .single();
    setUserProfile(data);
  };

  if (!user) return null;

  const needsReauth = !isAdmin && !hasValidSession;

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate('/seller-onboarding')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Checklist
        </Button>

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

        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Stripe Payment Settings</h1>
          <p className="text-muted-foreground">
            Connect your Stripe account to receive payments. All transactions are processed exclusively via Stripe. 90% goes to you, 10% platform fee.
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
                <Badge className="bg-green-500 hover:bg-green-600">Connected</Badge>
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
                    {stripeStatus.onboardingStatus === "connected" ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : stripeStatus.onboardingStatus === "needs_info" ? (
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    ) : (
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    )}
                    <div>
                      <p className="font-medium">
                        {stripeStatus.onboardingStatus === "connected" 
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
                  {stripeStatus.onboardingStatus !== "connected" && (
                    <Button onClick={handleConnectStripe} disabled={connecting}>
                      {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                      {stripeStatus.onboardingStatus === "needs_info" ? "Complete Verification" : "Continue Onboarding"}
                    </Button>
                  )}
                  {stripeStatus.onboardingStatus === "connected" && (
                    <>
                      <Button variant="outline" onClick={handleOpenDashboard}>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open Stripe Dashboard
                      </Button>
                      <Button variant="destructive" onClick={handleDisconnectStripe} disabled={disconnecting}>
                        {disconnecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                        Disconnect
                      </Button>
                    </>
                  )}
                </div>

                {/* Card Payments Toggle - Only if fully connected */}
                {stripeStatus.onboardingStatus === "connected" && (
                  <div className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">Enable Card Payments</p>
                          <p className="text-sm text-muted-foreground">Accept card payments from buyers</p>
                        </div>
                      </div>
                      <IOSToggle
                        checked={stripeStatus.cardPaymentsEnabled}
                        onCheckedChange={handleToggleCardPayments}
                        disabled={togglingCard}
                        size="md"
                      />
                    </div>
                    {stripeStatus.cardPaymentsEnabled && (
                      <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">Card payments are active</span>
                        </div>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          90% goes to your Stripe account, 10% platform fee
                        </p>
                      </div>
                    )}
                  </div>
                )}
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
                     Create a new Stripe Express account or connect an existing one. You'll receive 90% of each sale directly to your bank account.
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
