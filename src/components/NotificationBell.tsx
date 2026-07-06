import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '@/lib/dkaiDb';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

/**
 * In-app notifications bell. Reads from `dkai_notifications` (RLS-scoped to the
 * current user) and subscribes to realtime INSERTs so new notifications land
 * without a page reload. Click an item to navigate + mark read.
 */
export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);

  const unreadCount = items.filter((n) => !n.read_at).length;

  // Initial load + realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const { data, error } = await db
        .from('dkai_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (!cancelled) {
        if (error) console.warn('notifications load failed', error);
        setItems((data as NotificationRow[]) ?? []);
        setLoading(false);
      }
    };
    load();

    // Unique topic per mount avoids Supabase returning an already-subscribed
    // channel on StrictMode re-mount (which would throw "cannot add
    // postgres_changes callbacks ... after subscribe()").
    const topic = `notif:${user.id}:${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase.channel(topic);
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'dkai_notifications',
        filter: `user_id=eq.${user.id}`,
      },
      (payload) => {
        const row = payload.new as NotificationRow;
        setItems((prev) => [row, ...prev].slice(0, 30));
        if (row.title) toast(row.title, { description: row.body ?? undefined });
      }
    );
    channel.subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const markRead = async (id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
    await db.from('dkai_notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  };

  const markAllRead = async () => {
    if (!user?.id || unreadCount === 0) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
    await db
      .from('dkai_notifications')
      .update({ read_at: now })
      .eq('user_id', user.id)
      .is('read_at', null);
  };

  const handleClick = async (n: NotificationRow) => {
    if (!n.read_at) await markRead(n.id);
    if (n.link_url) {
      setOpen(false);
      if (n.link_url.startsWith('http')) {
        window.location.href = n.link_url;
      } else {
        navigate(n.link_url);
      }
    }
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div className="font-semibold">Notifications</div>
          {unreadCount > 0 && (
            <Button variant="link" size="sm" className="h-auto p-0" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {loading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
          {!loading && items.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              You're all caught up.
            </div>
          )}
          <ul className="divide-y">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors ${
                    !n.read_at ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read_at && (
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{n.title}</p>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {n.type}
                        </Badge>
                      </div>
                      {n.body && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {n.body}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
