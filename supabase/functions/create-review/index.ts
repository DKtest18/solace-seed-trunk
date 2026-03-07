import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { product_id, rating, comment } = await req.json();
    if (!product_id || !rating) return errorResponse('product_id and rating required');

    const admin = getServiceClient();

    // Check if user purchased the product
    const { data: order } = await admin
      .from('dkai_orders')
      .select('id')
      .eq('buyer_id', user.id)
      .eq('product_id', product_id)
      .in('status', ['completed', 'delivered'])
      .limit(1)
      .single();

    if (!order) return errorResponse('You must purchase this product before reviewing');

    // Check for existing review
    const { data: existing } = await admin
      .from('dkai_reviews')
      .select('id')
      .eq('user_id', user.id)
      .eq('product_id', product_id)
      .single();

    if (existing) return errorResponse('You already reviewed this product');

    const { data: review, error: reviewError } = await admin
      .from('dkai_reviews')
      .insert({
        user_id: user.id,
        product_id,
        rating,
        comment: comment || null,
      })
      .select()
      .single();

    if (reviewError) throw reviewError;

    // Update product average rating
    const { data: reviews } = await admin
      .from('dkai_reviews')
      .select('rating')
      .eq('product_id', product_id);

    if (reviews && reviews.length > 0) {
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      await admin.from('dkai_products').update({
        average_rating: avgRating,
        review_count: reviews.length,
      }).eq('id', product_id);
    }

    return jsonResponse({ success: true, review });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
