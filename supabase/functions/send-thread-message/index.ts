import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { thread_id, content, attachments } = await req.json();
    if (!thread_id || !content) return errorResponse('thread_id and content required');

    const admin = getServiceClient();

    // Verify user is participant
    const { data: participant } = await admin
      .from('dkai_thread_participants')
      .select('id')
      .eq('thread_id', thread_id)
      .eq('user_id', user.id)
      .single();

    if (!participant) return errorResponse('Not a participant', 403);

    // Insert message
    const { data: message, error: msgError } = await admin
      .from('dkai_messages')
      .insert({
        thread_id,
        sender_id: user.id,
        content,
        attachments: attachments || null,
      })
      .select()
      .single();

    if (msgError) throw msgError;

    // Update thread last_message_at
    await admin.from('dkai_message_threads').update({
      last_message_at: new Date().toISOString(),
    }).eq('id', thread_id);

    return jsonResponse({ message });
  } catch (err: unknown) {
    return errorResponse(err instanceof Error ? err instanceof Error ? err.message : String(err) : String(err)), 500);
  }
});
