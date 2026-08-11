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

/** Reads the JSON/text body of a failed functions.invoke() error. */
export async function readFunctionErrorMessage(error: unknown): Promise<string | undefined> {
  const ctx: any = (error as any)?.context;
  if (ctx && typeof ctx.clone === 'function') {
    try {
      const body = await ctx.clone().json();
      return body?.detail || body?.error || body?.paypal_error || body?.stripe_error || body?.message;
    } catch {
      try {
        const text = await ctx.clone().text();
        return text?.slice(0, 500) || undefined;
      } catch {
        /* ignore */
      }
    }
  }
  return undefined;
}

async function invokeStripeFunction<T = any>(functionName: string, body?: Record<string, unknown>): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Please sign in again before managing Stripe payments.');
  }

  const { data, error } = await supabase.functions.invoke(functionName, { body: body ?? {} });

  if (error || (data as any)?.error) {
    const detail = await readFunctionErrorMessage(error);
    throw new Error(
      detail ||
        (data as any)?.detail ||
        (data as any)?.error ||
        (error as any)?.message ||
        `${functionName} failed`,
    );
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
  const { data, error } = await supabase.functions.invoke('stripe-connect-onboarding', { body: { origin } });
  if (error || !data?.url) {
    const msg = (data as any)?.error || error?.message || 'stripe-connect-onboarding returned no url';
    throw new Error(msg);
  }
  return data.url as string;
}

export async function pollStripeConnectStatus(options?: {
  maxAttempts?: number;
  intervalMs?: number;
  stopWhen?: (status: StripeConnectStatus) => boolean;
}): Promise<StripeConnectStatus> {
  const maxAttempts = options?.maxAttempts ?? 10;
  const intervalMs = options?.intervalMs ?? 2_000;
  const stopWhen = options?.stopWhen ?? ((status) => status.connected && status.onboardingStatus !== 'onboarding');
  let latest = emptyStripeConnectStatus;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    latest = await fetchStripeConnectStatus();
    if (stopWhen(latest)) return latest;
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  return latest;
}

export function isStripeConnectedForOnboarding(status: StripeConnectStatus): boolean {
  return status.connected && status.onboardingStatus === 'connected' && status.detailsSubmitted;
}