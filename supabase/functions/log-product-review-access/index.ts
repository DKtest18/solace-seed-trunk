// Admin logs (and is granted) time-limited access to a product's review sample
// or hosted file. Inserts an audit row in dkai_product_review_access and
// notifies the seller for transparency.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

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

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: isAdmin } = await admin.rpc('dkai_has_role', {
      _user_id: u.user.id,
      _role: 'admin',
    });
    if (!isAdmin) return json({ error: 'Forbidden — admin only' }, 403);

    const body = await req.json().catch(() => ({}));
    const { product_id, access_reason, expires_in_minutes = 60 } = body ?? {};
    if (!product_id || !access_reason || String(access_reason).trim().length < 10) {
      return json({ error: 'product_id and access_reason (min 10 chars) required' }, 400);
    }
    const expiresAt = new Date(Date.now() + Number(expires_in_minutes) * 60_000).toISOString();

    const { data: product } = await admin
      .from('dkai_products')
      .select('id, seller_id, title')
      .eq('id', product_id)
      .maybeSingle();
    if (!product) return json({ error: 'Product not found' }, 404);

    // Find most recent sample (if any) for this product
    const { data: lastSample } = await admin
      .from('dkai_product_review_access')
      .select('sample_file_path')
      .eq('product_id', product_id)
      .not('sample_file_path', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: accessRow, error: accessErr } = await admin
      .from('dkai_product_review_access')
      .insert({
        product_id,
        reviewer_id: u.user.id,
        access_reason: String(access_reason).slice(0, 1000),
        access_expires_at: expiresAt,
        sample_file_path: lastSample?.sample_file_path ?? null,
      })
      .select()
      .single();
    if (accessErr) return json({ error: accessErr.message }, 500);

    // Generate a short-lived signed URL for the sample if one exists
    let signedUrl: string | null = null;
    if (lastSample?.sample_file_path) {
      const { data: sig } = await admin.storage
        .from('product-review-samples')
        .createSignedUrl(lastSample.sample_file_path, Number(expires_in_minutes) * 60);
      signedUrl = sig?.signedUrl ?? null;
    }

    // Transparency email to seller
    try {
      const { data: seller } = await admin
        .from('dkai_profiles').select('email').eq('id', product.seller_id).maybeSingle();
      if (seller?.email) {
        await admin.functions.invoke('send-notification-email', {
          body: {
            type: 'product_review_access_logged',
            recipientEmail: seller.email,
            data: {
              productTitle: product.title,
              productId: product.id,
              accessedAt: new Date().toISOString(),
              expiresAt,
            },
          },
          headers: { Authorization: `Bearer ${SERVICE}` },
        });
      }
    } catch (e) {
      console.warn('notification failed (non-blocking)', e);
    }

    return json({ ok: true, access_id: accessRow.id, signed_url: signedUrl, expires_at: expiresAt });
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
