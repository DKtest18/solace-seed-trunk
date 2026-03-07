import { useEffect, useState } from 'react';
import { db } from '@/lib/dkaiDb';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useRealtimeNotifications() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    // Load initial unread count
    const loadUnreadCount = async () => {
      const { count } = await db
        .from('dkai_in_app_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setUnreadCount(count || 0);
    };

    loadUnreadCount();

    // Subscribe to new notifications
    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dkai_in_app_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as any;
          
          toast.info(notification.title, {
            description: notification.message,
          });

          setUnreadCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    const { error } = await db
      .from('dkai_in_app_notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (!error) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    const { error } = await db
      .from('dkai_in_app_notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (!error) {
      setUnreadCount(0);
    }
  };

  return {
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}
