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
    const { data: seller } = await admin
      .from('dkaim_user_id')
      .select('stripe_account_id')
      .eq('id', user.id)
      .single();

    if (!seller?.stripe_account_id) return errorResponse('No Stripe account found');

    // Delete the Stripe account
    const res = await fetch(`https://api.stripe.com/v1/accounts/${seller.stripe_account_id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${stripeKey}` },
    });
    await res.text();

    // Clear dkaim_user_id
    await admin.from('dkaim_user_id').update({
      stripe_account_id: null,
      stripe_onboarded: false,
    }).eq('id', user.id);

    // Clear dkai_seller_payment_configs
    await admin.from('dkai_seller_payment_configs').update({
      stripe_account_id: null,
      stripe_onboarding_status: null,
      charges_enabled: false,
      card_payments_enabled: false,
      updated_at: new Date().toISOString(),
    }).eq('seller_id', user.id);

    return jsonResponse({ success: true });
  } catch (err: unknown) {
    return errorResponse(err instanceof Error ? err instanceof Error ? err.message : String(err) : String(err)), 500);
  }
});
