import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useReauthSession() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check if user has a valid re-auth session
  const { data: hasValidSession, isLoading } = useQuery({
    queryKey: ['reauth-session', user?.id],
    queryFn: async () => {
      if (!user) return false;

      const { data, error } = await supabase
        .from('sensitive_data_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_type', 'payout_access')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error checking reauth session:', error);
        return false;
      }

      return !!data;
    },
    enabled: !!user,
    refetchInterval: 60000, // Check every minute
  });

  // Verify credentials and create re-auth session
  const verifyReauth = useMutation({
    mutationFn: async ({ password, totpCode }: { password?: string; totpCode?: string }) => {
      const { data, error } = await supabase.functions.invoke('verify-reauth', {
        body: { password, totpCode },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Re-authentication failed');

      return data;
    },
    onSuccess: () => {
      // Invalidate the session check query to refresh
      queryClient.invalidateQueries({ queryKey: ['reauth-session', user?.id] });
    },
  });

  return {
    hasValidSession: hasValidSession ?? false,
    isLoading,
    verifyReauth,
  };
}
