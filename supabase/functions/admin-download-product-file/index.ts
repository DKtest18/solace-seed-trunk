// Admin review/dispute access to private delivery files.
//
// Security model:
//   * bearer JWT required; the user id comes from the verified token only
//   * admin role is re-checked server-side against dkai_user_roles with the
//     service-role client (never from the request body or the frontend)
//   * a written reason of >= 20 characters is mandatory and is audit-logged
//   * every stored path is verified to live in its own seller's folder before
//     it is signed, so a forged dkai_product_files row cannot be used to reach
//     another seller's objects
//   * links are short-lived (5 minutes) and are never written to the audit log
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';
import { isOwnedDeliveryPath } from '../_shared/delivery-path.ts';

const BUCKET = 'product-deliveries';
const TTL = 300; // 5 minutes

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('unauthorized', 401);

  try {
    const body = await req.json().catch(() => ({}));
    const productId = body.product_id ? String(body.product_id) : '';
    const fileId = body.file_id ? String(body.file_id) : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    const disputeId = body.dispute_id ? String(body.dispute_id) : null;

    if (!productId) return errorResponse('product_id_required', 400);
    if (reason.length < 20) return errorResponse('reason_too_short', 400);

    const admin = getServiceClient();

    const { data: roleRow } = await admin
      .from('dkai_user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (!roleRow) return errorResponse('admin_only', 403);

    let query = admin
      .from('dkai_product_files')
      .select('id, seller_id, storage_bucket, storage_path, original_filename, mime_type')
      .eq('product_id', productId);
    if (fileId) query = query.eq('id', fileId);
    const { data: rows, error: qErr } = await query.order('uploaded_at', { ascending: false });
    if (qErr) return errorResponse(qErr.message, 500);
    if (!rows || rows.length === 0) return errorResponse('no_files_for_product', 404);

    const files: { file_name: string; signed_url: string }[] = [];
    const skipped: string[] = [];

    for (const row of rows) {
      if (!isOwnedDeliveryPath(row.storage_path, row.seller_id)) {
        skipped.push(row.original_filename);
        continue;
      }
      const { data: signed } = await admin.storage
        .from(row.storage_bucket ?? BUCKET)
        .createSignedUrl(row.storage_path, TTL, { download: row.original_filename });
      if (signed?.signedUrl) {
        files.push({ file_name: row.original_filename, signed_url: signed.signedUrl });
        await admin.from('dkai_file_access_log').insert({
          user_id: user.id,
          product_file_id: row.id,
          access_type: disputeId ? 'admin_dispute_access' : 'admin_review_access',
          justification: reason,
          ip_address: req.headers.get('x-forwarded-for') ?? null,
          user_agent: req.headers.get('user-agent') ?? null,
        });
      }
    }

    if (files.length === 0) return errorResponse('no_files_for_product', 404);

    return jsonResponse({
      files,
      expires_at: new Date(Date.now() + TTL * 1000).toISOString(),
      ...(skipped.length ? { skipped_invalid_paths: skipped } : {}),
    });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
