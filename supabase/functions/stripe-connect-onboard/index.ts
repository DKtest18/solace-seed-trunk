import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

// Legacy alias of `stripe-connect-onboarding`. It used to write into the
// non-existent tables `dkaim_user_id` / `dkai_user_id`, which broke the
// first-time connect path. It now uses the canonical config table only.
const CONFIG_TABLE = 'dkai_seller_payment_configs';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const stripeKey = Deno.env.get('DKAIM_STRIPE_SECRET_KEY');
    if (!stripeKey) return errorResponse('Stripe not configured: DKAIM_STRIPE_SECRET_KEY missing', 500);

    let returnPath = '/seller/payment-settings';
    const body = await req.json().catch(() => ({}));
    if (typeof body?.return_path === 'string' && body.return_path.startsWith('/')) {
      returnPath = body.return_path;
    }

    const admin = getServiceClient();
    const { data: cfg } = await admin
      .from(CONFIG_TABLE)
      .select('stripe_account_id')
      .eq('seller_id', user.id)
      .maybeSingle();

    let accountId: string | null = cfg?.stripe_account_id ?? null;

    if (!accountId) {
      const createRes = await fetch('https://api.stripe.com/v1/accounts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          type: 'express',
          'metadata[user_id]': user.id,
          ...(user.email ? { email: user.email } : {}),
        }),
      });
      const account = await createRes.json();
      if (!createRes.ok || account.error) {
        return errorResponse(account.error?.message || 'Stripe failed to create Express account', 500);
      }
      accountId = account.id;
    }

    const { error: saveError } = await admin.from(CONFIG_TABLE).upsert(
      {
        seller_id: user.id,
        stripe_account_id: accountId,
        stripe_onboarding_status: 'onboarding',
        stripe_onboarded: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'seller_id' },
    );
    if (saveError) {
      console.error('stripe-connect-onboard save error:', saveError);
      return errorResponse(
        'We could not save your Stripe account to your seller profile. Please try again.',
        500,
      );
    }

    const origin = req.headers.get('origin') || 'https://dkaimarketplace.com';
    const linkRes = await fetch('https://api.stripe.com/v1/account_links', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        account: accountId!,
        refresh_url: `${origin}${returnPath}?refresh=true`,
        return_url: `${origin}${returnPath}?onboarding=complete`,
        type: 'account_onboarding',
      }),
    });
    const link = await linkRes.json();
    if (!linkRes.ok || link.error) {
      return errorResponse(link.error?.message || 'Stripe failed to create onboarding link', 500);
    }

    return jsonResponse({ success: true, url: link.url });
  } catch (err) {
    console.error('stripe-connect-onboard error:', err);
    return errorResponse('Could not start Stripe onboarding. Please try again.', 500);
  }
});
