import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';
import { stripeCall, stripeErrorMessage, toMinorUnits } from '../_shared/stripe.ts';

type Admin = ReturnType<typeof getServiceClient>;

async function isAdmin(admin: Admin, userId: string): Promise<boolean> {
  const { data } = await admin.rpc('dkai_has_role', { _user_id: userId, _role: 'admin' });
  if (data === true) return true;
  const { data: roleData } = await admin
    .from('dkai_user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  return !!roleData;
}

function metadataValue(value: unknown): string {
  return String(value ?? '').slice(0, 500);
}

async function notifyBuyer(admin: Admin, dispute: any, order: any, accepted: boolean, reason?: string) {
  const buyerId = dispute?.buyer_id ?? order?.buyer_id;
  if (!buyerId && !order?.guest_email) return;
  const { data: buyerProfile } = buyerId
    ? await admin.from('dkai_profiles').select('email').eq('id', buyerId).maybeSingle()
    : { data: { email: order.guest_email } };
  const { data: product } = await admin.from('dkai_products').select('title').eq('id', dispute.product_id ?? order.product_id).maybeSingle();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!buyerProfile?.email || !supabaseUrl || !serviceKey) return;
  await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({
      type: accepted ? 'refund_accepted' : 'refund_declined',
      recipientEmail: buyerProfile.email,
      data: {
        productTitle: product?.title,
        price: order.price,
        paymentMethod: order.payment_method === 'stripe' ? 'Stripe (Card)' : order.payment_method || 'Original payment method',
        orderId: order.id,
        reason: reason || 'No reason provided',
      },
    }),
  }).catch((e) => console.error('refund email failed:', e));
}

async function createStripeRefund(admin: Admin, dispute: any, order: any, notes?: string) {
  const chargeId = order.stripe_charge_id;
  if (!chargeId) throw new Error('This order has no Stripe charge to refund yet.');

  const currency = String(order.currency ?? 'chf').toLowerCase();
  const grossMinor = Number(order.gross_amount_minor ?? toMinorUnits(Number(order.price ?? 0), currency));
  const alreadyRefunded = Number(order.refunded_amount_minor ?? 0);
  const requestedMinor = dispute.refund_amount != null
    ? toMinorUnits(Number(dispute.refund_amount), currency)
    : grossMinor;
  const amountMinor = Math.max(0, Math.min(requestedMinor, grossMinor - alreadyRefunded));
  if (amountMinor <= 0) throw new Error('This order has already been fully refunded.');

  const chargeMode = String(order.charge_mode ?? 'destination');
  const params: Record<string, string> = {
    charge: chargeId,
    amount: String(amountMinor),
    reason: 'requested_by_customer',
    'metadata[order_id]': order.id,
    'metadata[dispute_id]': dispute.id,
    'metadata[origin]': 'app',
    'metadata[notes]': metadataValue(notes),
  };

  // Legacy `destination` means the original repo created platform charges with
  // transfer_data.destination and application_fee_amount, not a connected-account
  // Stripe-Account request. For a separately verified true direct charge, pass
  // the connected account context.
  if (chargeMode === 'destination') {
    params.reverse_transfer = 'true';
    params.refund_application_fee = 'true';
  }

  const stripeAccount = chargeMode === 'direct'
    ? (order.transfer_destination_account || order.stripe_account_id || null)
    : null;

  const refund = await stripeCall('refunds', params, {
    stripeAccount: stripeAccount ?? undefined,
    idempotencyKey: `dkaim_refund_${order.id}_${dispute.id}_${amountMinor}`,
  });
  if (!refund.ok) throw new Error(stripeErrorMessage(refund.data));

  await admin.from('dkai_refund_ledger').upsert({
    order_id: order.id,
    stripe_refund_id: refund.data.id,
    stripe_charge_id: chargeId,
    amount_minor: amountMinor,
    currency,
    status: refund.data.status === 'succeeded' ? 'succeeded' : 'pending',
    origin: 'app',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'stripe_refund_id' });

  await admin.from('dkai_orders').update({
    status: refund.data.status === 'succeeded' && amountMinor >= grossMinor - alreadyRefunded ? 'refunded' : order.status,
    stripe_refund_id: refund.data.id,
    refund_amount: amountMinor / 100,
    refunded_amount_minor: alreadyRefunded + (refund.data.status === 'succeeded' ? amountMinor : 0),
    transfer_state: chargeMode === 'separate' && order.transfer_state !== 'completed' ? 'blocked' : order.transfer_state,
    transfer_last_error: refund.data.status === 'succeeded' ? null : 'Stripe refund pending',
    updated_at: new Date().toISOString(),
  }).eq('id', order.id);

  if (refund.data.status === 'succeeded') {
    await admin.rpc('dkai_recalculate_order_financials', {
      _order_id: order.id,
      _processing_fee_minor: null,
      _refunded_amount_minor: alreadyRefunded + amountMinor,
    });
  }

  return refund.data;
}

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const body = await req.json().catch(() => ({}));
    const disputeId = body.disputeId ?? body.dispute_id;
    const resolution = body.resolution;
    const notes = body.resolutionNotes ?? body.notes ?? '';
    const refundBuyer = body.refundBuyer === true || body.refund_buyer === true;
    if (!disputeId || !resolution) return errorResponse('disputeId and resolution are required', 400);

    const admin = getServiceClient();
    if (!(await isAdmin(admin, user.id))) return errorResponse('Admin access required', 403);

    const { data: dispute, error: disputeErr } = await admin
      .from('dkai_disputes')
      .select('*')
      .eq('id', disputeId)
      .maybeSingle();
    if (disputeErr || !dispute) return errorResponse('Dispute not found', 404);

    const { data: order, error: orderErr } = await admin
      .from('dkai_orders')
      .select('*')
      .eq('id', dispute.order_id)
      .maybeSingle();
    if (orderErr || !order) return errorResponse('Order not found', 404);

    let refund: any = null;
    if (refundBuyer) {
      if (order.payment_method !== 'stripe') {
        return errorResponse('Only Stripe refunds can be processed automatically here.', 400);
      }
      refund = await createStripeRefund(admin, dispute, order, notes);
    }

    await admin.from('dkai_disputes').update({
      status: 'resolved',
      resolution,
      resolution_notes: notes,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    }).eq('id', disputeId);

    await notifyBuyer(admin, dispute, order, refundBuyer, notes);
    return jsonResponse({ success: true, resolution, stripe_refund_id: refund?.id ?? null, refund_status: refund?.status ?? null });
  } catch (err) {
    console.error('resolve-dispute error:', err);
    return errorResponse((err as Error).message || 'Failed to resolve dispute', 500);
  }
});
