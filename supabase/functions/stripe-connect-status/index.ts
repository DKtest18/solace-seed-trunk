import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const stripeKey = Deno.env.get('DKAIM_STRIPE_SECRET_KEY');
    if (!stripeKey) return errorResponse('Stripe not configured: DKAIM_STRIPE_SECRET_KEY missing', 500);

    const admin = getServiceClient();

    // Get seller's Stripe account ID
    const { data: seller } = await admin
      .from('dkaim_user_id')
      .select('stripe_account_id, stripe_onboarded')
      .eq('id', user.id)
      .single();

    if (!seller?.stripe_account_id) {
      return jsonResponse({ connected: false, onboarded: false });
    }

    // Get account status from Stripe
    const res = await fetch(`https://api.stripe.com/v1/accounts/${seller.stripe_account_id}`, {
      headers: { 'Authorization': `Bearer ${stripeKey}` },
    });
    const account = await res.json();

    return jsonResponse({
      connected: true,
      onboarded: account.details_submitted || false,
      charges_enabled: account.charges_enabled || false,
      payouts_enabled: account.payouts_enabled || false,
      account_id: seller.stripe_account_id,
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});