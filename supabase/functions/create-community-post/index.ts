import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { title, body, is_public, attachment_key, attachment_file_name, attachment_file_size, attachment_content_type } = await req.json();
    const admin = getServiceClient();

    const insertData: Record<string, unknown> = {
      title,
      body,
      is_public: is_public ?? true,
      author_id: user.id,
    };

    if (attachment_key) {
      insertData.attachment_key = attachment_key;
      insertData.attachment_file_name = attachment_file_name;
      insertData.attachment_file_size = attachment_file_size;
      insertData.attachment_content_type = attachment_content_type;
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
