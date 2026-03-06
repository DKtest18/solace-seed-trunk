import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useAchievements() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['achievements', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('dkai_achievements')
        .select('*')
        .eq('user_id', user.id)
        .order('earned_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useUserAchievementsCount(userId?: string) {
  return useQuery({
    queryKey: ['achievements-count', userId],
    queryFn: async () => {
      if (!userId) return 0;
      
      const { count } = await supabase
        .from('dkai_achievements')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      return count || 0;
    },
    enabled: !!userId,
  });
}
