// Seller submits a product for review.
// - Validates ownership and required fields
// - Computes `requires_access_review` from delivery_tier / price / file size / category
// - Sets the canonical submitted review status and submitted_at=now()
// - Triggers product_submitted_for_review notification email
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { REVIEW_STATUS, REVIEW_STATUS_GROUPS } from '../_shared/review-status.ts';

const SENSITIVE_CATEGORIES = ['adult', 'security', 'surveillance', 'biometric', 'medical', 'financial-advice'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const auth = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
    const { data: u, error: ue } = await userClient.auth.getUser();
    if (ue || !u.user) return json({ error: 'Unauthorized' }, 401);

    const { product_id, sample_file_path } = await req.json().catch(() => ({}));
    if (!product_id) return json({ error: 'product_id required' }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE);

    const { data: product, error: pe } = await admin
      .from('dkai_products')
      .select('id, seller_id, title, price, delivery_tier, file_size_bytes, category, review_status')
      .eq('id', product_id)
      .maybeSingle();
    if (pe || !product) return json({ error: 'Product not found' }, 404);
    if (product.seller_id !== u.user.id) return json({ error: 'Forbidden' }, 403);
    if (!product.title || product.price == null) {
      return json({ error: 'Product must have a title and price before submitting.' }, 400);
    }
    if ([...REVIEW_STATUS_GROUPS.PENDING, REVIEW_STATUS.APPROVED].includes(product.review_status)) {
      return json({ error: `Product is already ${product.review_status}.` }, 400);
    }

    // Thresholds for access-review decision
    const { data: th } = await admin
      .from('dkai_delivery_thresholds').select('*').eq('id', 1).maybeSingle();
    const priceTier3 = Number(th?.price_tier3_min ?? 10000);
    const sizeTier3 = Number(th?.size_tier3_min ?? 5_368_709_120);

    const isSensitive = product.category && SENSITIVE_CATEGORIES.includes(String(product.category).toLowerCase());
    const requiresAccess =
      product.delivery_tier === 'tier3' ||
      Number(product.price) > priceTier3 ||
      Number(product.file_size_bytes ?? 0) > sizeTier3 ||
      !!isSensitive;

    // If access review required + tier3 (no hosted file): require a sample
    if (requiresAccess && product.delivery_tier === 'tier3' && !sample_file_path) {
      return json({
        error: 'sample_required',
        message:
          'A confidential sample or demo is required for review. Please upload one to the review-samples bucket and resubmit.',
      }, 400);
    }

    const { error: ue2 } = await admin
      .from('dkai_products')
      .update({
        review_status: REVIEW_STATUS.SUBMITTED,
        submitted_at: new Date().toISOString(),
        requires_access_review: requiresAccess,
        review_notes: null,
      })
      .eq('id', product_id);
    if (ue2) return json({ error: ue2.message }, 500);

    // If a sample was provided, log it as a pending access record (no reviewer yet)
    if (sample_file_path && requiresAccess) {
      await admin.from('dkai_product_review_access').insert({
        product_id,
        reviewer_id: null,
        access_reason: 'Seller-provided sample at submission',
        sample_file_path,
      });
    }

    // Best-effort notification
    try {
      await admin.functions.invoke('send-notification-email', {
        body: {
          type: 'product_submitted_for_review',
          recipientEmail: u.user.email,
          data: { productTitle: product.title, productId: product.id, requiresAccessReview: requiresAccess },
        },
        headers: { Authorization: `Bearer ${SERVICE}` },
      });
    } catch (e) {
      console.warn('notification failed (non-blocking)', e);
    }

    return json({ ok: true, review_status: REVIEW_STATUS.SUBMITTED, requires_access_review: requiresAccess });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
