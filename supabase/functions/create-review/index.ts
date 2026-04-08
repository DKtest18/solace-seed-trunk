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

    // Send review notification email to seller (fire-and-forget)
    sendReviewNotification(admin, user.id, product_id, rating, comment);

    return jsonResponse({ success: true, review });
  } catch (err: unknown) {
    return errorResponse(err instanceof Error ? err instanceof Error ? err.message : String(err) : String(err)), 500);
  }
});

async function sendReviewNotification(
  admin: any,
  reviewerId: string,
  productId: string,
  rating: number,
  comment: string | null,
) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return;

    // Get product + seller info
    const { data: product } = await admin
      .from('dkai_products')
      .select('title, seller_id, profiles:seller_id(email)')
      .eq('id', productId)
      .single();

    if (!product?.profiles?.email) return;

    // Get reviewer name
    const { data: reviewer } = await admin
      .from('profiles')
      .select('display_name, username')
      .eq('id', reviewerId)
      .single();

    const reviewerName = reviewer?.display_name || reviewer?.username || 'A buyer';

    await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        type: 'review_received',
        recipientEmail: product.profiles.email,
        data: {
          productTitle: product.title,
          rating,
          reviewerName,
          reviewText: comment || '',
        },
      }),
    });
  } catch (e) {
    console.error('Failed to send review notification:', e);
  }
}
