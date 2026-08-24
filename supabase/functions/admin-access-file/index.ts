import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

const BUCKET = 'product-deliveries';
const ADMIN_TTL = 900; // 15 minutes

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { product_file_id, justification, access_type } = await req.json();
    if (!product_file_id) return errorResponse('product_file_id required', 400);
    if (!justification || typeof justification !== 'string' || justification.trim().length < 20) {
      return errorResponse('Justification required (min 20 chars)', 400);
    }
    const auditType = access_type === 'admin_review_access'
      ? 'admin_review_access'
      : 'admin_dispute_access';

    const admin = getServiceClient();

    const { data: roleRow } = await admin
      .from('dkai_user_roles')
      .select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    if (!roleRow) return errorResponse('Admin only', 403);

    const { data: file, error: fErr } = await admin
      .from('dkai_product_files')
      .select('id, storage_bucket, storage_path, original_filename, seller_id')
      .eq('id', product_file_id)
      .single();
    if (fErr || !file) return errorResponse('File not found', 404);

    const { data: signed, error: sErr } = await admin.storage
      .from(file.storage_bucket ?? BUCKET)
      .createSignedUrl(file.storage_path, ADMIN_TTL, { download: file.original_filename });
    if (sErr || !signed) return errorResponse('Failed to sign URL', 500);

    const { data: logRow } = await admin.from('dkai_file_access_log').insert({
      user_id: user.id,
      product_file_id: file.id,
      access_type: auditType,
      justification: justification.trim(),
      ip_address: req.headers.get('x-forwarded-for') ?? null,
      user_agent: req.headers.get('user-agent') ?? null,
    }).select('id').single();

    // Best-effort transparency email to seller
    try {
      const { data: seller } = await admin
        .from('dkai_profiles')
        .select('email, full_name')
        .eq('user_id', file.seller_id)
        .maybeSingle();
      if (seller?.email) {
        const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification-email`;
        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            to: seller.email,
            type: 'admin_accessed_file',
            data: { file_name: file.original_filename, justification: justification.trim() },
          }),
        }).catch(() => {});
      }
    } catch { /* ignore */ }

    return jsonResponse({
      signed_url: signed.signedUrl,
      expires_at: new Date(Date.now() + ADMIN_TTL * 1000).toISOString(),
      access_log_id: logRow?.id,
    });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
