import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useBuyerPolicy() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: hasAccepted, isLoading } = useQuery({
    queryKey: ['buyer-policy-accepted', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      // Use raw query since types may not be updated yet
      const { data, error } = await (supabase
        .from('dkai_buyer_policy_acceptances' as any)
        .select('id')
        .eq('user_id', user.id)
        .eq('policy_version', 1)
        .maybeSingle() as any);

      if (error) {
        console.error('Error checking buyer policy:', error);
        return false;
      }
      
      return !!data;
    },
    enabled: !!user?.id,
  });

  const acceptPolicy = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await (supabase
        .from('buyer_policy_acceptances' as any)
        .insert({
          user_id: user.id,
          policy_version: 1,
        }) as any);

      if (error && error.code !== '23505') { // Ignore duplicate key error
        throw error;
      }
      
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-policy-accepted', user?.id] });
    },
  });

  return {
    hasAccepted: !!hasAccepted,
    isLoading,
    acceptPolicy: acceptPolicy.mutateAsync,
    isAccepting: acceptPolicy.isPending,
  };
}