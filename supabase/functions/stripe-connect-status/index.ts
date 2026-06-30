import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

const STRIPE_USER_TABLES = ['dkaim_user_id', 'dkai_user_id'];

function isMissingTable(error: any) {
  const message = String(error?.message || '');
  return error?.code === 'PGRST205' || message.includes('Could not find the table') || message.includes('schema cache') || message.includes('does not exist');
}

async function findStripeUserRow(admin: any, userId: string, select = 'stripe_account_id, stripe_onboarded') {
  let existingTable = STRIPE_USER_TABLES[0];
  for (const table of STRIPE_USER_TABLES) {
    const { data, error } = await admin.from(table).select(select).eq('id', userId).maybeSingle();
    if (!error) {
      existingTable = table;
      if (data) return { table, row: data };
      continue;
    }
    if (!isMissingTable(error)) throw error;
  }
  return { table: existingTable, row: null };
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

    // Determine onboarding status
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
      await admin.from(stripeUserTable).update({
        stripe_onboarded: isOnboarded,
      }).eq('id', user.id);
    }

    // Sync dkai_seller_payment_configs
    const { data: paymentConfig } = await admin
      .from('dkai_seller_payment_configs')
      .select('seller_id, stripe_onboarding_status, charges_enabled')
      .eq('seller_id', user.id)
      .maybeSingle();

    if (paymentConfig) {
      await admin.from('dkai_seller_payment_configs').update({
        stripe_account_id: seller.stripe_account_id,
        stripe_onboarding_status: onboardingStatus,
        charges_enabled: chargesEnabled,
        updated_at: new Date().toISOString(),
      }).eq('seller_id', user.id);
    } else {
      await admin.from('dkai_seller_payment_configs').insert({
        seller_id: user.id,
        stripe_account_id: seller.stripe_account_id,
        stripe_onboarding_status: onboardingStatus,
        charges_enabled: chargesEnabled,
      });
    }

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
