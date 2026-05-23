import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { disputeId, response: sellerResponse, evidence } = await req.json();
    if (!disputeId) return errorResponse('disputeId is required', 400);
    const admin = getServiceClient();

    // Verify the caller is the seller on the disputed order.
    const { data: dispute } = await admin
      .from('dkai_disputes')
      .select('id, seller_id')
      .eq('id', disputeId)
      .single();

    if (!dispute) return errorResponse('Dispute not found', 404);
    if (dispute.seller_id !== user.id) return errorResponse('Forbidden', 403);

    await admin.from('dkai_disputes').update({
      seller_response: sellerResponse,
      seller_evidence: evidence,
      status: 'under_review',
      updated_at: new Date().toISOString(),
    }).eq('id', disputeId);

    return jsonResponse({ success: true });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
