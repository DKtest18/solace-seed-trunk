import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { meeting_id, format } = await req.json();
    const admin = getServiceClient();

    // Verify participant
    const { data: participant } = await admin
      .from('meeting_participants')
      .select('role')
      .eq('meeting_id', meeting_id)
      .eq('user_id', user.id)
      .single();

    if (!participant) return errorResponse('Not a meeting participant', 403);

    // Get meeting data
    const { data: meeting } = await admin
      .from('meetings')
      .select('*')
      .eq('id', meeting_id)
      .single();

    if (!meeting) return errorResponse('Meeting not found', 404);

    // Get participants
    const { data: participants } = await admin
      .from('meeting_participants')
      .select('*, dkai_profiles(username, full_name)')
      .eq('meeting_id', meeting_id);

    const exportData = {
      meeting,
      participants,
      exported_at: new Date().toISOString(),
      exported_by: user.id,
    };

    if (format === 'json') {
      return new Response(JSON.stringify(exportData, null, 2), {
        headers: {
          ...Object.fromEntries(Object.entries({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          })),
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="meeting-${meeting_id}.json"`,
        },
      });
    }

    return jsonResponse(exportData);
  } catch (err: unknown) {
    return errorResponse(err instanceof Error ? err instanceof Error ? err.message : String(err) : String(err)), 500);
  }
});
