import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser, getServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) return errorResponse('Unauthorized', 401);

  try {
    const { recipient_id } = await req.json();
    if (!recipient_id) return errorResponse('recipient_id required');

    const admin = getServiceClient();

    // Check if thread already exists between these users
    const { data: existingThreads } = await admin
      .from('dkai_message_threads')
      .select('id, dkai_thread_participants!inner(user_id)')
      .eq('dkai_thread_participants.user_id', user.id);

    if (existingThreads) {
      for (const thread of existingThreads) {
        const { data: otherParticipant } = await admin
          .from('dkai_thread_participants')
          .select('user_id')
          .eq('thread_id', thread.id)
          .eq('user_id', recipient_id)
          .single();

        if (otherParticipant) {
          return jsonResponse({ thread_id: thread.id, existing: true });
        }
      }
    }

    // Create new thread
    const { data: newThread, error: threadError } = await admin
      .from('dkai_message_threads')
      .insert({ created_by: user.id })
      .select()
      .single();

    if (threadError) throw threadError;

    // Add participants
    await admin.from('dkai_thread_participants').insert([
      { thread_id: newThread.id, user_id: user.id },
      { thread_id: newThread.id, user_id: recipient_id },
    ]);

    return jsonResponse({ thread_id: newThread.id, existing: false });
  } catch (err: unknown) {
    return errorResponse(err instanceof Error ? err instanceof Error ? err.message : String(err) : String(err)), 500);
  }
});
