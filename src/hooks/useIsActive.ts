import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';

/**
 * Returns whether the current user has been activated (approved off the
 * pre-launch waitlist). Admins always count as active.
 * Cached for 5 min to avoid re-querying on every route change.
 */
export function useIsActive() {
  const { user, loading: authLoading } = useAuth();
  const { hasRole: isAdmin, isLoading: roleLoading } = useHasRole('admin');

  const query = useQuery({
    queryKey: ['profile-is-active', user?.id],
    enabled: !!user && !authLoading,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await db
        .from('dkai_profiles')
        .select('is_active')
        .eq('id', user.id)
        .maybeSingle();
      if (error) {
        // Fail open for logged-in users to avoid lockouts on transient errors.
        return true;
      }
      return Boolean((data as any)?.is_active);
    },
  });

  return {
    isActive: isAdmin || query.data === true,
    isAdmin,
    isLoading: authLoading || roleLoading || query.isLoading,
  };
}
