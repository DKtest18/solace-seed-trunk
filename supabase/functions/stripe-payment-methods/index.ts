// Fetch + update the seller's Stripe Connect account payment_method capabilities.
// GET-like (no body)  -> returns current capabilities
// POST { method, action: 'request' | 'cancel' } -> requests/cancels a capability
//
// All capabilities are scoped to the caller's own connected account, identified
// from the verified JWT. Stripe secret key is read from DKAIM_STRIPE_SECRET_KEY.
//
// Capabilities reference: https://stripe.com/docs/connect/account-capabilities
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

// Methods we expose in the UI. Each maps to a Stripe capability key.
// Keep this list in sync with the front-end.
const METHOD_CAPABILITIES: Record<string, string> = {
  card: 'card_payments',
  klarna: 'klarna_payments',
  afterpay_clearpay: 'afterpay_clearpay_payments',
  sepa_debit: 'sepa_debit_payments',
  ideal: 'ideal_payments',
  bancontact: 'bancontact_payments',
  giropay: 'giropay_payments',
  sofort: 'sofort_payments',
  eps: 'eps_payments',
  p24: 'p24_payments',
  link: 'link_payments',
  cashapp: 'cashapp_payments',
  us_bank_account: 'us_bank_account_ach_payments',
  affirm: 'affirm_payments',
};

const STRIPE_FORM = (body: Record<string, string>) =>
  new URLSearchParams(body).toString();

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error: authError } = await getAuthenticatedUser(req);
  if (authError || !user) return errorResponse('Unauthorized', 401);

  const stripeKey = Deno.env.get('DKAIM_STRIPE_SECRET_KEY');
  if (!stripeKey) return errorResponse('Stripe not configured', 500);

  const admin = getServiceClient();
  const { data: seller } = await admin
    .from('dkaim_user_id')
    .select('stripe_account_id')
    .eq('id', user.id)
    .single();

  if (!seller?.stripe_account_id) {
    return errorResponse('No connected Stripe account', 400);
  }
  const acct = seller.stripe_account_id;

  try {
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const method = String(body.method || '');
      const action = String(body.action || '');
      const capability = METHOD_CAPABILITIES[method];
      if (!capability) return errorResponse('Unknown payment method', 400);
      if (action !== 'request' && action !== 'cancel') {
        return errorResponse('action must be "request" or "cancel"', 400);
      }

      const res = await fetch(
        `https://api.stripe.com/v1/accounts/${acct}/capabilities/${capability}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: STRIPE_FORM({ requested: action === 'request' ? 'true' : 'false' }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        return errorResponse(json.error?.message || 'Stripe error', 400);
      }

      // Persist intent locally so UI is fast/consistent.
      await admin.from('dkai_seller_payment_methods').upsert(
        {
          seller_id: user.id,
          method,
          enabled: action === 'request',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'seller_id,method' },
      );

      return jsonResponse({ ok: true, capability: json });
    }

    // GET: return current capabilities from Stripe + saved local state
    const accountRes = await fetch(`https://api.stripe.com/v1/accounts/${acct}`, {
      headers: { 'Authorization': `Bearer ${stripeKey}` },
    });
    const account = await accountRes.json();
    if (!accountRes.ok) {
      return errorResponse(account.error?.message || 'Stripe error', 400);
    }

    const caps = (account.capabilities || {}) as Record<string, string>;
    const country = account.country || null;

    const methods = Object.entries(METHOD_CAPABILITIES).map(([method, capKey]) => {
      const state = caps[capKey] || 'unrequested'; // active | pending | inactive | unrequested
      return {
        method,
        capability: capKey,
        state,
        enabled: state === 'active' || state === 'pending',
        available: state !== undefined, // every key is queryable; UI can hide unsupported
      };
    });

    return jsonResponse({ accountId: acct, country, methods, rawCapabilities: caps });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
