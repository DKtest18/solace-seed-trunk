import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';

export function useUserBalance() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-balance', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await db.from('dkai_user_balances').select('*').eq('user_id', user.id).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || { user_id: user.id, available_balance: 0, held_balance: 0, currency: 'usd' };
    },
    enabled: !!user,
  });
}
