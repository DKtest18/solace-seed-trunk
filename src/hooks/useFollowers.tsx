import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useFollowers(userId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: isBlocked } = useQuery({
    queryKey: ['is-blocked-follow', user?.id, userId],
    queryFn: async () => {
      if (!user || !userId) return false;
      const { data } = await db
        .from('dkai_user_blocks')
        .select('id')
        .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${userId}),and(blocker_id.eq.${userId},blocked_id.eq.${user.id})`);
      return (data && data.length > 0) || false;
    },
    enabled: !!user && !!userId,
  });

  const { data: isFollowing, isLoading } = useQuery({
    queryKey: ['is-following', user?.id, userId],
    queryFn: async () => {
      if (!user || !userId) return false;
      const { data } = await db
        .from('dkai_user_followers')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .single();
      return !!data;
    },
    enabled: !!user && !!userId,
  });

  const { data: followersCount } = useQuery({
    queryKey: ['followers-count', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { count } = await db
        .from('dkai_user_followers')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId);
      return count || 0;
    },
    enabled: !!userId,
  });

  const { data: followingCount } = useQuery({
    queryKey: ['following-count', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { count } = await db
        .from('dkai_user_followers')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId);
      return count || 0;
    },
    enabled: !!userId,
  });

  const toggleFollow = useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!user) throw new Error('Please log in to follow users');
      if (isBlocked) throw new Error('Cannot follow this user');

      if (isFollowing) {
        const { error } = await db
          .from('dkai_user_followers')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId);
        if (error) throw error;
        return false;
      } else {
        const { error } = await db
          .from('dkai_user_followers')
          .insert({ follower_id: user.id, following_id: targetUserId });
        if (error) throw error;
        return true;
      }
    },
    onSuccess: (followed) => {
      queryClient.invalidateQueries({ queryKey: ['is-following'] });
      queryClient.invalidateQueries({ queryKey: ['followers-count'] });
      queryClient.invalidateQueries({ queryKey: ['following-count'] });
      toast.success(followed ? 'Followed successfully' : 'Unfollowed successfully');
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  return {
    isFollowing: isFollowing || false,
    isLoading,
    isBlocked: isBlocked || false,
    followersCount: followersCount || 0,
    followingCount: followingCount || 0,
    toggleFollow: toggleFollow.mutate,
  };
}
