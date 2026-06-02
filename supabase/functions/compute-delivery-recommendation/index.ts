/**
 * Recompute the recommended delivery tier server-side and persist it on the
 * product. Also persists the seller's chosen tier and override flag, and
 * enforces:
 *   - tier1 / tier2: require at least one clean delivery file before publish
 *   - tier3        : require no file (delivery files are ignored)
 *
 * IMPORTANT: The recommendation algorithm here MUST stay identical to
 * `src/lib/deliveryRecommendation.ts`.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

type DeliveryTier = 'tier1' | 'tier2' | 'tier3';

interface Thresholds {
  price_tier2_min: number;
  price_tier3_min: number;
  sales_tier2_max: number;
  sales_tier3_max: number;
  size_tier2_min: number;
  size_tier3_min: number;
}

const DEFAULT_THRESHOLDS: Thresholds = {
  price_tier2_min: 1000,
  price_tier3_min: 10000,
  sales_tier2_max: 100,
  sales_tier3_max: 20,
  size_tier2_min: 524_288_000,
  size_tier3_min: 5_368_709_120,
};

function compute(
  input: { price: number; max_sales: number | null; file_size_bytes: number },
  t: Thresholds
): { recommended: DeliveryTier; reason: string } {
  const price = Number.isFinite(input.price) ? input.price : 0;
  const size = Number.isFinite(input.file_size_bytes) ? input.file_size_bytes : 0;
  const maxSales = input.max_sales;

  let priceScore: 1 | 2 | 3 = price <= t.price_tier2_min ? 1 : price <= t.price_tier3_min ? 2 : 3;
  let scarcityScore: 1 | 2 | 3 =
    maxSales == null || maxSales > t.sales_tier2_max
      ? 1
      : maxSales < t.sales_tier3_max
      ? 3
      : 2;
  let sizeScore: 1 | 2 | 3 = size <= t.size_tier2_min ? 1 : size <= t.size_tier3_min ? 2 : 3;

  const maxScore = Math.max(priceScore, scarcityScore, sizeScore) as 1 | 2 | 3;
  const twos = [priceScore, scarcityScore, sizeScore].filter((s) => s === 2).length;
  const finalScore: 1 | 2 | 3 = maxScore === 2 && twos >= 2 ? 3 : maxScore;
  const recommended: DeliveryTier = finalScore === 3 ? 'tier3' : finalScore === 2 ? 'tier2' : 'tier1';

  let reason = 'Standard delivery is fine.';
  if (recommended !== 'tier1') {
    if (priceScore === maxScore && priceScore >= 2) {
      const th = priceScore === 3 ? t.price_tier3_min : t.price_tier2_min;
      reason = `Price above CHF ${th}.`;
    } else if (scarcityScore === maxScore && scarcityScore >= 2 && maxSales != null) {
      reason =
        scarcityScore === 3
          ? `Limited edition (fewer than ${t.sales_tier3_max} sales).`
          : `Limited availability (max ${maxSales} sales).`;
    } else if (sizeScore === maxScore && sizeScore >= 2) {
      const th = sizeScore === 3 ? t.size_tier3_min : t.size_tier2_min;
      reason = `File larger than ${th} bytes.`;
    }
  }
  return { recommended, reason };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const {
      product_id,
      delivery_tier,                // chosen by seller
      override_acknowledged,        // boolean
      delivery_method_note,         // string|null
      publish,                      // optional: enforce publish-time rules
    } = body ?? {};

    if (!product_id || !['tier1', 'tier2', 'tier3'].includes(delivery_tier)) {
      return new Response(JSON.stringify({ error: 'product_id and valid delivery_tier required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE);

    // Ownership check
    const { data: product, error: pErr } = await admin
      .from('dkai_products')
      .select('id, seller_id, price')
      .eq('id', product_id)
      .maybeSingle();
    if (pErr || !product) {
      return new Response(JSON.stringify({ error: 'Product not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (product.seller_id !== userId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load thresholds (fallback to defaults)
    const { data: thresholdRow } = await admin
      .from('dkai_delivery_thresholds')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    const thresholds: Thresholds = (thresholdRow as Thresholds) ?? DEFAULT_THRESHOLDS;

    // Aggregate file size from clean delivery files
    const { data: files } = await admin
      .from('dkai_product_files')
      .select('file_size, scan_status')
      .eq('product_id', product_id);

    const cleanFiles = (files ?? []).filter((f: any) => f.scan_status === 'clean');
    const fileSize = cleanFiles.reduce((s: number, f: any) => s + (Number(f.file_size) || 0), 0);

    const { recommended, reason } = compute(
      {
        price: Number(product.price) || 0,
        max_sales: body?.max_sales ?? null,
        file_size_bytes: fileSize,
      },
      thresholds
    );

    const overridden = delivery_tier !== recommended;
    const tierRank = (t: DeliveryTier) => (t === 'tier3' ? 3 : t === 'tier2' ? 2 : 1);
    const downTiering = tierRank(delivery_tier) < tierRank(recommended);

    if (downTiering && !override_acknowledged) {
      return new Response(
        JSON.stringify({
          error: 'override_acknowledgement_required',
          recommended,
          reason,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Publish-time enforcement
    if (publish) {
      if ((delivery_tier === 'tier1' || delivery_tier === 'tier2') && cleanFiles.length === 0) {
        return new Response(
          JSON.stringify({
            error: 'A clean delivery file is required to publish a tier1/tier2 product.',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const updatePayload: Record<string, unknown> = {
      delivery_tier,
      delivery_tier_recommended: recommended,
      delivery_tier_overridden: overridden,
      file_size_bytes: fileSize,
    };
    if (typeof body?.max_sales !== 'undefined') updatePayload.max_sales = body.max_sales;
    if (delivery_tier === 'tier3') {
      updatePayload.delivery_method_note = (delivery_method_note ?? '').toString().slice(0, 1000);
    }

    const { error: updErr } = await admin
      .from('dkai_products')
      .update(updatePayload)
      .eq('id', product_id);
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        recommended,
        reason,
        chosen: delivery_tier,
        overridden,
        file_size_bytes: fileSize,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
