import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { meeting_request_id, meeting_id } = await req.json();
    if (!meeting_request_id) return errorResponse('meeting_request_id is required', 400);

    const stripeKey = Deno.env.get('DKAIM_STRIPE_SECRET_KEY');
    if (!stripeKey) return errorResponse('Stripe not configured: DKAIM_STRIPE_SECRET_KEY missing', 500);

    const admin = getServiceClient();

    // Resolve the meeting request server-side. The amount and seller are
    // derived from the request and its meeting type — never from the request
    // body — so a buyer cannot tamper with the price or redirect the payout.
    const { data: request, error: reqErr } = await admin
      .from('dkai_meeting_requests')
      .select('id, meeting_type_id, seller_id, buyer_id, status')
      .eq('id', meeting_request_id)
      .single();
    if (reqErr || !request) return errorResponse('Meeting request not found', 404);

    // Only the buyer who owns the request may pay for it.
    if (request.buyer_id !== user.id) return errorResponse('Forbidden', 403);

    const { data: meetingType, error: typeErr } = await admin
      .from('dkai_meeting_types')
      .select('price, is_paid, currency, name')
      .eq('id', request.meeting_type_id)
      .single();
    if (typeErr || !meetingType) return errorResponse('Meeting type not found', 404);

    if (!meetingType.is_paid || !meetingType.price || Number(meetingType.price) <= 0) {
      return errorResponse('This meeting type does not require payment', 400);
    }

    const sellerId = request.seller_id;
    const amount = Number(meetingType.price);
    const currency = (meetingType.currency || 'usd').toLowerCase();

    // Get seller's Stripe account for direct payment
    const { data: seller } = await admin
      .from('dkaim_user_id')
      .select('stripe_account_id')
      .eq('id', sellerId)
      .single();

    const params: Record<string, string> = {
      'mode': 'payment',
      'success_url': `${req.headers.get('origin')}/my-meetings?payment=success`,
      'cancel_url': `${req.headers.get('origin')}/my-meetings?payment=canceled`,
      'line_items[0][price_data][currency]': currency,
      'line_items[0][price_data][product_data][name]': meetingType.name || 'Meeting Payment',
      'line_items[0][price_data][unit_amount]': String(Math.round(amount * 100)),
      'line_items[0][quantity]': '1',
      'metadata[meeting_request_id]': meeting_request_id,
      'metadata[buyer_id]': user.id,
      'metadata[seller_id]': sellerId,
    };
    if (meeting_id) params['metadata[meeting_id]'] = String(meeting_id);

    // Add application fee if seller has Stripe account
    if (seller?.stripe_account_id) {
      params['payment_intent_data[application_fee_amount]'] = String(Math.round(amount * 100 * 0.1)); // 10% fee
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
