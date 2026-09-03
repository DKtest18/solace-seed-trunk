import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

// SINGLE SOURCE OF TRUTH: public.dkai_seller_payment_configs (unique: seller_id).
const CONFIG_TABLE = 'dkai_seller_payment_configs';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const stripeKey = Deno.env.get('DKAIM_STRIPE_SECRET_KEY');
    if (!stripeKey) return errorResponse('Stripe not configured: DKAIM_STRIPE_SECRET_KEY missing', 500);

    const admin = getServiceClient();
    const { data: cfg, error: readError } = await admin
      .from(CONFIG_TABLE)
      .select('stripe_account_id')
      .eq('seller_id', user.id)
      .maybeSingle();

    if (readError) {
      console.error('stripe-connect-disconnect read error:', readError);
      return errorResponse('Could not read your payment configuration. Please try again.', 500);
    }
    if (!cfg?.stripe_account_id) return errorResponse('No Stripe account found');

    const res = await fetch(`https://api.stripe.com/v1/accounts/${cfg.stripe_account_id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    await res.text();

    const { error: clearError } = await admin
      .from(CONFIG_TABLE)
      .upsert(
        {
          seller_id: user.id,
          stripe_account_id: null,
          stripe_onboarding_status: 'not_connected',
          charges_enabled: false,
          payouts_enabled: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'seller_id' },
      );
    if (clearError) {
      console.error('stripe-connect-disconnect clear error:', clearError);
      return errorResponse('Could not clear your Stripe connection. Please try again.', 500);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    console.error('stripe-connect-disconnect error:', err);
    return errorResponse('Could not disconnect Stripe. Please try again.', 500);
  }
});
