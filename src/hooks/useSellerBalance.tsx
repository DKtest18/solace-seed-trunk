import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useSellerBalance() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['seller-balance', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('seller_balances')
        .select('*')
        .eq('seller_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data || {
        seller_id: user.id,
        available_balance: 0,
        held_balance: 0,
        pending_balance: 0,
        currency: 'usd',
      };
    },
    enabled: !!user,
  });
}

export function useSellerLedger() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['seller-ledger', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('platform_ledger_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useSellerOrders() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['seller-orders', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          products!inner(
            seller_id,
            title,
            price
          ),
          payments(
            *
          ),
          profiles!orders_buyer_id_fkey(
            full_name,
            email
          )
        `)
        .eq('products.seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}
