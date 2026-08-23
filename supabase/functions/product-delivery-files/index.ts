// Delivery-file lifecycle for products, including AFTER a product was submitted
// for review or already approved.
//
// Actions (POST JSON { action, ... }):
//   sign_upload  -> { path, token }  signed upload URL for the private bucket
//   commit       -> registers the uploaded object in dkai_product_files and
//                   mirrors the primary-file columns onto dkai_products
//   list         -> delivery files of a product (seller or admin)
//   delete       -> removes a file from storage + db, re-points primary columns
//   resubmit     -> sends the product back to review after file changes
//
// Security: bearer JWT required; only the product's seller (or an admin) may
// touch a product's files. The `product-files` bucket stays PRIVATE — buyers get
// short-lived signed URLs from `generate-download-url`, admins from
// `admin-access-file`.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { REVIEW_STATUS } from '../_shared/review-status.ts';

const BUCKET = 'product-files';
const MAX_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB per delivery file
const DANGEROUS_EXT = new Set([
  'exe', 'dll', 'bat', 'cmd', 'com', 'msi', 'scr', 'vbs', 'jse', 'ws', 'wsf',
  'ps1', 'jar', 'app', 'apk', 'deb', 'rpm', 'pkg', 'dmg', 'reg', 'hta',
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_').slice(0, 120);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u, error: ue } = await userClient.auth.getUser();
    if (ue || !u.user) return json({ error: 'Unauthorized' }, 401);
    const userId = u.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? '');
    const productId = body.product_id ? String(body.product_id) : '';
    if (!productId) return json({ error: 'product_id required' }, 400);

    const { data: product, error: pe } = await admin
      .from('dkai_products')
      .select('id, seller_id, title, review_status, file_storage_key')
      .eq('id', productId)
      .maybeSingle();
    if (pe) return json({ error: pe.message }, 500);
    if (!product) return json({ error: 'Product not found' }, 404);

    const { data: adminRole } = await admin
      .from('dkai_user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    const isAdmin = !!adminRole;
    const isOwner = product.seller_id === userId;
    if (!isOwner && !isAdmin) return json({ error: 'Forbidden' }, 403);

    if (action === 'list') {
      const { data, error } = await admin
        .from('dkai_product_files')
        .select('id, file_name, file_size, file_path, mime_type, scan_status, created_at')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json({ files: data ?? [], review_status: product.review_status });
    }

    if (action === 'sign_upload') {
      const fileName = String(body.file_name ?? '');
      const fileSize = Number(body.file_size ?? 0);
      if (!fileName || fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
        return json({ error: 'Invalid file name' }, 400);
      }
      if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_SIZE) {
        return json({ error: `File size invalid or exceeds ${MAX_SIZE / 1024 / 1024 / 1024} GB` }, 400);
      }
      const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
      if (DANGEROUS_EXT.has(ext)) return json({ error: `Disallowed file extension: .${ext}` }, 400);

      const fileId = crypto.randomUUID();
      const path = `${product.seller_id}/${productId}/${fileId}-${sanitize(fileName)}`;
      const { data: signed, error: se } = await admin.storage
        .from(BUCKET)
        .createSignedUploadUrl(path);
      if (se || !signed) return json({ error: se?.message ?? 'Could not create upload URL' }, 500);
      return json({ file_id: fileId, path, token: signed.token, signed_url: signed.signedUrl });
    }

    if (action === 'commit') {
      const path = String(body.path ?? '');
      const fileId = String(body.file_id ?? crypto.randomUUID());
      const fileName = String(body.file_name ?? '');
      const fileSize = Number(body.file_size ?? 0);
      const mimeType = String(body.mime_type ?? 'application/octet-stream');
      if (!path || !fileName) return json({ error: 'path and file_name required' }, 400);
      if (!path.startsWith(`${product.seller_id}/${productId}/`)) {
        return json({ error: 'Invalid storage path for this product' }, 400);
      }

      // Confirm the object really exists before recording it.
      const { data: signedCheck, error: ce } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(path, 60);
      if (ce || !signedCheck) return json({ error: `Uploaded file not found in storage: ${ce?.message ?? 'missing'}` }, 400);

      const { data: row, error: ie } = await admin
        .from('dkai_product_files')
        .insert({
          id: fileId,
          product_id: productId,
          file_path: path,
          file_name: fileName,
          file_size: fileSize,
          mime_type: mimeType,
          scan_status: 'clean',
          uploaded_by: userId,
        })
        .select('id, file_name, file_size, file_path, mime_type, scan_status, created_at')
        .single();
      if (ie || !row) {
        await admin.storage.from(BUCKET).remove([path]);
        return json({ error: `File record save failed: ${ie?.message ?? 'no row returned'}` }, 500);
      }

      const { error: upe } = await admin
        .from('dkai_products')
        .update({
          file_storage_key: path,
          file_size_bytes: fileSize,
          file_scan_status: 'clean',
        })
        .eq('id', productId);
      if (upe) {
        await admin.from('dkai_product_files').delete().eq('id', fileId);
        await admin.storage.from(BUCKET).remove([path]);
        return json({ error: `Product metadata save failed: ${upe.message}` }, 500);
      }

      return json({ ok: true, file: row });
    }

    if (action === 'delete') {
      const fileId = String(body.file_id ?? '');
      if (!fileId) return json({ error: 'file_id required' }, 400);
      const { data: file } = await admin
        .from('dkai_product_files')
        .select('id, file_path')
        .eq('id', fileId)
        .eq('product_id', productId)
        .maybeSingle();
      if (!file) return json({ error: 'File not found' }, 404);

      await admin.from('dkai_product_files').delete().eq('id', fileId);
      await admin.storage.from(BUCKET).remove([file.file_path]);

      const { data: remaining } = await admin
        .from('dkai_product_files')
        .select('file_path, file_size')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(1);
      const next = remaining?.[0];
      await admin
        .from('dkai_products')
        .update({
          file_storage_key: next?.file_path ?? null,
          file_size_bytes: next?.file_size ?? null,
          file_scan_status: next ? 'clean' : null,
        })
        .eq('id', productId);

      return json({ ok: true });
    }

    if (action === 'resubmit') {
      if (!isOwner && !isAdmin) return json({ error: 'Forbidden' }, 403);
      const { count } = await admin
        .from('dkai_product_files')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', productId)
        .eq('scan_status', 'clean');
      if ((count ?? 0) === 0) {
        return json({ error: 'Upload at least one clean delivery file before resubmitting.' }, 400);
      }

      const { error: re } = await admin
        .from('dkai_products')
        .update({
          review_status: REVIEW_STATUS.SUBMITTED,
          submitted_at: new Date().toISOString(),
          review_notes: null,
          status: 'pending',
          moderation_status: 'pending',
          approval_status: 'pending',
          is_published: false,
        })
        .eq('id', productId);
      if (re) return json({ error: re.message }, 500);

      try {
        await admin.functions.invoke('send-notification-email', {
          body: {
            type: 'product_submitted_for_review',
            recipientEmail: u.user.email,
            data: { productTitle: product.title, productId, resubmission: true },
          },
          headers: { Authorization: `Bearer ${SERVICE}` },
        });
      } catch (e) {
        console.warn('notification failed (non-blocking)', e);
      }

      return json({ ok: true, review_status: REVIEW_STATUS.SUBMITTED });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
