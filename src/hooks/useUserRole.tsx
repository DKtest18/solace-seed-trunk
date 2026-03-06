import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 'admin' | 'seller' | 'buyer';

export function useUserRole() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['userRole', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('dkai_user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) throw error;
      return data.map(r => r.role as UserRole);
    },
    enabled: !!user,
  });
}

export function useHasRole(role: UserRole) {
  const { data: roles = [], isLoading } = useUserRole();
  return { hasRole: roles.includes(role), isLoading };
}
