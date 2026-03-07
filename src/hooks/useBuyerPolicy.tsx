import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';

export function useBuyerPolicy() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: hasAccepted, isLoading } = useQuery({
    queryKey: ['buyer-policy-accepted', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await db.from('dkai_buyer_policy_acceptances').select('id').eq('user_id', user.id).eq('policy_version', 1).maybeSingle();
      if (error) { console.error('Error checking buyer policy:', error); return false; }
      return !!data;
    },
    enabled: !!user?.id,
  });

  const acceptPolicy = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      const { error } = await db.from('dkai_buyer_policy_acceptances').insert({ user_id: user.id, policy_version: 1 });
      if (error && error.code !== '23505') throw error;
      return true;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['buyer-policy-accepted', user?.id] }); },
  });

  return {
    hasAccepted: !!hasAccepted, isLoading,
    acceptPolicy: acceptPolicy.mutateAsync,
    isAccepting: acceptPolicy.isPending,
  };
}
