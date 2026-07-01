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

export function mapStripeConnectStatus(data: any): StripeConnectStatus {
  return {
    connected: data?.connected ?? false,
    accountId: data?.accountId || data?.account_id,
    maskedAccountId: data?.maskedAccountId,
    onboardingStatus: data?.onboardingStatus || (
      !data?.connected ? 'not_connected' :
      (data?.onboarded || data?.charges_enabled || data?.chargesEnabled) ? 'connected' :
      'onboarding'
    ),
    chargesEnabled: data?.chargesEnabled ?? data?.charges_enabled ?? false,
    payoutsEnabled: data?.payoutsEnabled ?? data?.payouts_enabled ?? false,
    detailsSubmitted: data?.detailsSubmitted ?? data?.details_submitted ?? false,
    email: data?.email,
    requirements: data?.requirements,
    isTestMode: data?.isTestMode ?? data?.is_test_mode,
  };
}

export async function fetchStripeConnectStatus(): Promise<StripeConnectStatus> {
  const { data, error } = await supabase.functions.invoke('stripe-connect-status');
  if (error || data?.error) {
    const detailedError = await buildSupabaseFunctionError(
      'stripe-connect-status',
      error,
      data,
      'Failed to fetch Stripe connection status',
    );
    logSupabaseFunctionError('Stripe status edge-function error', detailedError);
    throw detailedError;
  }
  return mapStripeConnectStatus(data);
}

export function isStripeConnectedForOnboarding(status: StripeConnectStatus): boolean {
  return status.connected && (status.onboardingStatus === 'connected' || status.chargesEnabled || status.payoutsEnabled || status.detailsSubmitted);
}