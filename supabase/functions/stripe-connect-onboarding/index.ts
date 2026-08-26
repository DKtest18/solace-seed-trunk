import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

const LEGACY_TABLES = ['dkaim_user_id', 'dkai_user_id', 'dkai_seller_profiles', 'dkai_profiles'];

function isSchemaError(error: any) {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === 'PGRST204' ||
    error?.code === 'PGRST205' ||
    error?.code === '42703' ||
    error?.code === '42P01' ||
    message.includes('could not find the table') ||
    message.includes('schema cache') ||
    message.includes('does not exist') ||
    message.includes('column')
  );
}

function normalizeOrigin(req: Request, bodyOrigin?: string) {
  const candidate = bodyOrigin || req.headers.get('origin') || 'https://dkaimarketplace.com';
  try {
    return new URL(candidate).origin;
  } catch {
    return 'https://dkaimarketplace.com';
  }
}

async function readAccountId(admin: any, userId: string): Promise<string | null> {
  const cfg = await admin
    .from('dkai_seller_payment_configs')
    .select('stripe_account_id')
    .eq('seller_id', userId)
    .maybeSingle();
  if (!cfg.error && cfg.data?.stripe_account_id) return cfg.data.stripe_account_id;

  for (const table of LEGACY_TABLES) {
    const { data, error } = await admin.from(table).select('stripe_account_id').eq('id', userId).maybeSingle();
    if (!error && data?.stripe_account_id) return data.stripe_account_id;
    if (error && !isSchemaError(error)) throw error;
  }
  return null;
}

async function persistAccountId(admin: any, userId: string, accountId: string) {
  const now = new Date().toISOString();
  const payloads = [
    {
      seller_id: userId,
      stripe_account_id: accountId,
      stripe_onboarding_status: 'onboarding',
      onboarding_status: 'onboarding',
      stripe_onboarded: false,
      updated_at: now,
    },
    { seller_id: userId, stripe_account_id: accountId, stripe_onboarding_status: 'onboarding', updated_at: now },
    { seller_id: userId, stripe_account_id: accountId, stripe_onboarding_status: 'onboarding' },
    { seller_id: userId, stripe_account_id: accountId },
  ];

  let saved = false;
  for (const payload of payloads) {
    const { error } = await admin
      .from('dkai_seller_payment_configs')
      .upsert(payload, { onConflict: 'seller_id' });
    if (!error) {
      saved = true;
      break;
    }
    if (!isSchemaError(error)) {
      console.error('persistAccountId config error:', error);
      break;
    }
  }

  for (const table of LEGACY_TABLES) {
    const attempts = [
      { stripe_account_id: accountId, stripe_onboarded: false },
      { stripe_account_id: accountId },
    ];
    for (const values of attempts) {
      const { error } = await admin.from(table).update(values).eq('id', userId);
      if (!error) {
        saved = true;
        break;
      }
      if (!isSchemaError(error)) break;
    }
  }

  if (!saved) {
    console.error('Could not persist stripe_account_id anywhere for user', userId);
  }
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

    let accountId = await readAccountId(admin, user.id);

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
        return errorResponse(account.error?.message || 'Stripe failed to create Express account', createRes.status || 500);
      }

      accountId = account.id;
    }

    // Always persist BEFORE redirecting, so a returning seller is recognised.
    await persistAccountId(admin, user.id, accountId!);

    const linkRes = await fetch('https://api.stripe.com/v1/account_links', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        account: accountId!,
        refresh_url: `${origin}/seller/payment-settings?refresh=true`,
        return_url: `${origin}/seller/payment-settings?return=1`,
        type: 'account_onboarding',
      }),
    });

    const link = await linkRes.json();
    if (!linkRes.ok || link.error) {
      return errorResponse(link.error?.message || 'Stripe failed to create onboarding link', linkRes.status || 500);
    }

    return jsonResponse({ success: true, url: link.url, accountId });
  } catch (err) {
    console.error('stripe-connect-onboarding error:', err);
    return errorResponse(err instanceof Error ? err.message : 'Failed to create onboarding link', 500);
  }
});
