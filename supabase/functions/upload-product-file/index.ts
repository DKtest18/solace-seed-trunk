import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

const BUCKET = 'product-files';
const MAX_SIZE = 500 * 1024 * 1024; // 500 MB

const ALLOWED_MIME = new Set([
  'application/zip', 'application/x-zip-compressed',
  'application/pdf', 'application/json',
  'application/octet-stream', 'application/x-yaml', 'text/yaml',
  'text/plain', 'text/csv', 'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm',
]);

const DANGEROUS_EXT = new Set(['exe','dll','bat','cmd','com','msi','scr','vbs','js','jse','ws','wsf','ps1','sh','jar','app','apk','deb','rpm','pkg','dmg','reg','hta']);

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
    if (!ALLOWED_MIME.has(mime_type)) {
      return errorResponse(`Disallowed mime type: ${mime_type}`, 400);
    }
    const ext = file_name.split('.').pop()?.toLowerCase() ?? '';
    if (DANGEROUS_EXT.has(ext)) return errorResponse(`Disallowed file extension: .${ext}`, 400);
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
    const filePath = `products/${product_id}/${fileId}-${safe}`;

    const { error: upErr } = await admin.storage.from(BUCKET).upload(filePath, bytes, {
      contentType: mime_type,
      upsert: false,
    });
    if (upErr) return errorResponse(`Upload failed: ${upErr.message}`, 500);

    const { data: row, error: insErr } = await admin
      .from('dkai_product_files')
      .insert({
        id: fileId,
        product_id,
        file_path: filePath,
        file_name,
        file_size,
        mime_type,
        scan_status: 'pending',
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (insErr) {
      await admin.storage.from(BUCKET).remove([filePath]);
      return errorResponse(`DB insert failed: ${insErr.message}`, 500);
    }

    // Fire-and-forget scan (best effort)
    try {
      const scanUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/scan-product-file-v2`;
      fetch(scanUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ file_id: row.id }),
      }).catch(() => {});
    } catch { /* ignore */ }

    return jsonResponse({ file_id: row.id, file_path: filePath, scan_status: 'pending' });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
