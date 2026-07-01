import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

const STRIPE_ACCOUNT_TABLES = ['dkaim_user_id', 'dkai_user_id', 'dkai_profiles'];

function isSchemaError(error: any) {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === 'PGRST204' ||
    error?.code === 'PGRST205' ||
    message.includes('could not find the table') ||
    message.includes('schema cache') ||
    message.includes('does not exist') ||
    message.includes('column')
  );
}

function normalizeOrigin(req: Request, bodyOrigin?: string) {
  const candidate = bodyOrigin || req.headers.get('origin') || 'https://dkaimarketplace.com';
  try {
    const url = new URL(candidate);
    return url.origin;
  } catch {
    return 'https://dkaimarketplace.com';
  }
}

async function findStripeStorage(admin: any, userId: string) {
  let firstExistingTable: string | null = null;
  let firstExistingRow: { table: string; row: any } | null = null;

  for (const table of STRIPE_ACCOUNT_TABLES) {
    const { data, error } = await admin
      .from(table)
      .select('id, stripe_account_id')
      .eq('id', userId)
      .maybeSingle();

    if (!error) {
      firstExistingTable ??= table;
      if (data?.stripe_account_id) return { table, row: data };
      if (data && !firstExistingRow) firstExistingRow = { table, row: data };
      continue;
    }
    if (!isSchemaError(error)) throw error;
  }

  return firstExistingRow ?? { table: firstExistingTable, row: null };
}

async function writeStripeAccount(admin: any, userId: string, accountId: string, onboarded: boolean) {
  const detected = await findStripeStorage(admin, userId);
  const candidates = detected.table
    ? [detected.table, ...STRIPE_ACCOUNT_TABLES.filter((table) => table !== detected.table)]
    : STRIPE_ACCOUNT_TABLES;

  for (const table of candidates) {
    const withOnboarded = await admin.from(table).upsert(
      {
        id: userId,
        stripe_account_id: accountId,
        stripe_onboarded: onboarded,
      },
      { onConflict: 'id' },
    );

    if (!withOnboarded.error) return table;

    if (isSchemaError(withOnboarded.error)) {
      const withoutOnboarded = await admin.from(table).upsert(
        {
          id: userId,
          stripe_account_id: accountId,
        },
        { onConflict: 'id' },
      );
      if (!withoutOnboarded.error) return table;
      if (isSchemaError(withoutOnboarded.error)) continue;
      throw withoutOnboarded.error;
    }

    throw withOnboarded.error;
  }

  throw new Error('No supported Stripe account storage table found. Expected stripe_account_id on dkaim_user_id, dkai_user_id, or dkai_profiles.');
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
    const { row } = await findStripeStorage(admin, user.id);
    let accountId = row?.stripe_account_id;

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
      await writeStripeAccount(admin, user.id, accountId, false);
    }

    const linkRes = await fetch('https://api.stripe.com/v1/account_links', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        account: accountId,
        refresh_url: `${origin}/seller/payment-settings?refresh=true`,
        return_url: `${origin}/seller/payment-settings?return=1`,
        type: 'account_onboarding',
      }),
    });

    const link = await linkRes.json();
    if (!linkRes.ok || link.error) {
      return errorResponse(link.error?.message || 'Stripe failed to create onboarding link', linkRes.status || 500);
    }

    return jsonResponse({ success: true, url: link.url });
  } catch (err) {
    console.error('stripe-connect-onboarding error:', err);
    return errorResponse(err instanceof Error ? err.message : 'Failed to create onboarding link', 500);
  }
});