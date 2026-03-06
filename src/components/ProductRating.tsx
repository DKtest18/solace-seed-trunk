import { useProductRating } from '@/hooks/useReviews';
import { RatingDisplay } from './RatingDisplay';

interface ProductRatingProps {
  productId: string;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
}

export function ProductRating({ productId, size, showCount }: ProductRatingProps) {
  const { data: rating } = useProductRating(productId);

  return (
    <RatingDisplay
      rating={rating?.average || 0}
      count={rating?.count || 0}
      size={size}
      showCount={showCount}
    />
  );
}
