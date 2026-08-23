// Admin moves a product through the review pipeline.
// Actions: start | approve | request_changes | reject
// Records reviewed_by/reviewed_at + emits email to the seller.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { REVIEW_STATUS, REVIEW_STATUS_GROUPS, type ReviewStatusValue } from '../_shared/review-status.ts';

type Action = 'start' | 'approve' | 'request_changes' | 'reject';

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

    // Verify admin
    const { data: isAdminData } = await admin.rpc('dkai_has_role', {
      _user_id: u.user.id,
      _role: 'admin',
    });
    if (!isAdminData) return json({ error: 'Forbidden — admin only' }, 403);

    const { product_id, action, notes } = await req.json().catch(() => ({}));
    const validActions: Action[] = ['start', 'approve', 'request_changes', 'reject'];
    if (!product_id || !validActions.includes(action)) {
      return json({ error: 'product_id and valid action required' }, 400);
    }
    if ((action === 'request_changes' || action === 'reject') && (!notes || String(notes).trim().length < 10)) {
      return json({ error: 'Notes (min 10 chars) required for this action.' }, 400);
    }

    const { data: product } = await admin
      .from('dkai_products')
      .select('id, seller_id, title, review_status')
      .eq('id', product_id)
      .maybeSingle();
    if (!product) return json({ error: 'Product not found' }, 404);

    let newStatus: ReviewStatusValue;
    let emailType: string | null = null;
    let extraUpdates: Record<string, unknown> = {};

    switch (action) {
      case 'start':
        if (!(REVIEW_STATUS_GROUPS.PENDING as readonly string[]).includes(product.review_status)) {
          return json({ error: 'Only submitted products can enter review.' }, 400);
        }
        newStatus = REVIEW_STATUS.IN_REVIEW;
        break;
      case 'approve':
        newStatus = REVIEW_STATUS.APPROVED;
        extraUpdates = {
          reviewed_by: u.user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes ?? null,
        };
        emailType = 'product_approved';
        break;
      case 'request_changes':
        newStatus = REVIEW_STATUS.CHANGES_REQUESTED;
        extraUpdates = {
          reviewed_by: u.user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes,
        };
        emailType = 'product_changes_requested';
        break;
      case 'reject':
        newStatus = REVIEW_STATUS.REJECTED;
        extraUpdates = {
          reviewed_by: u.user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes,
        };
        emailType = 'product_rejected';
        break;
      default:
        return json({ error: 'Invalid action' }, 400);
    }

    const { error: upErr } = await admin
      .from('dkai_products')
      .update({ review_status: newStatus, ...extraUpdates })
      .eq('id', product_id);
    if (upErr) return json({ error: upErr.message }, 500);

    if (emailType) {
      try {
        const { data: seller } = await admin
          .from('dkai_profiles')
          .select('email')
          .eq('id', product.seller_id)
          .maybeSingle();
        if (seller?.email) {
          await admin.functions.invoke('send-notification-email', {
            body: {
              type: emailType,
              recipientEmail: seller.email,
              data: {
                productTitle: product.title,
                productId: product.id,
                reason: notes ?? null,
                notes: notes ?? null,
              },
            },
            headers: { Authorization: `Bearer ${SERVICE}` },
          });
        }
      } catch (e) {
        console.warn('notification failed (non-blocking)', e);
      }
    }

    return json({ ok: true, review_status: newStatus });
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
