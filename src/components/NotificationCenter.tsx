import { useEffect, useState } from 'react';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Bell, MessageSquare, ShoppingCart, AlertCircle, Package } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: string;
  type: 'message' | 'order' | 'sale' | 'product' | 'system';
  title: string;
  description: string;
  read: boolean;
  created_at: string;
  link?: string;
}

const PAID_STATUSES = ['paid', 'completed', 'delivered', 'released'];

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function NotificationCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadNotifications();

    const messagesChannel = db
      .channel('notification-messages')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'dkai_messages',
        filter: `recipient_id=eq.${user.id}`,
      }, (payload: any) => {
        addNotification({
          id: payload.new.id, type: 'message',
          title: 'New Message', description: 'You have a new message',
          read: false, created_at: payload.new.created_at, link: '/messages',
        });
      })
      .subscribe();

    return () => { db.removeChannel(messagesChannel); };
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;
    try {
      const notifs: Notification[] = [];

      const { data: messages } = await db
        .from('dkai_messages')
        .select('id, content, created_at, sender_id')
        .eq('recipient_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(10);

      messages?.forEach((msg: any) => {
        notifs.push({
          id: msg.id, type: 'message', title: 'New Message',
          description: (msg.content || '').substring(0, 60) + '...',
          read: false, created_at: msg.created_at, link: '/messages',
        });
      });

      // BUYER: only confirmed purchases (never pending_payment)
      const { data: purchases } = await db
        .from('dkai_orders')
        .select('id, status, created_at, product_id, dkai_products:product_id(title)')
        .eq('buyer_id', user.id)
        .in('status', PAID_STATUSES)
        .order('created_at', { ascending: false })
        .limit(5);

      purchases?.forEach((order: any) => {
        const title = order.dkai_products?.title ?? 'your item';
        notifs.push({
          id: `buy-${order.id}`, type: 'order',
          title: 'Purchase confirmed',
          description: `Your purchase of ${title} is confirmed. Download or track it here.`,
          read: false, created_at: order.created_at,
          link: '/purchase-history',
        });
      });

      // SELLER: confirmed sales with ordinal
      const { data: sales } = await db
        .from('dkai_orders')
        .select('id, status, created_at, product_id, dkai_products:product_id(title)')
        .eq('seller_id', user.id)
        .in('status', PAID_STATUSES)
        .order('created_at', { ascending: true });

      (sales || []).slice(-5).reverse().forEach((order: any, idxFromEnd: number, arr: any[]) => {
        const total = sales!.length;
        const positionFromStart = total - idxFromEnd;
        const title = order.dkai_products?.title ?? 'your product';
        notifs.push({
          id: `sale-${order.id}`, type: 'sale',
          title: 'You made a sale',
          description: `You made a sale — ${title}! That's your ${ordinal(positionFromStart)} sale on DK AI Marketplace.`,
          read: false, created_at: order.created_at,
          link: '/seller-orders',
        });
      });

      setNotifications(notifs.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const addNotification = (notif: Notification) => {
    setNotifications((prev) => [notif, ...prev].slice(0, 20));
  };

  const handleNotificationClick = (notif: Notification) => {
    if (notif.link) { navigate(notif.link); setOpen(false); }
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'message': return <MessageSquare className="h-5 w-5 text-blue-500" />;
      case 'order':
      case 'sale': return <ShoppingCart className="h-5 w-5 text-green-500" />;
      case 'product': return <Package className="h-5 w-5 text-purple-500" />;
      default: return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs rounded-full">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Bell className="h-5 w-5" />Notifications</div>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs">
                Mark all read
              </Button>
            )}
          </SheetTitle>
          <SheetDescription>
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'No new notifications'}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-200px)]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notif) => (
                <Card
                  key={notif.id}
                  className={`p-4 cursor-pointer transition-all hover:shadow-md rounded-xl ${
                    !notif.read ? 'bg-primary/5 border-primary/20' : 'bg-card'
                  }`}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className="flex gap-3">
                    <div className="shrink-0 mt-1">{getIcon(notif.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-semibold text-sm">{notif.title}</p>
                        {!notif.read && (
                          <div className="h-2 w-2 bg-primary rounded-full shrink-0 mt-1.5"></div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {notif.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
