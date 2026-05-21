import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

const BUCKET = 'product-files';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// Allowlisted content types for downloadable product files.
const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/epub+zip',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'video/mp4',
  'audio/mpeg',
  'text/plain',
  'text/markdown',
  'text/csv',
]);

// Executable / script extensions that must never be served as product files.
const DANGEROUS_EXT = new Set([
  'exe', 'dll', 'bat', 'cmd', 'com', 'msi', 'scr', 'vbs', 'js', 'jse',
  'ws', 'wsf', 'ps1', 'sh', 'jar', 'app', 'apk', 'deb', 'rpm', 'pkg',
  'dmg', 'reg', 'hta', 'cpl', 'gadget',
]);

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { filePath, fileName } = await req.json();
    if (!filePath || typeof filePath !== 'string') {
      return errorResponse('filePath is required', 400);
    }

    // The uploader may only scan files inside their own {user_id}/ folder.
    if (!filePath.startsWith(`${user.id}/`)) return errorResponse('Forbidden', 403);

    const admin = getServiceClient();

    // Reject and delete the stored object, returning an "infected" verdict.
    const reject = async (reason: string) => {
      await admin.storage.from(BUCKET).remove([filePath]);
      return jsonResponse({ scanStatus: 'infected', reason });
    };

    // Inspect the object as actually stored — never trust client-reported size/type.
    const folder = filePath.slice(0, filePath.lastIndexOf('/'));
    const objectName = filePath.slice(filePath.lastIndexOf('/') + 1);
    const { data: listed, error: listErr } = await admin.storage
      .from(BUCKET)
      .list(folder, { search: objectName });
    if (listErr) throw listErr;

    const obj = listed?.find((o) => o.name === objectName);
    if (!obj) return errorResponse('File not found', 404);

    const size = Number(obj.metadata?.size ?? 0);
    if (size > MAX_FILE_SIZE) {
      return await reject(`File exceeds the ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
    }

    const ext = (fileName ?? objectName).split('.').pop()?.toLowerCase() ?? '';
    if (DANGEROUS_EXT.has(ext)) {
      return await reject(`Disallowed file type: .${ext}`);
    }

    const contentType = String(obj.metadata?.mimetype ?? '').toLowerCase();
    if (!contentType || !ALLOWED_MIME.has(contentType)) {
      return await reject(`Disallowed content type: ${contentType || 'unknown'}`);
    }

    return jsonResponse({ scanStatus: 'clean' });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
