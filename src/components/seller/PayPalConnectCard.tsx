import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Trash2,
  Wallet,
  XCircle,
} from 'lucide-react';
import {
  createPayPalOnboardingLink,
  disconnectPayPal,
  emptyPayPalConnectStatus,
  fetchPayPalConnectStatus,
  isPayPalConnectedForOnboarding,
  pollPayPalConnectStatus,
  type PayPalConnectStatus,
} from '@/lib/paypalConnectStatus';

interface PayPalConnectCardProps {
  /** Route to strip the PayPal return params from, e.g. "/seller/payment-settings" */
  returnPath: string;
  onStatusChange?: (status: PayPalConnectStatus) => void;
}

export function PayPalConnectCard({ returnPath, onStatusChange }: PayPalConnectCardProps) {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<PayPalConnectStatus>(emptyPayPalConnectStatus);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const apply = (next: PayPalConnectStatus) => {
    setStatus(next);
    onStatusChange?.(next);
  };

  const load = async () => {
    setRefreshing(true);
    try {
      apply(await fetchPayPalConnectStatus());
    } catch (error: any) {
      console.error('Error fetching PayPal status:', error);
      // A missing function/config should not break the page — show "not connected".
      apply(emptyPayPalConnectStatus);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PayPal sends the seller back with merchantIdInPayPal / permissionsGranted.
  // Those params are advisory only — the real state is re-verified server-side.
  useEffect(() => {
    const isReturn =
      searchParams.get('paypal') === 'return' ||
      searchParams.has('merchantIdInPayPal') ||
      searchParams.has('permissionsGranted');
    if (!isReturn) return;

    setLoading(true);
    setRefreshing(true);
    toast.info('Returned from PayPal. Verifying your merchant account...');
    pollPayPalConnectStatus({
      stopWhen: (s) => isPayPalConnectedForOnboarding(s) || s.onboardingStatus === 'needs_info',
    })
      .then((s) => {
        apply(s);
        if (isPayPalConnectedForOnboarding(s)) {
          toast.success('PayPal connected — your merchant account is linked');
        } else if (s.onboardingStatus === 'needs_info') {
          toast.info('PayPal needs a bit more information before you can receive payments.');
        } else {
          toast.info('PayPal is still finishing your setup. Use Refresh in a moment.');
        }
      })
      .catch((error) => {
        console.error('Error syncing PayPal status:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to sync PayPal status');
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
        window.history.replaceState({}, '', returnPath);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const url = await createPayPalOnboardingLink(window.location.origin);
      toast.info('Redirecting to PayPal...');
      window.location.href = url;
    } catch (error: any) {
      console.error('paypal-connect-onboarding failed:', error);
      toast.error(error?.message || 'Failed to create PayPal onboarding link');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (
      !confirm(
        'Disconnect your PayPal account? Buyers will no longer be able to pay you with PayPal. You can reconnect at any time.',
      )
    ) {
      return;
    }
    setDisconnecting(true);
    try {
      await disconnectPayPal();
      toast.success('PayPal account disconnected.');
      apply(emptyPayPalConnectStatus);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to disconnect PayPal');
    } finally {
      setDisconnecting(false);
    }
  };

  const isFullyOnboarded = isPayPalConnectedForOnboarding(status);

  const badge = () => {
    const modeLabel = status.isSandbox ? ' (Sandbox)' : '';
    if (status.onboardingStatus === 'unsupported_country') {
      return <Badge variant="secondary">Not available in your country</Badge>;
    }
    if (!status.connected) return <Badge variant="destructive">Not Connected</Badge>;
    if (isFullyOnboarded) {
      return <Badge className="bg-green-500 hover:bg-green-600">Connected{modeLabel}</Badge>;
    }
    if (status.onboardingStatus === 'needs_info') {
      return <Badge className="bg-orange-500 hover:bg-orange-600">Needs Info</Badge>;
    }
    return <Badge className="bg-yellow-500 hover:bg-yellow-600">Verifying…</Badge>;
  };

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              PayPal
            </CardTitle>
            <CardDescription>
              Connect your PayPal business account to accept PayPal payments
            </CardDescription>
          </div>
          {badge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {status.onboardingStatus === 'unsupported_country' ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              PayPal onboarding isn&apos;t available for sellers in your country. Please use Stripe
              to receive payments.
            </AlertDescription>
          </Alert>
        ) : status.connected ? (
          <>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                {isFullyOnboarded ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : status.onboardingStatus === 'needs_info' ? (
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                ) : (
                  <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />
                )}
                <div>
                  <p className="font-medium">
                    {isFullyOnboarded
                      ? `PayPal Connected${status.isSandbox ? ' (Sandbox)' : ' (Live)'}`
                      : status.onboardingStatus === 'needs_info'
                        ? 'Additional Information Required'
                        : 'Setup in Progress'}
                  </p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {status.maskedMerchantId || status.email || status.merchantId}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={load} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh Status
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="p-3 rounded-lg border text-center">
                <div
                  className={`font-medium ${status.paymentsReceivable ? 'text-green-600' : 'text-yellow-600'}`}
                >
                  {status.paymentsReceivable ? '✓' : '○'} Payments
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {status.paymentsReceivable ? 'Receivable' : 'Pending'}
                </p>
              </div>
              <div className="p-3 rounded-lg border text-center">
                <div
                  className={`font-medium ${status.primaryEmailConfirmed ? 'text-green-600' : 'text-yellow-600'}`}
                >
                  {status.primaryEmailConfirmed ? '✓' : '○'} Email
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {status.primaryEmailConfirmed ? 'Confirmed' : 'Unconfirmed'}
                </p>
              </div>
              <div className="p-3 rounded-lg border text-center">
                <div
                  className={`font-medium ${status.partnerFeeGranted ? 'text-green-600' : 'text-yellow-600'}`}
                >
                  {status.partnerFeeGranted ? '✓' : '○'} Permissions
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {status.partnerFeeGranted ? 'Granted' : 'Pending'}
                </p>
              </div>
            </div>

            {!isFullyOnboarded && (
              <Alert variant={status.onboardingStatus === 'needs_info' ? 'destructive' : 'default'}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {status.missing && status.missing.length > 0 ? (
                    <>
                      <strong>Action Required:</strong> PayPal still needs:
                      <ul className="mt-2 list-disc list-inside text-sm">
                        {status.missing.slice(0, 4).map((m, i) => (
                          <li key={i}>{m.replace(/_/g, ' ').toLowerCase()}</li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    'Finish the PayPal setup so you can receive payments.'
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3 flex-wrap">
              {!isFullyOnboarded && (
                <Button onClick={handleConnect} disabled={connecting}>
                  {connecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Continue PayPal Setup
                    </>
                  )}
                </Button>
              )}
              <Button variant="destructive" onClick={handleDisconnect} disabled={disconnecting}>
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
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <XCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium">Not Connected</p>
                <p className="text-sm text-muted-foreground">
                  Link your PayPal business account to accept PayPal payments
                </p>
              </div>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
              <p className="font-medium">What you&apos;ll need:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>A PayPal business account (or create one during setup)</li>
                <li>A confirmed primary email address</li>
                <li>To grant the marketplace permission to process payments for you</li>
              </ul>
            </div>

            <Button onClick={handleConnect} disabled={connecting} className="w-full">
              {connecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect with PayPal
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
