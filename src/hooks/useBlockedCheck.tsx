import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to check if the current user has blocked another user or vice versa
 */
export function useBlockedCheck(targetUserId?: string) {
  const { user } = useAuth();

  const { data: blockStatus, isLoading } = useQuery({
    queryKey: ['block-status', user?.id, targetUserId],
    queryFn: async () => {
      if (!user || !targetUserId || user.id === targetUserId) {
        return { isBlocked: false, blockedByMe: false, blockedByThem: false };
      }

      // Check if I blocked them
      const { data: myBlocks } = await supabase
        .from('dkai_user_blocks')
        .select('id')
        .eq('blocker_id', user.id)
        .eq('blocked_id', targetUserId);

      // Check if they blocked me
      const { data: theirBlocks } = await supabase
        .from('dkai_user_blocks')
        .select('id')
        .eq('blocker_id', targetUserId)
        .eq('blocked_id', user.id);

      const blockedByMe = (myBlocks && myBlocks.length > 0) || false;
      const blockedByThem = (theirBlocks && theirBlocks.length > 0) || false;

      return {
        isBlocked: blockedByMe || blockedByThem,
        blockedByMe,
        blockedByThem,
      };
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

/**
 * Check if messaging is allowed between current user and target user
 */
export function useCanMessage(targetUserId?: string) {
  const { user } = useAuth();
  const { isBlocked, isLoading: blockLoading } = useBlockedCheck(targetUserId);

  return {
    canMessage: !isBlocked && !!user && user.id !== targetUserId,
    isBlocked,
    isLoading: blockLoading,
  };
}
