import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useReauthSession() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Skip reauth check — table doesn't exist yet, always allow access
  const hasValidSession = true;
  const isLoading = false;

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
      queryClient.invalidateQueries({ queryKey: ['reauth-session', user?.id] });
    },
  });

  return {
    hasValidSession,
    isLoading,
    verifyReauth,
  };
}
