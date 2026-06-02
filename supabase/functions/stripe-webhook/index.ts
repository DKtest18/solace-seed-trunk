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
  const webhookSecret = Deno.env.get('DKAIM_STRIPE_WEBHOOK_SECRET');
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

    // Load tier (set at checkout) to decide payout_status + auto_release_at.
    const { data: ord } = await admin
      .from('dkai_orders')
      .select('id, delivery_tier, payout_status, auto_release_at, seller_id, price')
      .eq('id', orderId)
      .single();
    if (!ord) return;
    const tier = (ord.delivery_tier as string) || 'tier1';

    // Compute auto-release if missing (defensive)
    let autoReleaseAt = ord.auto_release_at as string | null;
    if (!autoReleaseAt && tier !== 'tier1') {
      const days = tier === 'tier3' ? 14 : 7;
      autoReleaseAt = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
    }

    const payoutStatus = tier === 'tier1' ? 'pending' : 'held';

    await admin
      .from('dkai_orders')
      .update({
        status: 'paid',
        escrow_status: tier === 'tier1' ? 'released' : 'held',
        payout_status: payoutStatus,
        auto_release_at: autoReleaseAt,
        ...(paymentIntentId ? { stripe_payment_intent_id: paymentIntentId } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('status', 'pending_payment');

    // Tier-aware notifications (fire-and-forget)
    notify(admin, orderId, tier).catch(() => {});
  } else if (event.type === 'payment_intent.payment_failed') {
    await admin
      .from('dkai_orders')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .neq('status', 'paid');
  }
}

async function notify(admin: Admin, orderId: string, tier: string) {
  const { data: o } = await admin
    .from('dkai_orders')
    .select('id, buyer_id, seller_id, price, dkai_products(title)')
    .eq('id', orderId)
    .single();
  if (!o) return;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return;
  const send = (body: any) => fetch(`${url}/functions/v1/send-notification-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify(body),
  }).catch(() => {});

  const { data: buyer } = await admin.from('dkai_profiles').select('email').eq('id', o.buyer_id).single();
  const { data: seller } = await admin.from('dkai_profiles').select('email').eq('id', o.seller_id).single();
  const productTitle = (o as any).dkai_products?.title ?? 'your product';

  if (buyer?.email) send({ type: 'order_paid_buyer', recipientEmail: buyer.email,
    data: { orderId, tier, productTitle, price: o.price } });
  if (seller?.email) {
    send({ type: 'order_paid_seller', recipientEmail: seller.email,
      data: { orderId, tier, productTitle, price: o.price } });
    if (tier === 'tier3') {
      send({ type: 'tier3_deliver_now_seller', recipientEmail: seller.email,
        data: { orderId, productTitle, price: o.price } });
    }
  }
}
