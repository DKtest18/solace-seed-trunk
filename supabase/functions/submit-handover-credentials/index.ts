import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';
import { encryptSecret } from '../_shared/handover-crypto.ts';

interface Spec { key: string; label: string; type?: string; required?: boolean }

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const { user, error: authErr } = await getAuthenticatedUser(req);
  if (authErr || !user) return errorResponse('Unauthorized', 401);

  try {
    const body = await req.json();
    const orderId = typeof body?.order_id === 'string' ? body.order_id : '';
    const values = body?.values;
    if (!orderId || !values || typeof values !== 'object' || Array.isArray(values)) {
      return errorResponse('order_id and values are required', 400);
    }

    const admin = getServiceClient();

    // Everything trust-relevant is loaded server-side from the order/product.
    const { data: order, error: oErr } = await admin
      .from('dkai_orders')
      .select('id, buyer_id, seller_id, product_id, handover_status')
      .eq('id', orderId)
      .maybeSingle();
    if (oErr || !order) return errorResponse('Order not found', 404);
    if (order.buyer_id !== user.id) return errorResponse('Forbidden', 403);

    const { data: product, error: pErr } = await admin
      .from('dkai_products')
      .select('id, seller_id, requires_setup_credentials, setup_requirements, setup_access_window_hours')
      .eq('id', order.product_id)
      .maybeSingle();
    if (pErr || !product) return errorResponse('Product not found', 404);
    if (!product.requires_setup_credentials) {
      return errorResponse('This product does not require credential handover', 400);
    }

    const specs: Spec[] = Array.isArray(product.setup_requirements) ? product.setup_requirements : [];
    if (specs.length === 0) return errorResponse('No credential specs defined', 400);

    const windowHours = Math.min(168, Math.max(1, Number(product.setup_access_window_hours) || 48));
    const expiresAt = new Date(Date.now() + windowHours * 3600_000).toISOString();

    const rows: Record<string, unknown>[] = [];
    for (const spec of specs) {
      const raw = values[spec.key];
      const value = typeof raw === 'string' ? raw.trim() : '';
      if (!value) {
        if (spec.required) return errorResponse(`${spec.label || spec.key} is required`, 400);
        continue;
      }
      if (value.length > 5000) return errorResponse(`${spec.label || spec.key} is too long`, 400);
      const enc = await encryptSecret(value);
      rows.push({
        order_id: order.id,
        product_id: product.id,
        buyer_id: user.id,
        seller_id: order.seller_id ?? product.seller_id,
        spec_key: spec.key,
        spec_label: spec.label || spec.key,
        ciphertext: enc.ciphertext,
        iv: enc.iv,
        auth_tag: enc.auth_tag,
        access_expires_at: expiresAt,
        purged_at: null,
        purged_reason: null,
      });
    }
    if (rows.length === 0) return errorResponse('Nothing to submit', 400);

    const { error: upErr } = await admin
      .from('dkai_credential_handovers')
      .upsert(rows, { onConflict: 'order_id,spec_key' });
    if (upErr) return errorResponse(`Could not store credentials: ${upErr.message}`, 500);

    await admin
      .from('dkai_orders')
      .update({ handover_status: 'submitted', handover_purge_at: expiresAt })
      .eq('id', order.id);

    return jsonResponse({ success: true, items: rows.length, access_expires_at: expiresAt });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
