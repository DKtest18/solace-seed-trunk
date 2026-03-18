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

    // Check if seller already has a Stripe account
    const { data: seller } = await admin
      .from('dkaim_user_id')
      .select('stripe_account_id')
      .eq('user_id', user.id)
      .single();

    let accountId = seller?.stripe_account_id;

    if (!accountId) {
      // Create new Stripe Connect account
      const createRes = await fetch('https://api.stripe.com/v1/accounts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          type: 'express',
          'metadata[user_id]': user.id,
        }),
      });
      const account = await createRes.json();
      if (account.error) throw new Error(account.error.message);
      accountId = account.id;

      await admin.from('dkaim_user_id').upsert({
        user_id: user.id,
        stripe_account_id: accountId,
        stripe_onboarded: false,
      }, { onConflict: 'user_id' });
    }

    // Create onboarding link
    const linkRes = await fetch('https://api.stripe.com/v1/account_links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        account: accountId,
        refresh_url: `${req.headers.get('origin')}/seller/payment-settings`,
        return_url: `${req.headers.get('origin')}/seller/payment-settings?onboarded=true`,
        type: 'account_onboarding',
      }),
    });
    const link = await linkRes.json();
    if (link.error) throw new Error(link.error.message);

    return jsonResponse({ success: true, url: link.url });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});