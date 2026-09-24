import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';
import { isOwnedDeliveryPath } from '../_shared/delivery-path.ts';
import { REVIEW_STATUS_GROUPS } from '../_shared/review-status.ts';
import { SALES_ENABLED } from '../_shared/sales-mode.ts';

const LIVE_STATUSES: string[] = [...REVIEW_STATUS_GROUPS.LIVE];

const BUCKET = 'product-deliveries';
const RATE_LIMIT = 20; // per hour per user
const URL_TTL = 60;    // 60 s: minimal shareable window

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { product_file_id, product_id, action } = await req.json();
    if (action === 'list') {
      if (!product_id) return errorResponse('product_id required', 400);
      // PREVIEW MODE: buyers have no download access at all.
      if (!SALES_ENABLED) return errorResponse('Downloads are disabled in preview mode.', 403);

      const admin = getServiceClient();

      // Products still in review never expose delivery files to buyers.
      const { data: listProduct } = await admin
        .from('dkai_products')
        .select('review_status')
        .eq('id', product_id)
        .maybeSingle();
      if (!listProduct || !LIVE_STATUSES.includes(String(listProduct.review_status))) {
        return errorResponse('This product is not available for download.', 403);
      }

      const { data: order } = await admin
        .from('dkai_orders')
        .select('id')
        .eq('buyer_id', user.id)
        .eq('product_id', product_id)
        .in('status', ['paid', 'completed', 'delivered'])
        .limit(1)
        .maybeSingle();
      if (!order) return errorResponse('Purchase not found or not eligible for download', 403);

      const { data: files, error: listError } = await admin
        .from('dkai_product_files')
        .select('id, original_filename, file_size, scan_status')
        .eq('product_id', product_id)
        .eq('scan_status', 'clean')
        .order('uploaded_at', { ascending: true });
      if (listError) return errorResponse(listError.message, 500);
      return jsonResponse({ files: files ?? [] });
    }

    if (!product_file_id) return errorResponse('product_file_id required', 400);

    const admin = getServiceClient();

    // Rate limit
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count: recent } = await admin
      .from('dkai_file_access_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('access_type', 'download')
      .gte('signed_url_generated_at', oneHourAgo);
    if ((recent ?? 0) >= RATE_LIMIT) {
      return errorResponse('Rate limit exceeded. Try again later.', 429);
    }

    const { data: file, error: fErr } = await admin
      .from('dkai_product_files')
      .select('id, product_id, storage_bucket, storage_path, original_filename, scan_status, seller_id')
      .eq('id', product_file_id)
      .single();
    if (fErr || !file) return errorResponse('File not found', 404);

    if (file.scan_status !== 'clean') {
      return errorResponse('File is not available (scan pending or failed)', 403);
    }

    // A stored path must live inside its own seller's folder. This blocks a
    // forged file row that points at another seller's objects.
    if (!isOwnedDeliveryPath(file.storage_path, file.seller_id)) {
      return errorResponse('This file is not available.', 403);
    }

    // Authorize: seller, admin, or buyer with paid order on a live product
    let allowed = file.seller_id === user.id;
    if (!allowed) {
      const { data: roleRow } = await admin
        .from('dkai_user_roles')
        .select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
      if (roleRow) allowed = true;
    }
    if (!allowed && SALES_ENABLED) {
      const { data: product } = await admin
        .from('dkai_products')
        .select('review_status')
        .eq('id', file.product_id)
        .maybeSingle();
      if (!product || !LIVE_STATUSES.includes(String(product.review_status))) {
        return errorResponse('This product is not available for download.', 403);
      }
      const { data: order } = await admin
        .from('dkai_orders')
        .select('id')
        .eq('buyer_id', user.id)
        .eq('product_id', file.product_id)
        .in('status', ['paid', 'completed', 'delivered'])
        .limit(1)
        .maybeSingle();
      if (order) allowed = true;
    }
    if (!allowed) return errorResponse('Forbidden', 403);

    const { data: signed, error: sErr } = await admin.storage
      .from(file.storage_bucket ?? BUCKET)
      .createSignedUrl(file.storage_path, URL_TTL, { download: file.original_filename });
    if (sErr || !signed) return errorResponse('Failed to sign URL', 500);

    await admin.from('dkai_file_access_log').insert({
      user_id: user.id,
      product_file_id: file.id,
      access_type: 'download',
      ip_address: req.headers.get('x-forwarded-for') ?? null,
      user_agent: req.headers.get('user-agent') ?? null,
    });

    return jsonResponse({
      signed_url: signed.signedUrl,
      expires_at: new Date(Date.now() + URL_TTL * 1000).toISOString(),
    });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
