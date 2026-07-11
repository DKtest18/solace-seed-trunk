import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

const STRIPE_ACCOUNT_TABLES = ['dkaim_user_id', 'dkai_user_id', 'dkai_profiles'];
const PAYMENT_CONFIG_TABLES = ['dkai_seller_payment_configs', 'seller_payment_configs'];

function isSchemaError(error: any) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 'PGRST204' || error?.code === 'PGRST205' || message.includes('could not find the table') || message.includes('schema cache') || message.includes('does not exist') || message.includes('column');
}

async function findStripeUserRow(admin: any, userId: string) {
  let existingTable = STRIPE_ACCOUNT_TABLES[0];
  let firstRow: { table: string; row: any } | null = null;

  for (const table of STRIPE_ACCOUNT_TABLES) {
    const { data, error } = await admin.from(table).select('stripe_account_id, stripe_onboarded').eq('id', userId).maybeSingle();
    if (!error) {
      existingTable = table;
      if (data?.stripe_account_id) return { table, row: data };
      if (data && !firstRow) firstRow = { table, row: data };
      continue;
    }
    if (isSchemaError(error)) {
      const fallback = await admin.from(table).select('stripe_account_id').eq('id', userId).maybeSingle();
      if (!fallback.error) {
        existingTable = table;
        if (fallback.data?.stripe_account_id) return { table, row: fallback.data };
        if (fallback.data && !firstRow) firstRow = { table, row: fallback.data };
        continue;
      }
      if (!isSchemaError(fallback.error)) throw fallback.error;
      continue;
    }
    throw error;
  }
  return firstRow ?? { table: existingTable, row: null };
}

async function updateStripeStorageOnboarded(admin: any, table: string, userId: string, isOnboarded: boolean) {
  const attempts = [
    { stripe_onboarded: isOnboarded, stripe_onboarding_complete: isOnboarded ? new Date().toISOString() : null },
    { stripe_onboarded: isOnboarded },
    { stripe_onboarding_complete: isOnboarded ? new Date().toISOString() : null },
  ];

  for (const values of attempts) {
    const { error } = await admin.from(table).update(values).eq('id', userId);
    if (!error) return;
    if (!isSchemaError(error)) throw error;
  }
}

async function syncSellerPaymentConfig(
  admin: any,
  userId: string,
  accountId: string,
  status: string,
  chargesEnabled: boolean,
  payoutsEnabled: boolean,
  detailsSubmitted: boolean,
) {
  const now = new Date().toISOString();

  for (const table of PAYMENT_CONFIG_TABLES) {
    const existing = await admin.from(table).select('seller_id').eq('seller_id', userId).maybeSingle();
    if (existing.error) {
      if (isSchemaError(existing.error)) continue;
      throw existing.error;
    }

    const payloadAttempts = [
      {
        seller_id: userId,
        stripe_account_id: accountId,
        stripe_onboarding_status: status,
        charges_enabled: chargesEnabled,
        payouts_enabled: payoutsEnabled,
        card_payments_enabled: chargesEnabled,
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
      {
        seller_id: userId,
        stripe_account_id: accountId,
        stripe_onboarding_status: status,
        card_payments_enabled: chargesEnabled,
        payouts_enabled: payoutsEnabled,
        onboarding_completed_at: detailsSubmitted ? now : null,
        updated_at: now,
      },
      {
        seller_id: userId,
        stripe_account_id: accountId,
        stripe_onboarding_status: status,
        updated_at: now,
      },
      {
        seller_id: userId,
        stripe_account_id: accountId,
        stripe_onboarding_status: status,
      },
    ];

    for (const payload of payloadAttempts) {
      const result = existing.data
        ? await admin.from(table).update(payload).eq('seller_id', userId)
        : await admin.from(table).insert(payload);

      if (!result.error) return;
      if (!isSchemaError(result.error)) throw result.error;
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

    // Get seller's Stripe account ID from the real Stripe user table.
    const { table: stripeUserTable, row: seller } = await findStripeUserRow(admin, user.id);

    if (!seller?.stripe_account_id) {
      return jsonResponse({
        connected: false,
        onboardingStatus: 'not_connected',
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      });
    }

    // Get account status from Stripe
    const res = await fetch(`https://api.stripe.com/v1/accounts/${seller.stripe_account_id}`, {
      headers: { 'Authorization': `Bearer ${stripeKey}` },
    });
    const account = await res.json();

    if (account.error) {
      // Account may have been deleted on Stripe side
      return jsonResponse({
        connected: false,
        onboardingStatus: 'not_connected',
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      });
    }

    const chargesEnabled = account.charges_enabled || false;
    const payoutsEnabled = account.payouts_enabled || false;
    const detailsSubmitted = account.details_submitted || false;
    const isTestMode = stripeKey.startsWith('sk_test_');

    // Determine onboarding status. If Stripe says details were submitted and
    // there are no current/past due requirements, do not send the seller back
    // through the onboarding form just because charges/payouts are still under review.
    let onboardingStatus: string;
    if (chargesEnabled && payoutsEnabled && detailsSubmitted) {
      onboardingStatus = 'connected';
    } else if (account.requirements?.currently_due?.length > 0 || account.requirements?.past_due?.length > 0) {
      onboardingStatus = 'needs_info';
    } else if (detailsSubmitted) {
      onboardingStatus = 'connected';
    } else {
      onboardingStatus = 'onboarding';
    }

    // Sync onboarded flag on the detected Stripe user table.
    const isOnboarded = onboardingStatus === 'connected';
    if (seller.stripe_onboarded !== isOnboarded) {
      await updateStripeStorageOnboarded(admin, stripeUserTable, user.id, isOnboarded);
    }

    await syncSellerPaymentConfig(
      admin,
      user.id,
      seller.stripe_account_id,
      onboardingStatus,
      chargesEnabled,
      payoutsEnabled,
      detailsSubmitted,
    );

    // Mask account ID for display
    const maskedAccountId = seller.stripe_account_id
      ? `acct_****${seller.stripe_account_id.slice(-4)}`
      : undefined;

    return jsonResponse({
      connected: true,
      accountId: seller.stripe_account_id,
      maskedAccountId,
      onboardingStatus,
      chargesEnabled,
      payoutsEnabled,
      detailsSubmitted,
      email: account.email || undefined,
      requirements: account.requirements ? {
        currently_due: account.requirements.currently_due || [],
        eventually_due: account.requirements.eventually_due || [],
        past_due: account.requirements.past_due || [],
      } : undefined,
      isTestMode,
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
