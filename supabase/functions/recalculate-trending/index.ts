import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const admin = getServiceClient();

    // Verify admin
    const { data: roleData } = await admin
      .from('dkai_user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) return errorResponse('Admin access required', 403);

    // Recalculate trending scores
    const { data: products } = await admin
      .from('dkai_products')
      .select('id, view_count, review_count, average_rating, created_at');

    if (products) {
      for (const product of products) {
        const daysSinceCreation = Math.max(1, (Date.now() - new Date(product.created_at).getTime()) / (1000 * 60 * 60 * 24));
        const trendingScore = (
          (product.view_count || 0) * 0.3 +
          (product.review_count || 0) * 10 +
          (product.average_rating || 0) * 5
        ) / Math.sqrt(daysSinceCreation);

        await admin.from('dkai_products').update({
          trending_score: trendingScore,
        }).eq('id', product.id);
      }
    }

    return jsonResponse({ success: true, updated: products?.length || 0 });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
