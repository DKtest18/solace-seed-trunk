import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { getServiceClient } from '../_shared/auth.ts';
import { stripeCall, stripeErrorMessage } from '../_shared/stripe.ts';

const stripe = new Stripe(Deno.env.get('DKAIM_STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

type Admin = ReturnType<typeof getServiceClient>;

type EventStart = 'process' | 'duplicate' | 'busy';

const PAID_STATUSES = new Set(['paid', 'completed', 'delivered', 'released', 'payment_confirmed']);
const OPEN_DISPUTE_STATUSES = new Set(['needs_response', 'under_review', 'warning_needs_response', 'warning_under_review']);

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}

async function startEvent(admin: Admin, event: Stripe.Event): Promise<EventStart> {
  const { data: existing } = await admin
    .from('webhook_events')
    .select('id, processed')
    .eq('provider', 'stripe')
    .eq('provider_event_id', event.id)
    .maybeSingle();

  if (existing?.processed) return 'duplicate';
  if (existing) return 'process';

  const { error } = await admin.from('webhook_events').insert({
    provider: 'stripe',
    provider_event_id: event.id,
    event_type: event.type,
    payload: event as unknown as Record<string, unknown>,
    processed: false,
  });

  if (!error) return 'process';
  if ((error as any)?.code === '23505') return 'busy';
  throw error;
}

async function finishEvent(admin: Admin, event: Stripe.Event, error?: unknown) {
  await admin
    .from('webhook_events')
    .update(error
      ? { error_message: String((error as Error)?.message ?? error).slice(0, 1000) }
      : { processed: true, processed_at: new Date().toISOString(), error_message: null })
    .eq('provider', 'stripe')
    .eq('provider_event_id', event.id);
}

function metadataOf(obj: any): Record<string, string> {
  return (obj?.metadata ?? {}) as Record<string, string>;
}

async function findOrder(admin: Admin, object: any): Promise<any | null> {
  const meta = metadataOf(object);
  const metadataOrderId = meta.order_id;
  if (metadataOrderId) {
    const { data } = await admin.from('dkai_orders').select('*').eq('id', metadataOrderId).maybeSingle();
    if (data) return data;
  }

  const paymentIntentId = typeof object?.payment_intent === 'string'
    ? object.payment_intent
    : object?.object === 'payment_intent'
      ? object.id
      : null;
  if (paymentIntentId) {
    const { data } = await admin.from('dkai_orders').select('*').eq('stripe_payment_intent_id', paymentIntentId).maybeSingle();
    if (data) return data;
  }

  const chargeId = typeof object?.charge === 'string'
    ? object.charge
    : object?.object === 'charge'
      ? object.id
      : null;
  if (chargeId) {
    const { data } = await admin.from('dkai_orders').select('*').eq('stripe_charge_id', chargeId).maybeSingle();
    if (data) return data;
  }
  return null;
}

async function retrievePaymentIntent(paymentIntentId: string): Promise<any | null> {
  const res = await stripeCall(`payment_intents/${paymentIntentId}`, { expand: 'latest_charge.balance_transaction' }, { method: 'GET' });
  return res.ok ? res.data : null;
}

function chargeFromPaymentIntent(pi: any): any | null {
  const latest = pi?.latest_charge;
  return typeof latest === 'object' && latest ? latest : null;
}

function feeFromCharge(charge: any): number | null {
  const bt = charge?.balance_transaction;
  if (typeof bt === 'object' && bt && Number.isFinite(Number(bt.fee))) return Number(bt.fee);
  return null;
}

async function recalcOrder(admin: Admin, orderId: string, processingFeeMinor?: number | null, refundedMinor?: number | null) {
  await admin.rpc('dkai_recalculate_order_financials', {
    _order_id: orderId,
    _processing_fee_minor: processingFeeMinor ?? null,
    _refunded_amount_minor: refundedMinor ?? null,
  });
}

async function markPaid(admin: Admin, event: Stripe.Event, object: any) {
  let paymentIntentId: string | null = null;
  let sessionId: string | null = null;
  let paymentIntent: any | null = null;

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    sessionId = String(object.id);
    paymentIntentId = typeof object.payment_intent === 'string' ? object.payment_intent : null;
  } else if (object.object === 'payment_intent') {
    paymentIntentId = String(object.id);
  }

  if (paymentIntentId) paymentIntent = await retrievePaymentIntent(paymentIntentId);
  const source = paymentIntent ?? object;
  const charge = chargeFromPaymentIntent(paymentIntent) ?? object?.charges?.data?.[0] ?? null;
  const order = await findOrder(admin, source) ?? await findOrder(admin, object);
  if (!order) return;

  const chargeId = charge?.id ?? (typeof source.latest_charge === 'string' ? source.latest_charge : null);
  const balanceTransactionId = typeof charge?.balance_transaction === 'string'
    ? charge.balance_transaction
    : charge?.balance_transaction?.id ?? null;
  const processingFeeMinor = feeFromCharge(charge);
  const paidAt = new Date((Number(source.created ?? object.created ?? Date.now() / 1000)) * 1000).toISOString();
  const grossMinor = Number(source.amount_received ?? object.amount_total ?? charge?.amount ?? order.gross_amount_minor ?? 0);
  const currency = String(source.currency ?? object.currency ?? charge?.currency ?? order.currency ?? 'chf').toLowerCase();

  const patch: Record<string, unknown> = {
    status: 'paid',
    payout_status: 'held',
    paid_at: order.paid_at ?? paidAt,
    sale_completed_at: order.sale_completed_at ?? paidAt,
    eu_withdrawal_waiver_at: order.eu_withdrawal_waiver_at ?? paidAt,
    currency,
    gross_amount_minor: grossMinor > 0 ? grossMinor : order.gross_amount_minor,
    livemode: !!event.livemode,
    updated_at: new Date().toISOString(),
  };
  if (sessionId) patch.stripe_session_id = sessionId;
  if (paymentIntentId) patch.stripe_payment_intent_id = paymentIntentId;
  if (chargeId) patch.stripe_charge_id = chargeId;
  if (balanceTransactionId) patch.stripe_balance_transaction_id = balanceTransactionId;
  if (processingFeeMinor !== null) patch.processing_fee_minor = processingFeeMinor;

  await admin.from('dkai_orders').update(patch).eq('id', order.id).in('status', ['pending_payment', 'paid']);
  if (order.charge_mode === 'separate') {
    await recalcOrder(admin, order.id, processingFeeMinor, null);
    await admin.rpc('dkai_start_transfer_hold_at', { _order_id: order.id, _paid_at: paidAt });
  }

  notify(admin, order.id, order.delivery_tier || 'tier1').catch(() => {});
}

async function markFailed(admin: Admin, object: any) {
  const order = await findOrder(admin, object);
  if (!order) return;
  if (!PAID_STATUSES.has(String(order.status))) {
    await admin.from('dkai_orders').update({ status: 'failed', transfer_state: 'not_applicable', updated_at: new Date().toISOString() }).eq('id', order.id);
  }
}

async function currentSuccessfulRefundTotal(admin: Admin, orderId: string, fallback: number): Promise<number> {
  const { data } = await admin
    .from('dkai_refund_ledger')
    .select('amount_minor')
    .eq('order_id', orderId)
    .eq('status', 'succeeded');
  const sum = (data ?? []).reduce((n: number, r: any) => n + Number(r.amount_minor || 0), 0);
  return Math.max(sum, fallback);
}

async function reverseTransferredExcess(admin: Admin, order: any, reason: string): Promise<{ reversed: number; debt: number; reversalId: string | null; status: string }> {
  const transferred = Number(order.transfer_amount ? Math.round(Number(order.transfer_amount) * 100) : 0);
  const alreadyReversed = Number(order.reversed_amount_minor ?? 0);
  const targetEntitlement = Math.max(0, Number(order.seller_entitlement_minor ?? 0));
  const excess = Math.max(0, transferred - alreadyReversed - targetEntitlement);
  if (excess <= 0 || !order.stripe_transfer_id) return { reversed: 0, debt: 0, reversalId: null, status: 'not_required' };

  const res = await stripeCall(`transfers/${order.stripe_transfer_id}/reversals`, {
    amount: String(excess),
    'metadata[order_id]': order.id,
    'metadata[reason]': reason,
  }, { idempotencyKey: `dkaim_reverse_${order.id}_${reason}_${excess}` });

  if (res.ok) return { reversed: excess, debt: 0, reversalId: res.data.id, status: 'succeeded' };
  return { reversed: 0, debt: excess, reversalId: null, status: 'failed' };
}

async function handleRefund(admin: Admin, object: any) {
  const refund = object;
  const order = await findOrder(admin, refund);
  if (!order) return;

  const amountMinor = Number(refund.amount ?? 0);
  const status = String(refund.status ?? (amountMinor > 0 ? 'succeeded' : 'pending'));
  await admin.from('dkai_refund_ledger').upsert({
    order_id: order.id,
    stripe_refund_id: refund.id,
    stripe_charge_id: typeof refund.charge === 'string' ? refund.charge : order.stripe_charge_id,
    amount_minor: amountMinor,
    currency: String(refund.currency ?? order.currency ?? 'chf').toLowerCase(),
    status: status === 'succeeded' ? 'succeeded' : status === 'failed' || status === 'canceled' ? status : 'pending',
    origin: metadataOf(refund).origin === 'app' ? 'app' : 'stripe',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'stripe_refund_id' });

  if (status !== 'succeeded') {
    await admin.from('dkai_orders').update({ transfer_state: order.transfer_state === 'completed' ? 'completed' : 'blocked', transfer_last_error: 'Refund pending', updated_at: new Date().toISOString() }).eq('id', order.id);
    return;
  }

  const totalRefunded = await currentSuccessfulRefundTotal(admin, order.id, Number(refund.amount ?? 0));
  await recalcOrder(admin, order.id, null, totalRefunded);

  const { data: fresh } = await admin.from('dkai_orders').select('*').eq('id', order.id).maybeSingle();
  const currentOrder = fresh ?? order;
  const reversal = await reverseTransferredExcess(admin, currentOrder, `refund_${refund.id}`);

  const patch: Record<string, unknown> = {
    refunded_amount_minor: totalRefunded,
    refund_amount: totalRefunded / 100,
    stripe_refund_id: refund.id,
    refunded_at: new Date().toISOString(),
    reversed_amount_minor: Number(currentOrder.reversed_amount_minor ?? 0) + reversal.reversed,
    seller_debt_minor: Number(currentOrder.seller_debt_minor ?? 0) + reversal.debt,
    seller_debt_amount: (Number(currentOrder.seller_debt_minor ?? 0) + reversal.debt) / 100,
    transfer_last_error: reversal.status === 'failed' ? 'Transfer reversal failed; seller recovery is outstanding' : null,
    updated_at: new Date().toISOString(),
  };
  if (totalRefunded >= Number(currentOrder.gross_amount_minor ?? 0)) patch.status = 'refunded';
  if (currentOrder.transfer_state !== 'completed') patch.transfer_state = totalRefunded >= Number(currentOrder.gross_amount_minor ?? 0) ? 'blocked' : 'pending';
  if (reversal.reversalId) patch.stripe_transfer_reversal_id = reversal.reversalId;

  await admin.from('dkai_orders').update(patch).eq('id', order.id);
  await admin.from('dkai_refund_ledger').update({
    seller_recovery_minor: reversal.reversed,
    reversal_id: reversal.reversalId,
    reversal_status: reversal.status,
    reversal_error: reversal.status === 'failed' ? 'Stripe transfer reversal failed' : null,
    updated_at: new Date().toISOString(),
  }).eq('stripe_refund_id', refund.id);
}

async function handleChargeRefunded(admin: Admin, object: any) {
  const charge = object;
  const order = await findOrder(admin, charge);
  if (!order) return;
  const totalRefunded = Number(charge.amount_refunded ?? 0);
  await recalcOrder(admin, order.id, feeFromCharge(charge), totalRefunded);
  await admin.from('dkai_orders').update({
    refunded_amount_minor: totalRefunded,
    refund_amount: totalRefunded / 100,
    refunded_at: new Date().toISOString(),
    stripe_charge_id: charge.id,
    transfer_state: order.transfer_state === 'completed' ? order.transfer_state : 'blocked',
    updated_at: new Date().toISOString(),
  }).eq('id', order.id);
}

async function handleDispute(admin: Admin, object: any) {
  const dispute = object;
  const order = await findOrder(admin, dispute);
  if (!order) return;
  const status = String(dispute.status ?? 'unknown');
  const isOpen = OPEN_DISPUTE_STATUSES.has(status);
  const outcome = isOpen ? 'open' : status === 'won' ? 'won' : status === 'lost' ? 'lost' : status === 'warning_closed' ? 'withdrawn' : 'open';

  await admin.from('dkai_stripe_dispute_ledger').upsert({
    order_id: order.id,
    stripe_dispute_id: dispute.id,
    stripe_charge_id: typeof dispute.charge === 'string' ? dispute.charge : order.stripe_charge_id,
    amount_minor: Number(dispute.amount ?? 0),
    currency: String(dispute.currency ?? order.currency ?? 'chf').toLowerCase(),
    status,
    outcome,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'stripe_dispute_id' });

  if (isOpen) {
    await admin.from('dkai_orders').update({
      dispute_state: 'open',
      dispute_opened_at: order.dispute_opened_at ?? new Date().toISOString(),
      transfer_state: order.transfer_state === 'completed' ? 'completed' : 'blocked',
      transfer_last_error: 'Stripe dispute open',
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);
    return;
  }

  if (status === 'lost') {
    await recalcOrder(admin, order.id, null, Number(order.refunded_amount_minor ?? 0) + Number(dispute.amount ?? 0));
    const { data: fresh } = await admin.from('dkai_orders').select('*').eq('id', order.id).maybeSingle();
    const currentOrder = fresh ?? order;
    const reversal = await reverseTransferredExcess(admin, currentOrder, `dispute_${dispute.id}`);
    await admin.from('dkai_orders').update({
      dispute_state: 'lost',
      status: 'disputed',
      reversed_amount_minor: Number(currentOrder.reversed_amount_minor ?? 0) + reversal.reversed,
      seller_debt_minor: Number(currentOrder.seller_debt_minor ?? 0) + reversal.debt,
      seller_debt_amount: (Number(currentOrder.seller_debt_minor ?? 0) + reversal.debt) / 100,
      stripe_transfer_reversal_id: reversal.reversalId ?? currentOrder.stripe_transfer_reversal_id,
      transfer_last_error: reversal.status === 'failed' ? 'Dispute recovery failed; seller recovery is outstanding' : null,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);
    await admin.from('dkai_stripe_dispute_ledger').update({
      seller_recovery_minor: reversal.reversed,
      reversal_id: reversal.reversalId,
      reversal_status: reversal.status,
      updated_at: new Date().toISOString(),
    }).eq('stripe_dispute_id', dispute.id);
    return;
  }

  if (status === 'won' || status === 'warning_closed') {
    await admin.from('dkai_orders').update({
      dispute_state: status === 'won' ? 'won' : 'closed',
      transfer_state: order.transfer_state === 'blocked' ? 'pending' : order.transfer_state,
      transfer_last_error: null,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);
  }
}

async function handleEvent(admin: Admin, event: Stripe.Event) {
  const object = event.data.object as Record<string, unknown>;
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
    case 'payment_intent.succeeded':
      await markPaid(admin, event, object);
      break;
    case 'checkout.session.async_payment_failed':
    case 'payment_intent.payment_failed':
      await markFailed(admin, object);
      break;
    case 'refund.created':
    case 'refund.updated':
      await handleRefund(admin, object);
      break;
    case 'charge.refunded':
      await handleChargeRefunded(admin, object);
      break;
    case 'charge.dispute.created':
    case 'charge.dispute.updated':
    case 'charge.dispute.closed':
      await handleDispute(admin, object);
      break;
    default:
      break;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('DKAIM_STRIPE_WEBHOOK_SECRET');
  if (!signature || !webhookSecret) return new Response('Missing Stripe signature or webhook secret', { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, cryptoProvider);
  } catch (err) {
    return new Response(`Signature verification failed: ${(err as Error).message}`, { status: 400 });
  }

  const admin = getServiceClient();
  const action = await startEvent(admin, event);
  if (action === 'duplicate') return json({ received: true, duplicate: true });
  if (action === 'busy') return json({ received: true, duplicate: true, busy: true });

  try {
    await handleEvent(admin, event);
    await finishEvent(admin, event);
  } catch (err) {
    await finishEvent(admin, event, err);
    console.error('stripe-webhook handler error:', err);
    return new Response(`Handler error: ${(err as Error).message}`, { status: 500 });
  }

  return json({ received: true });
});

async function notify(admin: Admin, orderId: string, tier: string) {
  const { data: o } = await admin
    .from('dkai_orders')
    .select('id, buyer_id, seller_id, guest_email, price, dkai_products(title)')
    .eq('id', orderId)
    .single();
  if (!o) return;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return;
  const send = (body: any) => fetch(`${url}/functions/v1/send-notification-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  }).catch(() => {});

  const { data: buyer } = o.buyer_id
    ? await admin.from('dkai_profiles').select('email').eq('id', o.buyer_id).single()
    : { data: { email: o.guest_email } };
  const { data: seller } = await admin.from('dkai_profiles').select('email').eq('id', o.seller_id).single();
  const productTitle = (o as any).dkai_products?.title ?? 'your product';

  if (buyer?.email) send({ type: 'order_paid_buyer', recipientEmail: buyer.email, data: { orderId, tier, productTitle, price: o.price } });
  if (seller?.email) send({ type: 'order_paid_seller', recipientEmail: seller.email, data: { orderId, tier, productTitle, price: o.price } });
}
