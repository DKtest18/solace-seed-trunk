import { useEffect, useState } from 'react';
import { db } from '@/lib/dkaiDb';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/**
 * Subscribes to the canonical dkai_notifications table (same source as the
 * NotificationBell) so unread counts stay consistent everywhere.
 */
export function useRealtimeNotifications() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const loadUnreadCount = async () => {
      const { count } = await db
        .from('dkai_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null);
      setUnreadCount(count || 0);
    };
    loadUnreadCount();

    const topic = `user-notifications:${user.id}:${Math.random().toString(36).slice(2, 10)}`;
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
        const n = payload.new as any;
        toast(n.title, { description: n.body ?? undefined });
        setUnreadCount((prev) => prev + 1);
      }
    );
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    const { error } = await db
      .from('dkai_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);
    if (!error) setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const { error } = await db
      .from('dkai_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null);
    if (!error) setUnreadCount(0);
  };

  return { unreadCount, markAsRead, markAllAsRead };
}
