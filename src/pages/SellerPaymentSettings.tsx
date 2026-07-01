import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, CreditCard, CheckCircle, XCircle, ExternalLink, Shield, RefreshCw, AlertTriangle, PartyPopper, Trash2, ArrowLeft } from "lucide-react";
import { useHasRole } from "@/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";
import { usePlatformFee } from "@/hooks/usePlatformFee";
import { StripePaymentMethodsPanel } from "@/components/seller/StripePaymentMethodsPanel";
import { emptyStripeConnectStatus, fetchStripeConnectStatus, isStripeConnectedForOnboarding, type StripeConnectStatus } from "@/lib/stripeConnectStatus";
import { buildSupabaseFunctionError, logSupabaseFunctionError } from "@/lib/supabaseFunctionErrors";
import { useQueryClient } from "@tanstack/react-query";

export default function SellerPaymentSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { hasRole: isSeller, isLoading: roleLoading } = useHasRole("seller");
  const { feePct, sellerPct } = usePlatformFee();
  
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<StripeConnectStatus>(emptyStripeConnectStatus);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    
    if (!roleLoading && !isSeller) {
      toast.error("Only sellers can access payment settings");
      navigate("/seller-dashboard");
      return;
    }
    
    if (isSeller) {
      fetchStripeStatus();
    }
  }, [user, isSeller, roleLoading]);

  // Check for onboarding completion
  useEffect(() => {
    const isStripeReturn = searchParams.get("onboarding") === "complete" || searchParams.get("return") === "1";
    if (isStripeReturn) {
      toast.success("Stripe onboarding completed! Checking status...");
      fetchStripeStatus().then(() => {
        setShowSuccessAnimation(true);
        setTimeout(() => setShowSuccessAnimation(false), 5000);
      });
      window.history.replaceState({}, "", "/seller/payment-settings");
    }
    if (searchParams.get("refresh") === "true") {
      toast.info("Refreshing Stripe status...");
      fetchStripeStatus();
      window.history.replaceState({}, "", "/seller/payment-settings");
    }
  }, [searchParams]);

  const fetchStripeStatus = async () => {
    setRefreshing(true);
    try {
      setStripeStatus(await fetchStripeConnectStatus());
      await queryClient.invalidateQueries({ queryKey: ['seller-onboarding-progress'] });
    } catch (error) {
      console.error("Error fetching Stripe status:", error);
      toast.error(error instanceof Error ? error.message : "Failed to fetch Stripe status");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleConnectStripe = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-onboarding", {
        body: { origin: window.location.origin }
      });
      if (error || data?.error || !data?.success || !data?.url) {
        throw await buildSupabaseFunctionError(
          "stripe-connect-onboarding",
          error,
          data,
          "Failed to create onboarding link",
        );
      }

      toast.info("Redirecting to Stripe...");
      // Use same-tab navigation so the return_url brings them back logged in
      window.location.href = data.url;
    } catch (error: any) {
      logSupabaseFunctionError("Error connecting Stripe", error);
      toast.error(error.message || "Failed to start Stripe onboarding");
      setConnecting(false);
    }
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
      // Use noopener,noreferrer to avoid ERR_BLOCKED_BY_RESPONSE from Stripe's X-Frame-Options
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      logSupabaseFunctionError("Error opening Stripe dashboard", error);
      toast.error(error.message || "Failed to open Stripe dashboard");
    }
  };

  const handleDisconnectStripe = async () => {
    if (!confirm("Are you sure you want to disconnect your Stripe account? This will delete the connection and disable card payments for all your products. You can connect a different account afterwards.")) {
      return;
    }

    setDisconnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-disconnect");
      if (error || data?.error || !data?.success) {
        throw await buildSupabaseFunctionError(
          "stripe-connect-disconnect",
          error,
          data,
          "Failed to disconnect Stripe account",
        );
      }

      toast.success("Stripe account disconnected. You can now connect a different account.");
      setStripeStatus(emptyStripeConnectStatus);
    } catch (error: any) {
      logSupabaseFunctionError("Error disconnecting Stripe", error);
      toast.error(error.message || "Failed to disconnect Stripe account");
    } finally {
      setDisconnecting(false);
    }
  };

  const getStatusBadge = () => {
    const modeLabel = stripeStatus.isTestMode ? " (Sandbox)" : "";
    switch (stripeStatus.onboardingStatus) {
      case "connected":
        return <Badge className="bg-green-500 hover:bg-green-600">Connected{modeLabel}</Badge>;
      case "onboarding":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Onboarding in Progress</Badge>;
      case "needs_info":
        return <Badge className="bg-orange-500 hover:bg-orange-600">Verification Required</Badge>;
      default:
        return <Badge variant="destructive">Not Connected</Badge>;
    }
  };

  if (loading || roleLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const isFullyOnboarded = isStripeConnectedForOnboarding(stripeStatus);

  return (
    <AppLayout>
      <div className="container max-w-3xl mx-auto py-8 px-4">
        <Button
          variant="ghost"
          onClick={() => {
            const from = searchParams.get('from');
            navigate(from && from.startsWith('/') ? from : '/seller-onboarding');
          }}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <h1 className="text-3xl font-bold mb-2">Payment Settings</h1>
        <p className="text-muted-foreground mb-8">
          Connect your Stripe account to receive card payments directly
        </p>

        {/* Success Animation */}
        {showSuccessAnimation && isFullyOnboarded && (
          <div className="mb-6 p-6 rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-950 text-center space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex justify-center">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
                <PartyPopper className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-green-700 dark:text-green-300">
              🎉 Stripe Successfully Connected!
            </h3>
            <p className="text-green-600 dark:text-green-400">
              Your account is fully set up. You can now receive payments — {sellerPct}% of each sale goes directly to your bank!
            </p>
          </div>
        )}

        {/* Sandbox Mode Warning */}
        {stripeStatus.isTestMode && (
          <Alert className="mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              <strong>Sandbox Mode — Test Only:</strong> You're using Stripe test mode. No real payments will be processed. 
              Contact the platform admin to enable live payments.
            </AlertDescription>
          </Alert>
        )}

        {/* Security Notice */}
        <Alert className="mb-6">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            We use Stripe Connect to process payments securely. Your bank details are stored only on Stripe, not on our servers.
            {sellerPct}% of each sale goes directly to your Stripe account, {feePct}% is the platform fee.
          </AlertDescription>
        </Alert>

        {/* Stripe Connect Status */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Stripe Connect
                </CardTitle>
                <CardDescription>
                  Connect your Stripe account to receive payments
                </CardDescription>
              </div>
              {getStatusBadge()}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {stripeStatus.connected ? (
              <>
                {/* Connected Status */}
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    {isFullyOnboarded ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : stripeStatus.onboardingStatus === "needs_info" ? (
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                    ) : (
                      <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />
                    )}
                    <div>
                      <p className="font-medium">
                        {isFullyOnboarded 
                          ? `Stripe Connected${stripeStatus.isTestMode ? " (Sandbox)" : " (Live)"}` 
                          : stripeStatus.onboardingStatus === "needs_info"
                          ? "Verification Required"
                          : "Onboarding in Progress"}
                      </p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {stripeStatus.maskedAccountId || stripeStatus.email || stripeStatus.accountId}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchStripeStatus}
                    disabled={refreshing}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh Status
                  </Button>
                </div>

                {/* Status Details */}
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="p-3 rounded-lg border text-center">
                    <div className={`font-medium ${stripeStatus.chargesEnabled ? 'text-green-600' : 'text-yellow-600'}`}>
                      {stripeStatus.chargesEnabled ? '✓' : '○'} Charges
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stripeStatus.chargesEnabled ? 'Enabled' : 'Pending'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border text-center">
                    <div className={`font-medium ${stripeStatus.payoutsEnabled ? 'text-green-600' : 'text-yellow-600'}`}>
                      {stripeStatus.payoutsEnabled ? '✓' : '○'} Payouts
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stripeStatus.payoutsEnabled ? 'Enabled' : 'Pending'}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border text-center">
                    <div className={`font-medium ${stripeStatus.detailsSubmitted ? 'text-green-600' : 'text-yellow-600'}`}>
                      {stripeStatus.detailsSubmitted ? '✓' : '○'} Details
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stripeStatus.detailsSubmitted ? 'Submitted' : 'Pending'}
                    </p>
                  </div>
                </div>

                {/* Requirements Alert */}
                {stripeStatus.onboardingStatus === "needs_info" && stripeStatus.requirements?.currently_due && stripeStatus.requirements.currently_due.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Action Required:</strong> Stripe needs additional information to enable payouts.
                      <ul className="mt-2 list-disc list-inside text-sm">
                        {stripeStatus.requirements.currently_due.slice(0, 3).map((req, i) => (
                          <li key={i}>{req.replace(/_/g, ' ')}</li>
                        ))}
                        {stripeStatus.requirements.currently_due.length > 3 && (
                          <li>...and {stripeStatus.requirements.currently_due.length - 3} more</li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {!isFullyOnboarded && stripeStatus.onboardingStatus !== "needs_info" && (
                  <Alert>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertDescription>
                      Your Stripe account setup is in progress. Complete the onboarding to receive payments.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 flex-wrap">
                  {!isFullyOnboarded && (
                    <Button onClick={handleConnectStripe} disabled={connecting}>
                      {connecting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          {stripeStatus.onboardingStatus === "needs_info" ? "Complete Verification" : "Continue Onboarding"}
                        </>
                      )}
                    </Button>
                  )}
                  {isFullyOnboarded && (
                    <Button variant="outline" onClick={handleOpenDashboard}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Stripe Dashboard
                    </Button>
                  )}
                  {/* Always show disconnect — works for in-progress AND completed */}
                  <Button 
                    variant="destructive" 
                    onClick={handleDisconnectStripe} 
                    disabled={disconnecting}
                  >
                    {disconnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Disconnecting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Connection
                      </>
                    )}
                  </Button>
                </div>

                {/* Stripe Management Notice */}
                {isFullyOnboarded && (
                  <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
                    <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertDescription className="text-blue-800 dark:text-blue-200">
                      Payment method settings (cards, SEPA, iDEAL, etc.) are managed directly in your Stripe account.
                      <Button 
                        variant="link" 
                        className="p-0 h-auto text-blue-700 dark:text-blue-300 underline ml-1"
                        onClick={handleOpenDashboard}
                      >
                        Open Stripe Dashboard →
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Dynamic payment methods (mirrors Stripe 1:1) */}
                {isFullyOnboarded && (
                  <div className="pt-2">
                    <StripePaymentMethodsPanel />
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Not Connected */}
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                  <XCircle className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-medium">Not Connected</p>
                    <p className="text-sm text-muted-foreground">
                      Connect your Stripe account to start receiving card payments
                    </p>
                  </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
                  <p className="font-medium">What you'll need:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Valid email address</li>
                    <li>Bank account (IBAN) for payouts</li>
                    <li>Business or personal identification</li>
                  </ul>
                </div>

                <Button onClick={handleConnectStripe} disabled={connecting} className="w-full">
                  {connecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Connect with Stripe
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Payment Info */}
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">1</div>
                <div>
                  <p className="font-medium">Connect your Stripe account</p>
                  <p className="text-sm text-muted-foreground">Enter your bank details securely on Stripe</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">2</div>
                <div>
                  <p className="font-medium">Stripe manages payment methods</p>
                  <p className="text-sm text-muted-foreground">Cards and local payment methods are controlled in Stripe</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">3</div>
                <div>
                  <p className="font-medium">Receive payments automatically</p>
                  <p className="text-sm text-muted-foreground">{sellerPct}% goes directly to your bank, {feePct}% platform fee</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
