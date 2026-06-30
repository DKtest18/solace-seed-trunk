import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

const STRIPE_USER_TABLES = ['dkaim_user_id', 'dkai_user_id'];

function isMissingTable(error: any) {
  const message = String(error?.message || '');
  return error?.code === 'PGRST205' || message.includes('Could not find the table') || message.includes('schema cache') || message.includes('does not exist');
}

async function findStripeUserRow(admin: any, userId: string, select = 'stripe_account_id') {
  let existingTable = STRIPE_USER_TABLES[0];
  for (const table of STRIPE_USER_TABLES) {
    const { data, error } = await admin.from(table).select(select).eq('id', userId).maybeSingle();
    if (!error) {
      existingTable = table;
      if (data) return { table, row: data };
      continue;
    }
    if (!isMissingTable(error)) throw error;
  }
  return { table: existingTable, row: null };
}

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

    // Check if seller already has a Stripe account in the real Stripe user table.
    const { table: stripeUserTable, row: seller } = await findStripeUserRow(admin, user.id);

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

      await admin.from(stripeUserTable).upsert({
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
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
