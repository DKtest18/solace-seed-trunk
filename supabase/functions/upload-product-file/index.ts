import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';
import { safeContentType } from '../_shared/delivery-path.ts';

const BUCKET = 'product-deliveries';
const MAX_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB

function sanitizeName(n: string) {
  return n.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_').slice(0, 120);
}

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { product_id, file_name, mime_type, file_size, base64_content } = await req.json();

    if (!product_id || !file_name || !mime_type || !file_size || !base64_content) {
      return errorResponse('Missing required fields', 400);
    }
    if (typeof file_size !== 'number' || file_size <= 0 || file_size > MAX_SIZE) {
      return errorResponse(`File size invalid or exceeds ${MAX_SIZE / 1024 / 1024}MB`, 400);
    }
    if (file_name.includes('..') || file_name.includes('/') || file_name.includes('\\')) {
      return errorResponse('Invalid filename', 400);
    }

    const admin = getServiceClient();

    // Verify ownership
    const { data: product, error: pErr } = await admin
      .from('dkai_products')
      .select('id, seller_id')
      .eq('id', product_id)
      .single();
    if (pErr || !product) return errorResponse('Product not found', 404);
    if (product.seller_id !== user.id) return errorResponse('Forbidden', 403);

    // Decode base64
    let bytes: Uint8Array;
    try {
      const bin = atob(base64_content);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch {
      return errorResponse('Invalid base64 content', 400);
    }
    if (bytes.length !== file_size) {
      return errorResponse('Declared size does not match payload', 400);
    }

    const fileId = crypto.randomUUID();
    const safe = sanitizeName(file_name);
    const filePath = `${user.id}/${safe}`;

    // HTML/SVG/JS are stored as opaque binaries so they can never be rendered
    // in our own origin if a link is ever opened directly.
    const storedType = safeContentType(String(mime_type), safe);

    const { error: upErr } = await admin.storage.from(BUCKET).upload(filePath, bytes, {
      contentType: storedType,
      upsert: false,
    });
    if (upErr) return errorResponse(`Upload failed: ${upErr.message}`, 500);

    // Checks performed before storing: authenticated owner of the product,
    // size cap, declared-size match, path confined to the uploader's folder,
    // no overwrite (upsert: false), active content neutralised. No third-party
    // scanning service ever receives the file.
    const { data: row, error: insErr } = await admin
      .from('dkai_product_files')
      .insert({
        id: fileId,
        product_id,
        seller_id: user.id,
        storage_path: filePath,
        original_filename: file_name,
        file_size,
        mime_type: storedType,
        scan_status: 'clean',
      })
      .select()
      .single();

    if (insErr) {
      await admin.storage.from(BUCKET).remove([filePath]);
      return errorResponse(`DB insert failed: ${insErr.message}`, 500);
    }

    return jsonResponse({ file_id: row.id, storage_path: filePath, scan_status: 'clean' });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
