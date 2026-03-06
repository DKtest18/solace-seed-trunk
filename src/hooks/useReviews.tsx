import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useStrictModeration } from '@/hooks/useStrictModeration';

export function useProductReviews(productId: string) {
  return useQuery({
    queryKey: ['reviews', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dkai_reviews')
        .select(`
          *,
          dkai_profiles:user_id (
            full_name,
            avatar_url
          )
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useProductRating(productId: string) {
  return useQuery({
    queryKey: ['product-rating', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dkai_reviews')
        .select('rating')
        .eq('product_id', productId);

      if (error) throw error;

      if (!data || data.length === 0) {
        return { average: 0, count: 0 };
      }

      const sum = data.reduce((acc, review) => acc + review.rating, 0);
      const average = sum / data.length;

      return {
        average: Math.round(average * 10) / 10,
        count: data.length,
      };
    },
  });
}

export function useCreateReview() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { showProfanityError } = useStrictModeration();

  return useMutation({
    mutationFn: async ({
      productId,
      rating,
      comment,
    }: {
      productId: string;
      rating: number;
      comment: string;
    }) => {
      if (!user) throw new Error('User not authenticated');

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) throw new Error('No session token');

      const response = await supabase.functions.invoke('create-review', {
        body: { product_id: productId, rating, comment },
      });

      if (response.error) {
        const errorData = response.error as { code?: string; error?: string; detected_language?: string };
        if (errorData.code === 'PROFANITY_DETECTED') {
          showProfanityError(errorData);
          throw new Error(errorData.error || 'Profanity detected');
        }
        throw new Error(typeof response.error === 'string' ? response.error : response.error.message || 'Failed to create review');
      }

      return response.data?.review;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reviews', variables.productId] });
      queryClient.invalidateQueries({ queryKey: ['product-rating', variables.productId] });
    },
  });
}

export function useHasPurchased(productId: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['has-purchased', productId, user?.id],
    queryFn: async () => {
      if (!user) return false;

      const { data, error } = await supabase
        .from('dkai_purchases')
        .select('id')
        .eq('product_id', productId)
        .eq('buyer_id', user.id)
        .eq('status', 'completed')
        .limit(1);

      if (error) throw error;
      return data && data.length > 0;
    },
    enabled: !!user,
  });
}
