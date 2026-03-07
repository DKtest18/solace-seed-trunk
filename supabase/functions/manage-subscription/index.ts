import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { subscriptionId, action } = await req.json();
    const admin = getServiceClient();

    if (action === 'cancel') {
      await admin.from('dkai_subscriptions').update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
      }).eq('id', subscriptionId).eq('buyer_id', user.id);
    } else if (action === 'pause') {
      await admin.from('dkai_subscriptions').update({
        status: 'paused',
      }).eq('id', subscriptionId).eq('buyer_id', user.id);
    } else if (action === 'resume') {
      await admin.from('dkai_subscriptions').update({
        status: 'active',
      }).eq('id', subscriptionId).eq('buyer_id', user.id);
    } else {
      return errorResponse('Invalid action');
    }

    return jsonResponse({ success: true });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
