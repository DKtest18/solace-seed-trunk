import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useSpamMessages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: spamMessages = [], isLoading } = useQuery({
    queryKey: ['spam-messages', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await db
        .from('dkai_spam_messages')
        .select(`
          *,
          sender:dkai_profiles!dkai_spam_messages_sender_id_fkey (
            id,
            full_name,
            username,
            avatar_url
          )
        `)
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const deleteSpamMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await db.from('dkai_spam_messages').delete().eq('id', messageId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['spam-messages'] }); toast.success('Message deleted'); },
  });

  const moveToInbox = useMutation({
    mutationFn: async (spamMessage: any) => {
      const { error: insertError } = await db
        .from('dkai_messages')
        .insert({ sender_id: spamMessage.sender_id, recipient_id: spamMessage.recipient_id, content: spamMessage.content, created_at: spamMessage.created_at });
      if (insertError) throw insertError;
      const { error: deleteError } = await db.from('dkai_spam_messages').delete().eq('id', spamMessage.id);
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spam-messages'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Message moved to inbox');
    },
  });

  const unreadCount = spamMessages.filter((m: any) => !m.is_read).length;

  return {
    spamMessages, isLoading, unreadCount,
    deleteSpamMessage: deleteSpamMessage.mutate,
    moveToInbox: moveToInbox.mutate,
    isDeleting: deleteSpamMessage.isPending,
    isMoving: moveToInbox.isPending,
  };
}
