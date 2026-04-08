import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { meeting_id, asset_type } = await req.json();
    const admin = getServiceClient();

    // Verify participant
    const { data: participant } = await admin
      .from('meeting_participants')
      .select('role')
      .eq('meeting_id', meeting_id)
      .eq('user_id', user.id)
      .single();

    if (!participant) return errorResponse('Not a meeting participant', 403);

    // Get asset from storage
    const { data: asset } = await admin
      .from('meeting_assets')
      .select('storage_path')
      .eq('meeting_id', meeting_id)
      .eq('asset_type', asset_type)
      .single();

    if (!asset) return errorResponse('Asset not found', 404);

    const { data: signedUrl } = await admin.storage
      .from('meeting-assets')
      .createSignedUrl(asset.storage_path, 3600);

    return jsonResponse({ url: signedUrl?.signedUrl });
  } catch (err: unknown) {
    return errorResponse(err instanceof Error ? err instanceof Error ? err.message : String(err) : String(err)), 500);
  }
});
