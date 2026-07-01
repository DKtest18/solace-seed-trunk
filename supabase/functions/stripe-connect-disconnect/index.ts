import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

const STRIPE_ACCOUNT_TABLES = ['dkaim_user_id', 'dkai_user_id', 'dkai_profiles'];

function isSchemaError(error: any) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 'PGRST204' || error?.code === 'PGRST205' || message.includes('could not find the table') || message.includes('schema cache') || message.includes('does not exist') || message.includes('column');
}

async function findStripeUserRow(admin: any, userId: string) {
  for (const table of STRIPE_ACCOUNT_TABLES) {
    const { data, error } = await admin.from(table).select('stripe_account_id').eq('id', userId).maybeSingle();
    if (!error && data?.stripe_account_id) return { table, row: data };
    if (!error) continue;
    if (error && !isSchemaError(error)) throw error;
  }
  return { table: STRIPE_ACCOUNT_TABLES[0], row: null };
}

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const stripeKey = Deno.env.get('DKAIM_STRIPE_SECRET_KEY');
    if (!stripeKey) return errorResponse('Stripe not configured: DKAIM_STRIPE_SECRET_KEY missing', 500);

    const admin = getServiceClient();
    const { table: stripeUserTable, row: seller } = await findStripeUserRow(admin, user.id);

    if (!seller?.stripe_account_id) return errorResponse('No Stripe account found');

    // Delete the Stripe account
    const res = await fetch(`https://api.stripe.com/v1/accounts/${seller.stripe_account_id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${stripeKey}` },
    });
    await res.text();

    // Clear the detected Stripe user table
    const clearWithOnboarded = await admin.from(stripeUserTable).update({
      stripe_account_id: null,
      stripe_onboarded: false,
    }).eq('id', user.id);
    if (clearWithOnboarded.error && isSchemaError(clearWithOnboarded.error)) {
      const clearAccountOnly = await admin.from(stripeUserTable).update({
        stripe_account_id: null,
      }).eq('id', user.id);
      if (clearAccountOnly.error) throw clearAccountOnly.error;
    } else if (clearWithOnboarded.error) {
      throw clearWithOnboarded.error;
    }

    // Clear dkai_seller_payment_configs
    await admin.from('dkai_seller_payment_configs').update({
      stripe_account_id: null,
      stripe_onboarding_status: null,
      charges_enabled: false,
      updated_at: new Date().toISOString(),
    }).eq('seller_id', user.id);

    return jsonResponse({ success: true });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
