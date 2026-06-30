import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

const STRIPE_USER_TABLES = ['dkaim_user_id', 'dkai_user_id'];

function isMissingTable(error: any) {
  const message = String(error?.message || '');
  return error?.code === 'PGRST205' || message.includes('Could not find the table') || message.includes('schema cache') || message.includes('does not exist');
}

async function findStripeUserRow(admin: any, userId: string) {
  for (const table of STRIPE_USER_TABLES) {
    const { data, error } = await admin.from(table).select('stripe_account_id').eq('id', userId).maybeSingle();
    if (!error && data?.stripe_account_id) return data;
    if (error && !isMissingTable(error)) throw error;
  }
  return null;
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
    const seller = await findStripeUserRow(admin, user.id);

    if (!seller?.stripe_account_id) return errorResponse('No Stripe account found');

    const res = await fetch('https://api.stripe.com/v1/accounts/' + seller.stripe_account_id + '/login_links', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${stripeKey}` },
    });
    const link = await res.json();
    if (link.error) throw new Error(link.error.message);

    return jsonResponse({ success: true, url: link.url });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});