import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useUserBlocks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: blockedUsers = [], isLoading } = useQuery({
    queryKey: ['blocked-users', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await db
        .from('dkai_user_blocks')
        .select(`
          id,
          blocked_id,
          created_at,
          blocked:dkai_profiles!dkai_user_blocks_blocked_id_fkey (
            id,
            full_name,
            username,
            avatar_url
          )
        `)
        .eq('blocker_id', user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: blockedByUsers = [] } = useQuery({
    queryKey: ['blocked-by-users', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await db
        .from('dkai_user_blocks')
        .select('blocker_id')
        .eq('blocked_id', user.id);
      if (error) throw error;
      return data?.map((d: any) => d.blocker_id) || [];
    },
    enabled: !!user,
  });

  const blockUser = useMutation({
    mutationFn: async (blockedId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { data: existing } = await db
        .from('dkai_user_blocks')
        .select('id')
        .eq('blocker_id', user.id)
        .eq('blocked_id', blockedId)
        .maybeSingle();
      if (existing) return { status: 'already_blocked' };
      const { error } = await db
        .from('dkai_user_blocks')
        .insert({ blocker_id: user.id, blocked_id: blockedId });
      if (error) throw error;
      return { status: 'blocked' };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
      queryClient.invalidateQueries({ queryKey: ['blocked-by-users'] });
      queryClient.invalidateQueries({ queryKey: ['is-blocked-follow'] });
      queryClient.invalidateQueries({ queryKey: ['block-status'] });
      toast.success('User blocked');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to block user');
    },
  });

  const unblockUser = useMutation({
    mutationFn: async (blockedId: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await db
        .from('dkai_user_blocks')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', blockedId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
      queryClient.invalidateQueries({ queryKey: ['blocked-by-users'] });
      queryClient.invalidateQueries({ queryKey: ['is-blocked-follow'] });
      queryClient.invalidateQueries({ queryKey: ['block-status'] });
      toast.success('User unblocked');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to unblock user');
    },
  });

  const isBlocked = (userId: string) => blockedUsers.some((b: any) => b.blocked_id === userId);
  const isBlockedByUser = (userId: string) => blockedByUsers.includes(userId);
  const hasBlockRelationship = (userId: string) => isBlocked(userId) || isBlockedByUser(userId);

  return {
    blockedUsers,
    blockedByUsers,
    isLoading,
    blockUser: blockUser.mutate,
    unblockUser: unblockUser.mutate,
    isBlocked,
    isBlockedByUser,
    hasBlockRelationship,
    isBlocking: blockUser.isPending,
    isUnblocking: unblockUser.isPending,
  };
}
