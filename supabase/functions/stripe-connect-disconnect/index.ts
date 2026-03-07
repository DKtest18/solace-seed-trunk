import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) return errorResponse('Stripe not configured', 500);

    const admin = getServiceClient();
    const { data: seller } = await admin
      .from('dkai_seller_profiles')
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .single();

    if (!seller?.stripe_account_id) return errorResponse('No Stripe account found');

    // Delete the Stripe account
    const res = await fetch(`https://api.stripe.com/v1/accounts/${seller.stripe_account_id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${stripeKey}` },
    });
    await res.text();

    await admin.from('dkai_seller_profiles').update({
      stripe_account_id: null,
      stripe_onboarded: false,
    }).eq('user_id', user.id);

    return jsonResponse({ success: true });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
