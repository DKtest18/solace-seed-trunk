import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { productId, orderId } = await req.json();
    const admin = getServiceClient();

    // Verify buyer purchased the product
    const { data: order } = await admin
      .from('dkai_orders')
      .select('*')
      .eq('id', orderId)
      .eq('buyer_id', user.id)
      .eq('product_id', productId)
      .in('status', ['completed', 'delivered'])
      .single();

    if (!order) return errorResponse('Purchase not found or not eligible for download', 403);

    // Get delivery files
    const { data: files } = await admin
      .from('dkai_product_delivery_files')
      .select('storage_path, file_name')
      .eq('product_id', productId);

    if (!files || files.length === 0) return errorResponse('No files available', 404);

    // Generate signed URLs for all files
    const signedUrls = await Promise.all(
      files.map(async (file) => {
        const { data } = await admin.storage
          .from('product-files')
          .createSignedUrl(file.storage_path, 3600); // 1 hour
        return { fileName: file.file_name, url: data?.signedUrl };
      })
    );

    return jsonResponse({ success: true, files: signedUrls });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
