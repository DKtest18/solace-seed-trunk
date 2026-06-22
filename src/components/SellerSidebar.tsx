import { LayoutDashboard, Package, Plus, MessageSquare, DollarSign, Settings, BarChart3, Bell, Wallet, Trophy, Calendar, Briefcase, Boxes, Tag, Palette } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { Badge } from '@/components/ui/badge';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useEffect, useState } from 'react';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';

const sellerMenuItems = [
  { title: 'Dashboard', url: '/seller-dashboard', icon: LayoutDashboard, end: true },
  { title: 'Orders', url: '/seller-orders', icon: Package },
  { title: 'Products', url: '/seller-products', icon: Boxes },
  { title: 'Create Product', url: '/create-product', icon: Plus },
  { title: 'Meetings', url: '/seller-dashboard/meetings', icon: Calendar },
  { title: 'Portfolio', url: '/seller-dashboard/portfolio', icon: Briefcase },
  { title: 'Messages', url: '/messages', icon: MessageSquare, showBadge: true },
  { title: 'Notifications', url: '/notifications', icon: Bell, showBadge: true },
  { title: 'Achievements', url: '/achievements', icon: Trophy },
  { title: 'Earnings', url: '/earnings', icon: DollarSign },
  { title: 'Payouts', url: '/payouts', icon: Wallet },
  { title: 'Analytics', url: '/seller-dashboard/analytics', icon: BarChart3 },
  { title: 'Coupons', url: '/seller-dashboard/coupons', icon: Tag },
  { title: 'Storefront', url: '/seller-dashboard/storefront', icon: Palette },
  { title: 'Payment Settings', url: '/seller-onboarding/payment', icon: Settings },
];

export function SellerSidebar() {
  const { state } = useSidebar();
  const { user } = useAuth();
  const location = useLocation();
  const isCollapsed = state === 'collapsed';
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  
  const isMessagesPage = location.pathname === '/messages';

  useEffect(() => {
    if (!user) return;

    const loadCounts = async () => {
      const { count: msgCount } = await db
        .from('dkai_messages')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      setUnreadMessages(msgCount || 0);
      
      // Simplified notification count (messages + recent orders)
      setUnreadNotifications((msgCount || 0));
    };

    loadCounts();

    const channel = db
      .channel('sidebar-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dkai_messages' }, () => loadCounts())
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [user]);

  return (
    <Sidebar collapsible="icon" className="border-r bg-card/50 backdrop-blur-sm shadow-sm mt-[60px]">
      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupLabel className={isCollapsed ? 'sr-only' : 'text-xs uppercase tracking-wider font-bold text-muted-foreground px-3'}>
            Seller Portal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sellerMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink 
                      to={item.url} 
                      end={item.end}
                      className="hover:bg-sidebar-accent/50 rounded-xl transition-all" 
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                    >
                      <item.icon className="h-5 w-5" />
                      {!isCollapsed && (
                        <span className="flex items-center justify-between w-full">
                          {item.title}
                          {item.showBadge && (
                            <>
                              {item.title === 'Messages' && unreadMessages > 0 && (
                                <Badge variant="default" className="ml-auto rounded-full h-5 px-2">
                                  {unreadMessages > 9 ? '9+' : unreadMessages}
                                </Badge>
                              )}
                              {item.title === 'Notifications' && unreadNotifications > 0 && (
                                <Badge variant="default" className="ml-auto rounded-full h-5 px-2">
                                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                                </Badge>
                              )}
                            </>
                          )}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
