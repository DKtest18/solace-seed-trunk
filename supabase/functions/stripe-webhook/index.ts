import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { getServiceClient } from '../_shared/auth.ts';

const stripe = new Stripe(Deno.env.get('DKAIM_STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

type Admin = ReturnType<typeof getServiceClient>;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!signature || !webhookSecret) {
    return new Response('Missing Stripe signature or webhook secret', { status: 400 });
  }

  // The raw body is required for signature verification.
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    return new Response(
      `Signature verification failed: ${(err as Error).message}`,
      { status: 400 },
    );
  }

  const admin = getServiceClient();

  // Idempotency: each Stripe event id is processed at most once.
  const { data: existing } = await admin
    .from('webhook_events')
    .select('id, processed')
    .eq('provider', 'stripe')
    .eq('provider_event_id', event.id)
    .maybeSingle();

  if (existing?.processed) {
    return jsonOk({ received: true, duplicate: true });
  }

  if (!existing) {
    await admin.from('webhook_events').insert({
      provider: 'stripe',
      provider_event_id: event.id,
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
      processed: false,
    });
  }

  try {
    await handleEvent(admin, event);
    await admin
      .from('webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('provider', 'stripe')
      .eq('provider_event_id', event.id);
  } catch (err) {
    await admin
      .from('webhook_events')
      .update({ error_message: String((err as Error).message ?? err) })
      .eq('provider', 'stripe')
      .eq('provider_event_id', event.id);
    return new Response(`Handler error: ${(err as Error).message}`, { status: 500 });
  }

  return jsonOk({ received: true });
});

function jsonOk(payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleEvent(admin: Admin, event: Stripe.Event) {
  // create-product-checkout stamps the order id into metadata on both the
  // Checkout Session and its PaymentIntent, so every relevant event carries it.
  const object = event.data.object as Record<string, unknown>;
  const metadata = (object.metadata ?? {}) as Record<string, string>;
  const orderId = metadata.order_id;
  if (!orderId) return;

  if (
    event.type === 'payment_intent.succeeded' ||
    event.type === 'checkout.session.completed'
  ) {
    const paymentIntentId = typeof object.payment_intent === 'string'
      ? object.payment_intent
      : (event.type === 'payment_intent.succeeded' ? String(object.id) : null);

    // Settle the order and move escrow pending -> held.
    await admin
      .from('dkai_orders')
      .update({
        status: 'paid',
        escrow_status: 'held',
        ...(paymentIntentId ? { stripe_payment_intent_id: paymentIntentId } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('escrow_status', 'pending');
  } else if (event.type === 'payment_intent.payment_failed') {
    // Mark the order failed, but never override an already-paid order.
    await admin
      .from('dkai_orders')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .neq('status', 'paid');
  }
}
