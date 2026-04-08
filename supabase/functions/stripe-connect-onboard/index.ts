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

    // Read optional return_path from body
    let returnPath = '/seller-onboarding/payment';
    try {
      const body = await req.json();
      if (body?.return_path) returnPath = body.return_path;
    } catch { /* no body or invalid json, use default */ }

    const admin = getServiceClient();

    // Check if seller already has a Stripe account
    const { data: seller } = await admin
      .from('dkaim_user_id')
      .select('stripe_account_id')
      .eq('id', user.id)
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
        id: user.id,
        stripe_account_id: accountId,
        stripe_onboarded: false,
      }, { onConflict: 'id' });
    }

    // Create onboarding link — return to the page the user came from
    const origin = req.headers.get('origin') || 'https://solace-seed-trunk.lovable.app';
    const linkRes = await fetch('https://api.stripe.com/v1/account_links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        account: accountId,
        refresh_url: `${origin}${returnPath}?refresh=true`,
        return_url: `${origin}${returnPath}?onboarding=complete`,
        type: 'account_onboarding',
      }),
    });
    const link = await linkRes.json();
    if (link.error) throw new Error(link.error.message);

    return jsonResponse({ success: true, url: link.url });
  } catch (err: unknown) {
    return errorResponse(err instanceof Error ? err instanceof Error ? err.message : String(err) : String(err)), 500);
  }
});
