import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

// SINGLE SOURCE OF TRUTH: public.dkai_seller_payment_configs (unique: seller_id).
// Legacy identity tables (dkaim_user_id / dkai_user_id / …) are never queried.
const CONFIG_TABLE = 'dkai_seller_payment_configs';

function isSchemaError(error: any) {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === 'PGRST204' ||
    error?.code === '42703' ||
    message.includes('schema cache') ||
    message.includes('column')
  );
}

async function readAccountId(admin: any, userId: string): Promise<string | null> {
  const { data, error } = await admin
    .from(CONFIG_TABLE)
    .select('stripe_account_id')
    .eq('seller_id', userId)
    .maybeSingle();
  if (error) {
    console.error('readAccountId error:', error);
    return null;
  }
  return data?.stripe_account_id ?? null;
}

/** Upsert on seller_id — creates the row for first-time sellers, updates otherwise. */
async function persistState(
  admin: any,
  userId: string,
  accountId: string | null,
  status: string,
  chargesEnabled: boolean,
  payoutsEnabled: boolean,
  detailsSubmitted: boolean,
) {
  const now = new Date().toISOString();
  const payloads = [
    {
      seller_id: userId,
      stripe_account_id: accountId,
      stripe_onboarding_status: status,
      onboarding_status: status,
      stripe_onboarded: status === 'connected',
      charges_enabled: chargesEnabled,
      payouts_enabled: payoutsEnabled,
      card_payments_enabled: chargesEnabled,
      details_submitted: detailsSubmitted,
      onboarding_completed_at: detailsSubmitted ? now : null,
      updated_at: now,
    },
    {
      seller_id: userId,
      stripe_account_id: accountId,
      stripe_onboarding_status: status,
      charges_enabled: chargesEnabled,
      payouts_enabled: payoutsEnabled,
      updated_at: now,
    },
    { seller_id: userId, stripe_account_id: accountId, stripe_onboarding_status: status },
    { seller_id: userId, stripe_account_id: accountId },
  ];

  for (const payload of payloads) {
    const { error } = await admin.from(CONFIG_TABLE).upsert(payload, { onConflict: 'seller_id' });
    if (!error) return;
    if (!isSchemaError(error)) {
      console.error('persistState error:', error);
      return;
    }
  }
}

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const stripeKey = Deno.env.get('DKAIM_STRIPE_SECRET_KEY');
    if (!stripeKey) return errorResponse('Stripe not configured: DKAIM_STRIPE_SECRET_KEY missing', 500);

    const admin = getServiceClient();
    const accountId = await readAccountId(admin, user.id);

    const notConnected = {
      connected: false,
      onboardingStatus: 'not_connected',
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      isTestMode: stripeKey.startsWith('sk_test_'),
    };

    if (!accountId) return jsonResponse(notConnected);

    const res = await fetch(`https://api.stripe.com/v1/accounts/${accountId}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    const account = await res.json();

    if (account.error) {
      // Account no longer exists on Stripe: clear it so the seller can reconnect.
      await persistState(admin, user.id, null, 'not_connected', false, false, false);
      return jsonResponse(notConnected);
    }

    const chargesEnabled = account.charges_enabled || false;
    const payoutsEnabled = account.payouts_enabled || false;
    const detailsSubmitted = account.details_submitted || false;

    let onboardingStatus: string;
    if (chargesEnabled && payoutsEnabled && detailsSubmitted) onboardingStatus = 'connected';
    else if (
      account.requirements?.currently_due?.length > 0 ||
      account.requirements?.past_due?.length > 0
    )
      onboardingStatus = 'needs_info';
    else if (detailsSubmitted) onboardingStatus = 'connected';
    else onboardingStatus = 'onboarding';

    // Persistence must never break the response.
    try {
      await persistState(
        admin,
        user.id,
        accountId,
        onboardingStatus,
        chargesEnabled,
        payoutsEnabled,
        detailsSubmitted,
      );
    } catch (persistErr) {
      console.error('stripe-connect-status persist failed:', persistErr);
    }

    return jsonResponse({
      connected: true,
      accountId,
      maskedAccountId: `acct_****${accountId.slice(-4)}`,
      onboardingStatus,
      chargesEnabled,
      payoutsEnabled,
      detailsSubmitted,
      email: account.email || undefined,
      requirements: account.requirements
        ? {
            currently_due: account.requirements.currently_due || [],
            eventually_due: account.requirements.eventually_due || [],
            past_due: account.requirements.past_due || [],
          }
        : undefined,
      isTestMode: stripeKey.startsWith('sk_test_'),
    });
  } catch (err) {
    console.error('stripe-connect-status error:', err);
    return errorResponse('Could not read your Stripe status. Please try again.', 500);
  }
});
