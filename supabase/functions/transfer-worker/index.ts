// transfer-worker
// Protected, scheduled worker (pg_cron + pg_net, every 15 minutes) that pays
// sellers for SEPARATE-CHARGE orders once the hold has elapsed.
//
// Guarantees:
//  * bounded batch, DB-side claim with row locking + recoverable lease
//    (public.dkai_claim_transfer_batch)
//  * the transfer operation row (with its frozen request params and persistent
//    idempotency key) is written BEFORE Stripe is called
//  * an ambiguous outcome is reconciled against Stripe (transfer_group +
//    metadata.order_id) instead of blindly creating a second transfer
//  * refunds, disputes, missing capabilities and restricted accounts block the
//    release; legacy destination charges are never transferred.
//
// A DB hold is bookkeeping only: it does NOT segregate funds in Stripe and is
// never described as escrow.

import { getServiceClient } from '../_shared/auth.ts';
import { stripeCall, stripeErrorMessage } from '../_shared/stripe.ts';

const BATCH_LIMIT = 20;
const LEASE_SECONDS = 300;
const MAX_ATTEMPTS = 8;

type Admin = ReturnType<typeof getServiceClient>;

interface Claim {
  order_id: string;
  seller_id: string | null;
  currency: string;
  amount_minor: number;
  stripe_charge_id: string | null;
  stripe_transfer_group: string | null;
  transfer_idempotency_key: string;
  attempts: number;
}

function authorized(req: Request): boolean {
  const secret = Deno.env.get('DKAIM_TRANSFER_WORKER_SECRET');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const auth = req.headers.get('Authorization');
  const provided = req.headers.get('x-worker-secret');
  if (secret && provided && provided === secret) return true;
  if (serviceKey && auth === `Bearer ${serviceKey}`) return true;
  return false;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function backoffMinutes(attempts: number): number {
  return Math.min(24 * 60, 5 * Math.pow(2, Math.max(0, attempts - 1)));
}

async function release(
  admin: Admin,
  orderId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await admin
    .from('dkai_orders')
    .update({ transfer_lease_until: null, ...patch })
    .eq('id', orderId);
}

async function retryLater(admin: Admin, claim: Claim, message: string, state = 'failed') {
  const next = new Date(Date.now() + backoffMinutes(claim.attempts) * 60_000).toISOString();
  await release(admin, claim.order_id, {
    transfer_state: claim.attempts >= MAX_ATTEMPTS ? 'blocked' : state,
    transfer_next_attempt_at: next,
    transfer_last_error: message.slice(0, 500),
  });
}

/** Look for a transfer that already exists for this order (crash recovery). */
async function findExistingTransfer(
  transferGroup: string | null,
  orderId: string,
): Promise<any | null> {
  if (!transferGroup) return null;
  const list = await stripeCall('transfers', { transfer_group: transferGroup, limit: '25' }, {
    method: 'GET',
  });
  if (!list.ok) return null;
  const hit = (list.data?.data ?? []).find(
    (t: any) => t?.metadata?.order_id === orderId,
  );
  return hit ?? null;
}

async function processClaim(admin: Admin, claim: Claim): Promise<string> {
  if (!claim.stripe_charge_id) {
    await retryLater(admin, claim, 'No settled charge on the order', 'blocked');
    return 'no_charge';
  }
  if (!claim.amount_minor || claim.amount_minor <= 0) {
    await release(admin, claim.order_id, { transfer_state: 'blocked', transfer_last_error: 'Nothing to transfer' });
    return 'zero_amount';
  }

  // --- Seller payout account + capabilities --------------------------------
  const { data: cfg } = await admin
    .from('dkai_seller_payment_configs')
    .select('stripe_account_id, payouts_enabled, transfers_capability_active, account_restricted, stripe_default_currency')
    .eq('seller_id', claim.seller_id)
    .maybeSingle();

  const destination = cfg?.stripe_account_id;
  if (!destination) {
    await retryLater(admin, claim, 'Seller has no connected Stripe account', 'blocked');
    return 'no_destination';
  }

  const account = await stripeCall(`accounts/${destination}`, undefined, { method: 'GET' });
  if (!account.ok) {
    await retryLater(admin, claim, `Account lookup failed: ${stripeErrorMessage(account.data)}`);
    return 'account_error';
  }
  const transfersActive = account.data?.capabilities?.transfers === 'active';
  const currentlyDue: string[] = account.data?.requirements?.currently_due ?? [];
  const disabledReason: string | null = account.data?.requirements?.disabled_reason ?? null;

  await admin
    .from('dkai_seller_payment_configs')
    .update({
      transfers_capability_active: transfersActive,
      payouts_enabled: !!account.data?.payouts_enabled,
      charges_enabled: !!account.data?.charges_enabled,
      account_restricted: !!disabledReason,
      stripe_account_country: account.data?.country ?? null,
      stripe_default_currency: account.data?.default_currency ?? null,
      requirements_snapshot: account.data?.requirements ?? null,
      capabilities_synced_at: new Date().toISOString(),
    })
    .eq('seller_id', claim.seller_id);

  if (!transfersActive || disabledReason) {
    await retryLater(
      admin,
      claim,
      `Seller account not eligible for transfers (${disabledReason ?? 'transfers capability inactive'}${
        currentlyDue.length ? `, due: ${currentlyDue.join(', ')}` : ''
      })`,
      'blocked',
    );
    return 'account_restricted';
  }

  // --- Re-verify the charge right before paying out -------------------------
  const charge = await stripeCall(`charges/${claim.stripe_charge_id}`, undefined, { method: 'GET' });
  if (!charge.ok) {
    await retryLater(admin, claim, `Charge lookup failed: ${stripeErrorMessage(charge.data)}`);
    return 'charge_error';
  }
  if (charge.data.status !== 'succeeded' || charge.data.paid !== true) {
    await retryLater(admin, claim, `Charge not settled (status ${charge.data.status})`, 'blocked');
    return 'charge_not_settled';
  }
  if (charge.data.refunded || Number(charge.data.amount_refunded ?? 0) > 0) {
    await release(admin, claim.order_id, {
      transfer_state: 'blocked',
      transfer_last_error: 'Charge refunded — seller entitlement cancelled or reduced',
      refunded_amount_minor: Number(charge.data.amount_refunded ?? 0),
    });
    return 'refunded';
  }
  if (charge.data.disputed) {
    await release(admin, claim.order_id, {
      transfer_state: 'blocked',
      transfer_last_error: 'Charge disputed — release blocked',
    });
    return 'disputed';
  }

  const currency = (claim.currency || charge.data.currency || 'chf').toLowerCase();
  const chargeCurrency = String(charge.data.currency).toLowerCase();

  // --- Recover an earlier ambiguous / crashed attempt -----------------------
  const { data: openOp } = await admin
    .from('dkai_transfer_operations')
    .select('id, status, stripe_transfer_id, idempotency_key, amount_minor')
    .eq('order_id', claim.order_id)
    .in('status', ['pending', 'ambiguous', 'succeeded'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openOp?.status === 'succeeded' && openOp.stripe_transfer_id) {
    await release(admin, claim.order_id, {
      transfer_state: 'completed',
      stripe_transfer_id: openOp.stripe_transfer_id,
      transfer_completed_at: new Date().toISOString(),
      transfer_amount: openOp.amount_minor / 100,
    });
    return 'already_completed';
  }

  if (openOp && (openOp.status === 'pending' || openOp.status === 'ambiguous')) {
    const existing = await findExistingTransfer(claim.stripe_transfer_group, claim.order_id);
    if (existing) {
      await admin
        .from('dkai_transfer_operations')
        .update({
          status: 'succeeded',
          stripe_transfer_id: existing.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', openOp.id);
      await release(admin, claim.order_id, {
        transfer_state: 'completed',
        stripe_transfer_id: existing.id,
        transfer_amount: Number(existing.amount) / 100,
        transfer_completed_at: new Date().toISOString(),
        transfer_last_error: null,
        status: 'completed',
      });
      return 'recovered';
    }
    // No Stripe transfer exists: reuse the SAME frozen idempotency key below.
  }

  // --- Freeze request params and persist the operation BEFORE calling Stripe -
  const idempotencyKey = openOp?.idempotency_key ?? claim.transfer_idempotency_key;
  const params: Record<string, string> = {
    amount: String(claim.amount_minor),
    currency,
    destination,
    transfer_group: claim.stripe_transfer_group ?? `order_${claim.order_id}`,
    'metadata[order_id]': claim.order_id,
    'metadata[seller_id]': claim.seller_id ?? '',
    'metadata[charge_id]': claim.stripe_charge_id,
  };
  // source_transaction keeps the funds tied to the original charge; it is only
  // valid when the settlement currency of the charge matches the transfer.
  if (chargeCurrency === currency) {
    params['source_transaction'] = claim.stripe_charge_id;
  }

  let operationId = openOp?.id as string | undefined;
  if (!operationId) {
    const { data: op, error: opErr } = await admin
      .from('dkai_transfer_operations')
      .insert({
        order_id: claim.order_id,
        seller_id: claim.seller_id,
        destination_account: destination,
        transfer_group: params.transfer_group,
        source_transaction: params.source_transaction ?? null,
        amount_minor: claim.amount_minor,
        currency,
        idempotency_key: idempotencyKey,
        request_params: params,
        status: 'pending',
        attempts: 1,
      })
      .select('id')
      .single();
    if (opErr || !op) {
      await retryLater(admin, claim, `Could not persist transfer operation: ${opErr?.message}`);
      return 'op_persist_failed';
    }
    operationId = op.id;
  } else {
    await admin
      .from('dkai_transfer_operations')
      .update({ status: 'pending', attempts: (claim.attempts ?? 1), updated_at: new Date().toISOString() })
      .eq('id', operationId);
  }

  await admin
    .from('dkai_orders')
    .update({
      transfer_request_params: params,
      transfer_idempotency_key: idempotencyKey,
      transfer_initiated_at: new Date().toISOString(),
      transfer_destination_account: destination,
    })
    .eq('id', claim.order_id);

  // --- Create the transfer --------------------------------------------------
  let result: Awaited<ReturnType<typeof stripeCall>>;
  try {
    result = await stripeCall('transfers', params, { idempotencyKey });
  } catch (err) {
    await admin
      .from('dkai_transfer_operations')
      .update({
        status: 'ambiguous',
        error_message: String((err as Error).message).slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq('id', operationId!);
    await retryLater(admin, claim, `Transfer call failed, outcome unknown: ${(err as Error).message}`);
    return 'ambiguous';
  }

  if (result.ok) {
    const transfer = result.data;
    await admin
      .from('dkai_transfer_operations')
      .update({
        status: 'succeeded',
        stripe_transfer_id: transfer.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', operationId!);
    await admin.from('dkai_transfer_attempts').insert({
      order_id: claim.order_id,
      seller_id: claim.seller_id,
      destination_account: destination,
      amount: claim.amount_minor / 100,
      currency,
      idempotency_key: `${idempotencyKey}_${Date.now()}`,
      stripe_transfer_id: transfer.id,
      outcome: 'success',
    });
    await release(admin, claim.order_id, {
      transfer_state: 'completed',
      stripe_transfer_id: transfer.id,
      transfer_amount: claim.amount_minor / 100,
      transfer_completed_at: new Date().toISOString(),
      transfer_last_error: null,
      status: 'completed',
    });
    return 'transferred';
  }

  const code = result.data?.error?.code ?? '';
  const message = stripeErrorMessage(result.data);
  const permanent = ['account_invalid', 'balance_insufficient'].includes(code) === false && result.status < 500 && result.status !== 429;

  await admin
    .from('dkai_transfer_operations')
    .update({
      status: permanent ? 'failed' : 'pending',
      error_code: code,
      error_message: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq('id', operationId!);
  await admin.from('dkai_transfer_attempts').insert({
    order_id: claim.order_id,
    seller_id: claim.seller_id,
    destination_account: destination,
    amount: claim.amount_minor / 100,
    currency,
    idempotency_key: `${idempotencyKey}_${Date.now()}`,
    outcome: 'failure',
    error_message: message.slice(0, 500),
  });
  await retryLater(admin, claim, `${code || result.status}: ${message}`);
  return 'failed';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!authorized(req)) return json({ error: 'Unauthorized' }, 401);

  const admin = getServiceClient();
  const { data: claims, error } = await admin.rpc('dkai_claim_transfer_batch', {
    _limit: BATCH_LIMIT,
    _lease_seconds: LEASE_SECONDS,
  });
  if (error) return json({ error: error.message }, 500);

  const outcomes: Record<string, number> = {};
  for (const claim of (claims ?? []) as Claim[]) {
    let outcome = 'error';
    try {
      outcome = await processClaim(admin, claim);
    } catch (err) {
      console.error('transfer-worker claim error', claim.order_id, err);
      await retryLater(admin, claim, String((err as Error).message));
    }
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
  }

  return json({ ok: true, claimed: (claims ?? []).length, outcomes });
});
