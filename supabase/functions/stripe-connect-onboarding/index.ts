import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';
import { allowedSellerCountries, normalizeCountry } from '../_shared/seller-countries.ts';

const CONFIG_TABLE = 'dkai_seller_payment_configs';
const FULL_SERVICE_AGREEMENT_COUNTRIES = new Set(['CH', 'LI', 'DE', 'AT', 'US']);

function isSchemaError(error: any) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 'PGRST204' || error?.code === '42703' || message.includes('schema cache') || message.includes('column');
}

function normalizeOrigin(req: Request, bodyOrigin?: string) {
  const candidate = bodyOrigin || req.headers.get('origin') || 'https://dkaimarketplace.com';
  try { return new URL(candidate).origin; } catch { return 'https://dkaimarketplace.com'; }
}

async function readConfig(admin: any, userId: string): Promise<any | null> {
  const { data, error } = await admin
    .from(CONFIG_TABLE)
    .select('stripe_account_id, declared_country, stripe_account_country')
    .eq('seller_id', userId)
    .maybeSingle();
  if (error) {
    console.error('readConfig error:', error);
    return null;
  }
  return data ?? null;
}

async function persistAccountState(admin: any, userId: string, payload: Record<string, unknown>) {
  const now = new Date().toISOString();
  const payloads = [
    { seller_id: userId, ...payload, updated_at: now },
    { seller_id: userId, stripe_account_id: payload.stripe_account_id, stripe_onboarding_status: payload.stripe_onboarding_status, declared_country: payload.declared_country, updated_at: now },
    { seller_id: userId, stripe_account_id: payload.stripe_account_id, stripe_onboarding_status: payload.stripe_onboarding_status },
    { seller_id: userId, stripe_account_id: payload.stripe_account_id },
  ];
  for (const candidate of payloads) {
    const { error } = await admin.from(CONFIG_TABLE).upsert(candidate, { onConflict: 'seller_id' });
    if (!error) return true;
    if (!isSchemaError(error)) {
      console.error('persistAccountState error:', error);
      return false;
    }
  }
  return false;
}

async function stripeAccount(admin: any, accountId: string, stripeKey: string, userId: string) {
  const res = await fetch(`https://api.stripe.com/v1/accounts/${accountId}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  const account = await res.json();
  if (!res.ok || account.error) return null;
  await persistAccountState(admin, userId, {
    stripe_account_id: accountId,
    stripe_onboarding_status: account.details_submitted ? 'connected' : 'onboarding',
    onboarding_status: account.details_submitted ? 'connected' : 'onboarding',
    stripe_onboarded: !!account.details_submitted,
    charges_enabled: !!account.charges_enabled,
    payouts_enabled: !!account.payouts_enabled,
    card_payments_enabled: !!account.charges_enabled,
    details_submitted: !!account.details_submitted,
    transfers_capability_active: account.capabilities?.transfers === 'active',
    stripe_account_country: account.country ?? null,
    stripe_default_currency: account.default_currency ?? null,
    stripe_service_agreement: account.tos_acceptance?.service_agreement ?? 'full',
    account_restricted: !!account.requirements?.disabled_reason,
    requirements_snapshot: account.requirements ?? null,
    capabilities_synced_at: new Date().toISOString(),
  });
  return account;
}

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const stripeKey = Deno.env.get('DKAIM_STRIPE_SECRET_KEY');
    if (!stripeKey) return errorResponse('Stripe not configured: DKAIM_STRIPE_SECRET_KEY missing', 500);

    const body = await req.json().catch(() => ({}));
    const origin = normalizeOrigin(req, typeof body?.origin === 'string' ? body.origin : undefined);
    const admin = getServiceClient();
    const allowlist = await allowedSellerCountries(admin);
    const requestedCountry = normalizeCountry(body?.country ?? body?.seller_country ?? body?.declared_country);
    const existing = await readConfig(admin, user.id);
    let existingCountry = normalizeCountry(existing?.declared_country) ?? normalizeCountry(existing?.stripe_account_country);
    let accountId: string | null = existing?.stripe_account_id ?? null;
    let existingAccount: any | null = null;

    if (accountId && !requestedCountry && !existingCountry) {
      existingAccount = await stripeAccount(admin, accountId, stripeKey, user.id);
      if (!existingAccount) accountId = null;
      existingCountry = normalizeCountry(existingAccount?.country);
    }

    const country = requestedCountry ?? existingCountry;

    if (!country) {
      return errorResponse('Please select your seller country before starting Stripe onboarding.', 400);
    }

    if (!allowlist.includes(country)) {
      return errorResponse('This seller country is not enabled for DK AI Marketplace payouts.', 400);
    }
    if (!FULL_SERVICE_AGREEMENT_COUNTRIES.has(country)) {
      return errorResponse('This seller country is not enabled for the required Stripe service agreement.', 400);
    }

    if (accountId) {
      const account = existingAccount ?? await stripeAccount(admin, accountId, stripeKey, user.id);
      if (!account) accountId = null;
      if (account && account.country && account.country !== country) {
        return errorResponse('Your existing Stripe account country cannot be changed automatically. Open Stripe onboarding for the same country or contact support.', 400);
      }
    }

    if (!accountId) {
      const createRes = await fetch('https://api.stripe.com/v1/accounts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          type: 'express',
          country,
          'capabilities[transfers][requested]': 'true',
          'tos_acceptance[service_agreement]': 'full',
          'metadata[user_id]': user.id,
          'metadata[declared_country]': country,
          ...(user.email ? { email: user.email } : {}),
        }),
      });
      const account = await createRes.json();
      if (!createRes.ok || account.error) {
        return errorResponse(account.error?.message || 'Stripe failed to create Express account for this country.', createRes.status || 500);
      }
      accountId = account.id;
      const persisted = await persistAccountState(admin, user.id, {
        stripe_account_id: accountId,
        stripe_onboarding_status: 'onboarding',
        onboarding_status: 'onboarding',
        stripe_onboarded: false,
        declared_country: country,
        stripe_account_country: country,
        stripe_service_agreement: 'full',
        transfers_capability_active: false,
        payouts_enabled: false,
        charges_enabled: false,
      });
      if (!persisted) return errorResponse('We could not save your Stripe account to your seller profile. Please try again or contact support.', 500);
    }

    const linkRes = await fetch('https://api.stripe.com/v1/account_links', {
      method: 'POST',
      headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        account: accountId,
        refresh_url: `${origin}/seller/payment-settings?refresh=true`,
        return_url: `${origin}/seller/payment-settings?return=1`,
        type: 'account_onboarding',
      }),
    });

    const link = await linkRes.json();
    if (!linkRes.ok || link.error) return errorResponse(link.error?.message || 'Stripe failed to create onboarding link', linkRes.status || 500);
    return jsonResponse({ success: true, url: link.url, accountId, country });
  } catch (err) {
    console.error('stripe-connect-onboarding error:', err);
    return errorResponse('Could not start Stripe onboarding. Please try again.', 500);
  }
});
