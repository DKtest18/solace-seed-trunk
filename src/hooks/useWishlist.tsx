import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useWishlist(productId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: isInWishlist, isLoading } = useQuery({
    queryKey: ['wishlist-status', user?.id, productId],
    queryFn: async () => {
      if (!user || !productId) return false;
      
      const { data, error } = await supabase
        .from('dkai_wishlists')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return !!data;
    },
    enabled: !!user && !!productId,
  });

  const toggleWishlist = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) throw new Error('Please log in to add to wishlist');

      if (isInWishlist) {
        const { error } = await supabase
          .from('wishlists')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', productId);

        if (error) throw error;
        return false;
      } else {
        const { error } = await supabase
          .from('wishlists')
          .insert({
            user_id: user.id,
            product_id: productId,
          });

        if (error) throw error;
        return true;
      }
    },
    onSuccess: (added) => {
      queryClient.invalidateQueries({ queryKey: ['wishlist-status'] });
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      toast.success(added ? 'Added to wishlist' : 'Removed from wishlist');
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  return {
    isInWishlist: isInWishlist || false,
    isLoading,
    toggleWishlist: toggleWishlist.mutate,
  };
}
