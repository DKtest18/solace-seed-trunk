import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { title, body, is_public, seller_id } = await req.json();
    const admin = getServiceClient();

    const { data: post, error: postError } = await admin
      .from('dkai_community_posts')
      .insert({
        title,
        body,
        is_public: is_public ?? true,
        author_id: seller_id || user.id,
      })
      .select()
      .single();

    if (postError) throw postError;

    return jsonResponse({ success: true, post });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
