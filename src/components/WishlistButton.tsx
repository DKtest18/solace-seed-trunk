import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { useWishlist } from '@/hooks/useWishlist';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface WishlistButtonProps {
  productId: string;
}

export function WishlistButton({ productId }: WishlistButtonProps) {
  const { user } = useAuth();
  const { isInWishlist, toggleWishlist } = useWishlist(productId);

  const handleClick = () => {
    if (!user) {
      toast.error('Please log in to add to wishlist');
      return;
    }
    toggleWishlist(productId);
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleClick}
      aria-label={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
      aria-pressed={isInWishlist}
      className={isInWishlist ? 'text-red-500' : ''}
    >
      <Heart className={`h-4 w-4 ${isInWishlist ? 'fill-current' : ''}`} />
    </Button>
  );
}
