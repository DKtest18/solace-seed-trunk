import { supabase } from '@/integrations/supabase/client';
import { buildSupabaseFunctionError, logSupabaseFunctionError } from '@/lib/supabaseFunctionErrors';

export interface StripeConnectStatus {
  connected: boolean;
  accountId?: string;
  maskedAccountId?: string;
  onboardingStatus: 'not_connected' | 'onboarding' | 'connected' | 'needs_info';
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  email?: string;
  requirements?: {
    currently_due?: string[];
    eventually_due?: string[];
    past_due?: string[];
  };
  isTestMode?: boolean;
}

export const emptyStripeConnectStatus: StripeConnectStatus = {
  connected: false,
  onboardingStatus: 'not_connected',
  chargesEnabled: false,
  payoutsEnabled: false,
  detailsSubmitted: false,
};

async function invokeStripeFunction<T = any>(functionName: string, body?: Record<string, unknown>): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Please sign in again before managing Stripe payments.');
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body ?? {}),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || data?.error) {
    throw new Error(data?.detail || data?.error || `Stripe function failed: ${response.status}`);
  }

  return data as T;
}

export function mapStripeConnectStatus(data: any): StripeConnectStatus {
  const requirements = {
    currently_due: data?.requirements?.currently_due || [],
    eventually_due: data?.requirements?.eventually_due || [],
    past_due: data?.requirements?.past_due || [],
  };
  const onboardingStatus = data?.onboardingStatus || data?.onboarding_status || (
    !data?.connected ? 'not_connected' :
    requirements.currently_due.length > 0 || requirements.past_due.length > 0 ? 'needs_info' :
    (data?.onboarded || data?.detailsSubmitted || data?.details_submitted || data?.charges_enabled || data?.chargesEnabled) ? 'connected' :
    'onboarding'
  );

  return {
    connected: data?.connected ?? false,
    accountId: data?.accountId || data?.account_id,
    maskedAccountId: data?.maskedAccountId,
    onboardingStatus,
    chargesEnabled: data?.chargesEnabled ?? data?.charges_enabled ?? false,
    payoutsEnabled: data?.payoutsEnabled ?? data?.payouts_enabled ?? false,
    detailsSubmitted: data?.detailsSubmitted ?? data?.details_submitted ?? false,
    email: data?.email,
    requirements,
    isTestMode: data?.isTestMode ?? data?.is_test_mode,
  };
}

export async function fetchStripeConnectStatus(): Promise<StripeConnectStatus> {
  try {
    return mapStripeConnectStatus(await invokeStripeFunction('stripe-connect-status'));
  } catch (error) {
    logSupabaseFunctionError('Stripe status edge-function error', error);
    throw error;
  }
}

export async function createStripeConnectOnboardingLink(origin: string): Promise<string> {
  const data = await invokeStripeFunction<{ success?: boolean; url?: string }>('stripe-connect-onboarding', { origin });
  if (!data?.success || !data?.url) {
    const detailedError = await buildSupabaseFunctionError(
      'stripe-connect-onboarding',
      null,
      data,
      'Failed to create onboarding link',
    );
    throw detailedError;
  }
  return data.url;
}

export function isStripeConnectedForOnboarding(status: StripeConnectStatus): boolean {
  return status.connected && status.onboardingStatus === 'connected' && status.detailsSubmitted;
}