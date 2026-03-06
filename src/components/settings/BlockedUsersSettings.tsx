import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUserBlocks } from '@/hooks/useUserBlocks';
import { Ban, User, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export function BlockedUsersSettings() {
  const { blockedUsers, isLoading, unblockUser, isUnblocking } = useUserBlocks();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Ban className="h-5 w-5" />
          <CardTitle>Blocked Users</CardTitle>
        </div>
        <CardDescription>
          Manage users you have blocked. Blocked users cannot message you or see your content.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : blockedUsers.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">
            You haven't blocked any users.
          </p>
        ) : (
          <div className="space-y-3">
            {blockedUsers.map((block: any) => (
              <div
                key={block.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
              >
                <Link
                  to={`/profile/${block.blocked_id}`}
                  className="flex items-center gap-3 hover:opacity-80"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={block.blocked?.avatar_url} />
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {block.blocked?.full_name || block.blocked?.username || 'Unknown User'}
                    </p>
                    {block.blocked?.username && (
                      <p className="text-sm text-muted-foreground">@{block.blocked.username}</p>
                    )}
                  </div>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => unblockUser(block.blocked_id)}
                  disabled={isUnblocking}
                >
                  Unblock
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
