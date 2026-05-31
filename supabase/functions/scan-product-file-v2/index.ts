import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/auth.ts';

const BUCKET = 'product-files';
const MAX_SIZE = 500 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'application/zip','application/x-zip-compressed','application/pdf','application/json',
  'application/octet-stream','application/x-yaml','text/yaml',
  'text/plain','text/csv','text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm',
]);

const DANGEROUS_EXT = new Set(['exe','dll','bat','cmd','com','msi','scr','vbs','js','jse','ws','wsf','ps1','sh','jar','app','apk','deb','rpm','pkg','dmg','reg','hta']);

// Service-role-only function. JWT verification is skipped because it's invoked
// internally by upload-product-file with the service role key.
Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const auth = req.headers.get('Authorization') ?? '';
  const expected = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;
  if (auth !== expected) return errorResponse('Forbidden', 403);

  try {
    const { file_id } = await req.json();
    if (!file_id) return errorResponse('file_id required', 400);

    const admin = getServiceClient();
    const { data: file, error: fErr } = await admin
      .from('dkai_product_files')
      .select('*')
      .eq('id', file_id)
      .single();
    if (fErr || !file) return errorResponse('File not found', 404);

    const fail = async (status: 'infected' | 'failed', reason: string) => {
      if (status === 'infected') {
        await admin.storage.from(BUCKET).remove([file.file_path]);
      }
      await admin.from('dkai_product_files').update({
        scan_status: status,
        scan_completed_at: new Date().toISOString(),
      }).eq('id', file_id);
      return jsonResponse({ scan_status: status, reason });
    };

    // Path traversal check
    if (file.file_path.includes('..')) return await fail('infected', 'Path traversal');

    const ext = file.file_name.split('.').pop()?.toLowerCase() ?? '';
    if (DANGEROUS_EXT.has(ext)) return await fail('infected', `Disallowed extension .${ext}`);
    if (!ALLOWED_MIME.has(file.mime_type)) return await fail('infected', 'Disallowed mime');
    if (file.file_size > MAX_SIZE) return await fail('infected', 'Oversize');

    // Verify stored object size
    const folder = file.file_path.slice(0, file.file_path.lastIndexOf('/'));
    const name = file.file_path.slice(file.file_path.lastIndexOf('/') + 1);
    const { data: listed } = await admin.storage.from(BUCKET).list(folder, { search: name });
    const obj = listed?.find(o => o.name === name);
    if (!obj) return await fail('failed', 'Object not found in storage');
    const actualSize = Number(obj.metadata?.size ?? 0);
    if (actualSize !== file.file_size) return await fail('infected', 'Size mismatch');

    await admin.from('dkai_product_files').update({
      scan_status: 'clean',
      scan_completed_at: new Date().toISOString(),
    }).eq('id', file_id);

    return jsonResponse({ scan_status: 'clean' });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
