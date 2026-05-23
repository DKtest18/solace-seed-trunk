import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { meeting_id, extension_minutes } = await req.json();
    if (!meeting_id) return errorResponse('meeting_id is required', 400);
    if (!Number.isInteger(extension_minutes) || extension_minutes <= 0 || extension_minutes > 240) {
      return errorResponse('extension_minutes must be a positive integer (max 240)', 400);
    }
    const admin = getServiceClient();

    // Only the meeting host may extend it.
    const { data: participant } = await admin
      .from('meeting_participants')
      .select('role')
      .eq('meeting_id', meeting_id)
      .eq('user_id', user.id)
      .single();

    if (!participant) return errorResponse('Not a meeting participant', 403);
    if (participant.role !== 'host') {
      return errorResponse('Only the meeting host can extend the meeting', 403);
    }

    // Update meeting duration
    const { data: meeting, error: meetingError } = await admin
      .from('meetings')
      .select('duration_minutes, status')
      .eq('id', meeting_id)
      .single();

    if (meetingError || !meeting) return errorResponse('Meeting not found', 404);
    if (meeting.status !== 'in_progress') return errorResponse('Meeting is not in progress');

    const newDuration = (meeting.duration_minutes || 60) + extension_minutes;

    await admin.from('meetings').update({
      duration_minutes: newDuration,
    }).eq('id', meeting_id);

    return jsonResponse({ success: true, new_duration: newDuration });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
