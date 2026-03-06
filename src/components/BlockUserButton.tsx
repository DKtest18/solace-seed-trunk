import { Button } from '@/components/ui/button';
import { useUserBlocks } from '@/hooks/useUserBlocks';
import { Ban, UserCheck, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface BlockUserButtonProps {
  userId: string;
  userName?: string;
  variant?: 'default' | 'outline' | 'destructive' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function BlockUserButton({ userId, userName, variant = 'outline', size = 'default' }: BlockUserButtonProps) {
  const { user } = useAuth();
  const { isBlocked, blockUser, unblockUser, isBlocking, isUnblocking, isLoading } = useUserBlocks();

  // Don't show for own profile or unauthenticated users
  if (!user || user.id === userId) return null;

  const blocked = isBlocked(userId);
  const isPending = isBlocking || isUnblocking;

  const handleBlock = () => {
    blockUser(userId);
  };

  const handleUnblock = (e: React.MouseEvent) => {
    e.stopPropagation();
    unblockUser(userId);
  };

  if (isLoading) {
    return (
      <Button variant="outline" size={size} disabled>
        <Loader2 className="w-4 h-4 animate-spin" />
      </Button>
    );
  }

  if (blocked) {
    return (
      <Button
        variant="outline"
        size={size}
        onClick={handleUnblock}
        disabled={isPending}
        className="border-destructive/50 text-destructive hover:bg-destructive/10"
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <Ban className="w-4 h-4 mr-2" />
        )}
        Blocked — Click to Unblock
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          size={size}
          disabled={isPending}
          onClick={(e) => e.stopPropagation()}
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Ban className="w-4 h-4 mr-2" />
          )}
          Block
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Block {userName || 'this user'}?</AlertDialogTitle>
          <AlertDialogDescription>
            You will not receive messages or see content from them. They won't be able to message or follow you.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleBlock} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Block User
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
