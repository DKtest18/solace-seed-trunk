import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';

export function useBlockEnforcement(targetUserId?: string) {
  const { user } = useAuth();

  const { data: isBlocked = false, isLoading } = useQuery({
    queryKey: ['block-enforcement', user?.id, targetUserId],
    queryFn: async () => {
      if (!user || !targetUserId || user.id === targetUserId) return false;
      const { data: blocks, error } = await db
        .from('dkai_user_blocks')
        .select('id')
        .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${targetUserId}),and(blocker_id.eq.${targetUserId},blocked_id.eq.${user.id})`);
      if (error) { console.error('Error checking block status:', error); return false; }
      return blocks && blocks.length > 0;
    },
    enabled: !!user && !!targetUserId && user.id !== targetUserId,
    staleTime: 30000,
  });

  return { isBlocked, isLoading };
}

export function useBlockedUserIds() {
  const { user } = useAuth();

  const { data: blockedIds = [], isLoading } = useQuery({
    queryKey: ['blocked-user-ids', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: blocks, error } = await db
        .from('dkai_user_blocks')
        .select('blocker_id, blocked_id')
        .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
      if (error) { console.error('Error fetching blocked user IDs:', error); return []; }
      const ids = new Set<string>();
      blocks?.forEach((block: any) => {
        if (block.blocker_id === user.id) ids.add(block.blocked_id);
        else ids.add(block.blocker_id);
      });
      return Array.from(ids);
    },
    enabled: !!user,
    staleTime: 30000,
  });

  return { blockedIds, isLoading };
}
