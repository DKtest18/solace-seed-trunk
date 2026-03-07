import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';

export function useBlockedCheck(targetUserId?: string) {
  const { user } = useAuth();

  const { data: blockStatus, isLoading } = useQuery({
    queryKey: ['block-status', user?.id, targetUserId],
    queryFn: async () => {
      if (!user || !targetUserId || user.id === targetUserId) {
        return { isBlocked: false, blockedByMe: false, blockedByThem: false };
      }
      const { data: myBlocks } = await db
        .from('dkai_user_blocks')
        .select('id')
        .eq('blocker_id', user.id)
        .eq('blocked_id', targetUserId);
      const { data: theirBlocks } = await db
        .from('dkai_user_blocks')
        .select('id')
        .eq('blocker_id', targetUserId)
        .eq('blocked_id', user.id);
      const blockedByMe = (myBlocks && myBlocks.length > 0) || false;
      const blockedByThem = (theirBlocks && theirBlocks.length > 0) || false;
      return { isBlocked: blockedByMe || blockedByThem, blockedByMe, blockedByThem };
    },
    enabled: !!user && !!targetUserId,
  });

  return {
    isBlocked: blockStatus?.isBlocked || false,
    blockedByMe: blockStatus?.blockedByMe || false,
    blockedByThem: blockStatus?.blockedByThem || false,
    isLoading,
  };
}

export function useCanMessage(targetUserId?: string) {
  const { user } = useAuth();
  const { isBlocked, isLoading: blockLoading } = useBlockedCheck(targetUserId);
  return {
    canMessage: !isBlocked && !!user && user.id !== targetUserId,
    isBlocked,
    isLoading: blockLoading,
  };
}
