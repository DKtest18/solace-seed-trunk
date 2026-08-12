import { supabase } from '@/integrations/supabase/client';
import { logSupabaseFunctionError } from '@/lib/supabaseFunctionErrors';
import { readFunctionErrorMessage } from '@/lib/stripeConnectStatus';

export type PayPalOnboardingStatus =
  | 'not_connected'
  | 'onboarding'
  | 'connected'
  | 'needs_info'
  | 'unsupported_country';

export interface PayPalConnectStatus {
  connected: boolean;
  merchantId?: string;
  maskedMerchantId?: string;
  trackingId?: string;
  email?: string;
  onboardingStatus: PayPalOnboardingStatus;
  paymentsReceivable: boolean;
  primaryEmailConfirmed: boolean;
  partnerFeeGranted: boolean;
  permissionsGranted: boolean;
  isSandbox?: boolean;
  missing?: string[];
}

export const emptyPayPalConnectStatus: PayPalConnectStatus = {
  connected: false,
  onboardingStatus: 'not_connected',
  paymentsReceivable: false,
  primaryEmailConfirmed: false,
  partnerFeeGranted: false,
  permissionsGranted: false,
  missing: [],
};

export function mapPayPalConnectStatus(data: any): PayPalConnectStatus {
  const merchantId = data?.merchantId || data?.merchant_id || undefined;
  const paymentsReceivable = data?.paymentsReceivable ?? data?.payments_receivable ?? false;
  const primaryEmailConfirmed = data?.primaryEmailConfirmed ?? data?.primary_email_confirmed ?? false;
  const partnerFeeGranted = data?.partnerFeeGranted ?? data?.partner_fee_granted ?? false;
  const permissionsGranted = data?.permissionsGranted ?? data?.permissions_granted ?? false;
  const connected = data?.connected ?? !!merchantId;

  const onboardingStatus: PayPalOnboardingStatus =
    data?.onboardingStatus ||
    data?.onboarding_status ||
    (!connected
      ? 'not_connected'
      : paymentsReceivable && primaryEmailConfirmed && partnerFeeGranted
        ? 'connected'
        : permissionsGranted
          ? 'needs_info'
          : 'onboarding');

  return {
    connected,
    merchantId,
    maskedMerchantId: data?.maskedMerchantId || data?.masked_merchant_id,
    trackingId: data?.trackingId || data?.tracking_id,
    email: data?.email,
    onboardingStatus,
    paymentsReceivable,
    primaryEmailConfirmed,
    partnerFeeGranted,
    permissionsGranted,
    isSandbox: data?.isSandbox ?? data?.is_sandbox,
    missing: data?.missing ?? [],
  };
}

export async function fetchPayPalConnectStatus(): Promise<PayPalConnectStatus> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  // Not signed in yet (e.g. during onboarding bootstrap) — no PayPal link can exist.
  if (!session?.access_token) return emptyPayPalConnectStatus;

  const { data, error } = await supabase.functions.invoke('paypal-connect-status', {
    body: {},
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error || (data as any)?.error) {
    const detail = await readFunctionErrorMessage(error);
    const msg =
      detail ||
      (data as any)?.detail ||
      (data as any)?.error ||
      error?.message ||
      'paypal-connect-status failed';
    logSupabaseFunctionError('PayPal status edge-function error', error ?? new Error(msg));
    throw new Error(msg);
  }
  return mapPayPalConnectStatus(data);
}


export async function createPayPalOnboardingLink(origin: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('paypal-connect-onboarding', {
    body: { origin },
  });
  if (error || !(data as any)?.url) {
    const detail = await readFunctionErrorMessage(error);
    const msg =
      detail ||
      (data as any)?.paypal_error ||
      (data as any)?.error ||
      error?.message ||
      'paypal-connect-onboarding returned no url';
    logSupabaseFunctionError('PayPal onboarding edge-function error', error ?? new Error(msg));
    throw new Error(msg);
  }
  return (data as any).url as string;
}

export async function disconnectPayPal(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('paypal-connect-disconnect');
  if (error || (data as any)?.error || !(data as any)?.success) {
    const detail = await readFunctionErrorMessage(error);
    const msg =
      detail || (data as any)?.error || error?.message || 'Failed to disconnect PayPal';
    throw new Error(msg);
  }
}

export function isPayPalConnectedForOnboarding(status: PayPalConnectStatus): boolean {
  return (
    status.connected &&
    status.onboardingStatus === 'connected' &&
    status.paymentsReceivable &&
    status.primaryEmailConfirmed
  );
}

export async function pollPayPalConnectStatus(options?: {
  maxAttempts?: number;
  intervalMs?: number;
  stopWhen?: (status: PayPalConnectStatus) => boolean;
}): Promise<PayPalConnectStatus> {
  const maxAttempts = options?.maxAttempts ?? 10;
  const intervalMs = options?.intervalMs ?? 2_000;
  const stopWhen =
    options?.stopWhen ??
    ((status) => status.connected && status.onboardingStatus !== 'onboarding');
  let latest = emptyPayPalConnectStatus;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    latest = await fetchPayPalConnectStatus();
    if (stopWhen(latest)) return latest;
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  return latest;
}
