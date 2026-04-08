import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { meeting_request_id, meeting_id, amount, seller_id } = await req.json();
    const stripeKey = Deno.env.get('DKAIM_STRIPE_SECRET_KEY');
    if (!stripeKey) return errorResponse('Stripe not configured: DKAIM_STRIPE_SECRET_KEY missing', 500);

    const admin = getServiceClient();

    // Get seller's Stripe account for direct payment
    const { data: seller } = await admin
      .from('dkaim_user_id')
      .select('stripe_account_id')
      .eq('id', seller_id)
      .single();

    const params: Record<string, string> = {
      'mode': 'payment',
      'success_url': `${req.headers.get('origin')}/my-meetings?payment=success`,
      'cancel_url': `${req.headers.get('origin')}/my-meetings?payment=canceled`,
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': `Meeting Payment`,
      'line_items[0][price_data][unit_amount]': String(Math.round(amount * 100)),
      'line_items[0][quantity]': '1',
      'metadata[meeting_request_id]': meeting_request_id,
      'metadata[meeting_id]': meeting_id,
      'metadata[buyer_id]': user.id,
    };

    // Add application fee if seller has Stripe account
    if (seller?.stripe_account_id) {
      params['payment_intent_data[application_fee_amount]'] = String(Math.round(amount * 10)); // 10% fee
      params['payment_intent_data[transfer_data][destination]'] = seller.stripe_account_id;
    }

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
    });

    const session = await stripeRes.json();
    if (session.error) throw new Error(session.error.message);

    return jsonResponse({ url: session.url });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});