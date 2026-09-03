import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

// SINGLE SOURCE OF TRUTH: public.dkai_seller_payment_configs (unique: seller_id).
// No legacy identity tables are probed any more — probing non-existent tables
// like `dkai_user_id` was what broke the FIRST-TIME connect path.
const CONFIG_TABLE = 'dkai_seller_payment_configs';

function isSchemaError(error: any) {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === 'PGRST204' ||
    error?.code === '42703' ||
    message.includes('schema cache') ||
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

/** Returns the stored account id, or null when the seller has no row yet. */
async function readAccountId(admin: any, userId: string): Promise<string | null> {
  const { data, error } = await admin
    .from(CONFIG_TABLE)
    .select('stripe_account_id')
    .eq('seller_id', userId)
    .maybeSingle();
  if (error) {
    console.error('readAccountId error:', error);
    return null; // never block account creation on a read problem
  }
  return data?.stripe_account_id ?? null;
}

/**
 * Upsert on seller_id: identical code path whether the row exists (reconnect)
 * or not (first-time seller). Column sets are tried widest-first so an older
 * schema still persists at least the account id.
 */
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
    {
      seller_id: userId,
      stripe_account_id: accountId,
      stripe_onboarding_status: 'onboarding',
      updated_at: now,
    },
    { seller_id: userId, stripe_account_id: accountId, stripe_onboarding_status: 'onboarding' },
    { seller_id: userId, stripe_account_id: accountId },
  ];

  for (const payload of payloads) {
    const { error } = await admin.from(CONFIG_TABLE).upsert(payload, { onConflict: 'seller_id' });
    if (!error) return true;
    if (!isSchemaError(error)) {
      console.error('persistAccountId error:', error);
      return false;
    }
  }
  console.error('Could not persist stripe_account_id for user', userId);
  return false;
}

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  // Seller identity ALWAYS comes from the verified JWT, never from the body.
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
        return errorResponse(
          account.error?.message || 'Stripe failed to create Express account',
          createRes.status || 500,
        );
      }

      accountId = account.id;
    }

    // Persist BEFORE redirecting so the return trip recognises the seller.
    const persisted = await persistAccountId(admin, user.id, accountId!);
    if (!persisted) {
      // Technical detail stays in the logs; the seller gets a clear message.
      return errorResponse(
        'We could not save your Stripe account to your seller profile. Please try again or contact support.',
        500,
      );
    }

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
    return errorResponse('Could not start Stripe onboarding. Please try again.', 500);
  }
});
