import { Button } from '@/components/ui/button';
import { useFollowers } from '@/hooks/useFollowers';
import { UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface FollowButtonProps {
  userId: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function FollowButton({ userId, variant = 'default', size = 'default' }: FollowButtonProps) {
  const { user } = useAuth();
  const { isFollowing, isLoading, isBlocked, toggleFollow } = useFollowers(userId);

  // Don't show for own profile, unauthenticated users, or blocked users
  if (!user || user.id === userId || isBlocked) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFollow(userId);
  };

  return (
    <Button
      variant={isFollowing ? 'outline' : variant}
      size={size}
      onClick={handleClick}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isFollowing ? (
        <>
          <UserMinus className="w-4 h-4 mr-2" />
          Unfollow
        </>
      ) : (
        <>
          <UserPlus className="w-4 h-4 mr-2" />
          Follow
        </>
      )}
    </Button>
  );
}
