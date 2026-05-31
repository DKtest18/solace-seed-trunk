import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

const BUCKET = 'product-files';
const RATE_LIMIT = 20; // per hour per user
const URL_TTL = 3600;  // 1 hour

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { product_file_id } = await req.json();
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
      .select('id, product_id, file_path, file_name, scan_status, uploaded_by')
      .eq('id', product_file_id)
      .single();
    if (fErr || !file) return errorResponse('File not found', 404);

    if (file.scan_status !== 'clean') {
      return errorResponse('File is not available (scan pending or failed)', 403);
    }

    // Authorize: seller, admin, or buyer with paid order
    let allowed = file.uploaded_by === user.id;
    if (!allowed) {
      const { data: roleRow } = await admin
        .from('dkai_user_roles')
        .select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
      if (roleRow) allowed = true;
    }
    if (!allowed) {
      const { data: order } = await admin
        .from('dkai_orders')
        .select('id')
        .eq('buyer_id', user.id)
        .eq('product_id', file.product_id)
        .in('status', ['paid', 'completed'])
        .limit(1)
        .maybeSingle();
      if (order) allowed = true;
    }
    if (!allowed) return errorResponse('Forbidden', 403);

    const { data: signed, error: sErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(file.file_path, URL_TTL, { download: file.file_name });
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
