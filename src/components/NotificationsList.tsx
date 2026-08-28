import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Package, MessageSquare, DollarSign, Bell } from 'lucide-react';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { useNavigate } from 'react-router-dom';
import { HourglassLoader } from '@/components/HourglassLoader';

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
}

export function NotificationsList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { markAsRead, markAllAsRead } = useRealtimeNotifications();

  const { data: notifications, isLoading, refetch } = useQuery({
    queryKey: ['notifications-page', user?.id],
    queryFn: async () => {
      const { data, error } = await db
        .from('dkai_notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as NotificationRow[]) ?? [];
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'order':
      case 'sale':
        return <Package className="w-4 h-4" />;
      case 'message':
      case 'qa_question':
      case 'qa_answer':
        return <MessageSquare className="w-4 h-4" />;
      case 'payout':
        return <DollarSign className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const handleClick = async (n: NotificationRow) => {
    if (!n.read_at) await markAsRead(n.id);
    if (n.link_url) {
      if (n.link_url.startsWith('http')) window.location.href = n.link_url;
      else navigate(n.link_url);
    }
  };

  const handleMarkAll = async () => {
    await markAllAsRead();
    refetch();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <HourglassLoader size="sm" />
      </div>
    );
  }

  const unread = (notifications ?? []).filter((n) => !n.read_at);

  return (
    <div className="space-y-4">
      {unread.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">
            {unread.length} unread notification{unread.length !== 1 ? 's' : ''}
          </p>
          <Button variant="ghost" size="sm" onClick={handleMarkAll}>
            Mark all as read
          </Button>
        </div>
      )}

      <ScrollArea className="h-[500px]">
        <div className="space-y-2">
          {notifications && notifications.length > 0 ? (
            notifications.map((n) => (
              <Card
                key={n.id}
                className={`cursor-pointer hover:bg-accent transition-colors ${
                  !n.read_at ? 'border-primary/50 bg-primary/5' : ''
                }`}
                onClick={() => handleClick(n)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 ${!n.read_at ? 'text-primary' : 'text-muted-foreground'}`}>
                      {getIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm">{n.title}</p>
                        {!n.read_at && (
                          <Badge variant="default" className="shrink-0 h-2 w-2 rounded-full p-0" />
                        )}
                      </div>
                      {n.body && (
                        <p className="text-sm text-muted-foreground mt-1">{n.body}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="text-center py-12 text-muted-foreground">
                No notifications yet
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
