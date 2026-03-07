import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { disputeId, resolution, refundBuyer, penalizeSeller, penaltyAmount, notes } = await req.json();
    const admin = getServiceClient();

    // Verify admin
    const { data: roleData } = await admin
      .from('dkai_user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) return errorResponse('Admin access required', 403);

    await admin.from('dkai_disputes').update({
      status: 'resolved',
      resolution,
      resolution_notes: notes,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    }).eq('id', disputeId);

    // Handle refund if needed
    if (refundBuyer) {
      const { data: dispute } = await admin.from('dkai_disputes').select('order_id').eq('id', disputeId).single();
      if (dispute?.order_id) {
        await admin.from('dkai_orders').update({
          escrow_status: 'refunded',
          status: 'refunded',
        }).eq('id', dispute.order_id);
      }
    }

    return jsonResponse({ success: true, resolution });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
