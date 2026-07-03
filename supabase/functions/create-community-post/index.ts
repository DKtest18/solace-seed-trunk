import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { title, body, is_public, attachment_key, attachment_file_name, attachment_file_size, attachment_content_type } = await req.json();

    // Input validation: enforce sensible size caps before insert.
    if (typeof title !== 'string' || title.trim().length === 0 || title.length > 200) {
      return errorResponse('title must be 1–200 characters', 400);
    }
    if (typeof body !== 'string' || body.trim().length === 0 || body.length > 20000) {
      return errorResponse('body must be 1–20000 characters', 400);
    }

    const admin = getServiceClient();

    const insertData: Record<string, unknown> = {
      title: title.trim(),
      body,
      is_public: is_public ?? true,
      author_id: user.id,
    };

    if (attachment_key) {
      insertData.attachment_key = String(attachment_key).slice(0, 500);
      insertData.attachment_file_name = attachment_file_name ? String(attachment_file_name).slice(0, 255) : null;
      insertData.attachment_file_size = typeof attachment_file_size === 'number' ? attachment_file_size : null;
      insertData.attachment_content_type = attachment_content_type ? String(attachment_content_type).slice(0, 100) : null;
    }


    const { data: post, error: postError } = await admin
      .from('dkai_community_posts')
      .insert(insertData)
      .select()
      .single();

    if (postError) throw postError;

    return jsonResponse({ success: true, post });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
