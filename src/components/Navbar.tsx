import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, Plus, Settings, LogOut, ShoppingBag, DollarSign, Heart, MessageSquare, LayoutDashboard, Bell, Menu } from 'lucide-react';

import { useEffect, useState } from 'react';
import { db } from '@/lib/dkaiDb';
import { NotificationCenter } from '@/components/NotificationCenter';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/marketplace', label: 'Marketplace' },
  { to: '/meetings', label: 'Meetings' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/community', label: 'Community' },
];

export function Navbar() {
  const { user, signOut } = useAuth();
  const { hasRole: isSeller } = useHasRole('seller');
  const { hasRole: isAdmin } = useHasRole('admin');
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const loadUnreadCount = async () => {
      const { count } = await db
        .from('dkai_messages')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      setUnreadCount(count || 0);
    };

    loadUnreadCount();

    const channel = db
      .channel('navbar-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dkai_messages',
        },
        () => loadUnreadCount()
      )
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [user]);

  return (
    <nav className="border-b bg-card/50 backdrop-blur-sm shadow-sm sticky top-0 z-50 transition-colors">
      <div className="container mx-auto px-4 lg:px-6 py-3 flex items-center justify-between">
        {/* Left: Logo + desktop links */}
        <div className="flex items-center gap-4 lg:gap-8">
          <Link to="/" className="flex items-center font-bold text-base lg:text-lg text-foreground hover:text-primary transition-colors whitespace-nowrap">
            DK AI MARKETPLACE
          </Link>
          <div className="hidden md:flex items-center gap-6 lg:gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-semibold hover:text-primary transition-colors relative group"
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
              </Link>
            ))}
            {isSeller && (
              <Link to="/seller-dashboard" className="text-sm font-semibold hover:text-primary transition-colors relative group">
                Dashboard
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
              </Link>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <NotificationCenter />
              {isSeller && (
                <Button asChild size="sm" className="rounded-full hidden lg:flex">
                  <Link to="/create-product">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Listing
                  </Link>
                </Button>
              )}

              {/* Desktop avatar dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full hidden md:flex">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.user_metadata?.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {user.user_metadata?.full_name?.[0] || user.email?.[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold">{user.user_metadata?.full_name || 'User'}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link to="/profile"><User className="w-4 h-4 mr-2" />Edit Profile</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/purchases"><ShoppingBag className="w-4 h-4 mr-2" />Purchase History</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/wishlist"><Heart className="w-4 h-4 mr-2" />Wishlist</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/disputes"><MessageSquare className="w-4 h-4 mr-2" />Disputes</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/messages" className="flex items-center justify-between">
                      <div className="flex items-center"><MessageSquare className="w-4 h-4 mr-2" />Messages</div>
                      {unreadCount > 0 && <Badge variant="default" className="ml-2 rounded-full h-5 px-2">{unreadCount}</Badge>}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {isSeller && (
                    <>
                      <DropdownMenuItem asChild><Link to="/seller-dashboard"><LayoutDashboard className="w-4 h-4 mr-2" />Seller Dashboard</Link></DropdownMenuItem>
                      <DropdownMenuItem asChild><Link to="/create-product"><Plus className="w-4 h-4 mr-2" />Create Product</Link></DropdownMenuItem>
                      <DropdownMenuItem asChild><Link to="/earnings"><DollarSign className="w-4 h-4 mr-2" />Earnings</Link></DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {isAdmin && (
                    <>
                      <DropdownMenuItem asChild><Link to="/admin"><Settings className="w-4 h-4 mr-2" />Admin Dashboard</Link></DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem asChild><Link to="/settings"><Settings className="w-4 h-4 mr-2" />Settings</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()} className="text-destructive"><LogOut className="w-4 h-4 mr-2" />Sign Out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mobile hamburger */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden rounded-full">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px] p-0">
                  <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                  <div className="flex flex-col h-full">
                    {/* User info */}
                    <div className="p-4 border-b bg-muted/30">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.user_metadata?.avatar_url} />
                          <AvatarFallback>{user.user_metadata?.full_name?.[0] || user.email?.[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{user.user_metadata?.full_name || 'User'}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                      </div>
                    </div>

                    {/* Navigation links */}
                    <div className="flex-1 overflow-auto py-2">
                      <div className="px-2 space-y-1">
                        {navLinks.map((link) => (
                          <Link
                            key={link.to}
                            to={link.to}
                            onClick={() => setMobileOpen(false)}
                            className="flex items-center px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-accent transition-colors"
                          >
                            {link.label}
                          </Link>
                        ))}
                        {isSeller && (
                          <Link to="/seller-dashboard" onClick={() => setMobileOpen(false)} className="flex items-center px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-accent transition-colors">
                            <LayoutDashboard className="w-4 h-4 mr-3" />Dashboard
                          </Link>
                        )}
                      </div>

                      <div className="border-t my-2" />

                      <div className="px-2 space-y-1">
                        <Link to="/profile" onClick={() => setMobileOpen(false)} className="flex items-center px-3 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors"><User className="w-4 h-4 mr-3" />Profile</Link>
                        <Link to="/messages" onClick={() => setMobileOpen(false)} className="flex items-center justify-between px-3 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors">
                          <span className="flex items-center"><MessageSquare className="w-4 h-4 mr-3" />Messages</span>
                          {unreadCount > 0 && <Badge variant="default" className="rounded-full h-5 px-2 text-xs">{unreadCount}</Badge>}
                        </Link>
                        <Link to="/purchases" onClick={() => setMobileOpen(false)} className="flex items-center px-3 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors"><ShoppingBag className="w-4 h-4 mr-3" />Purchases</Link>
                        <Link to="/wishlist" onClick={() => setMobileOpen(false)} className="flex items-center px-3 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors"><Heart className="w-4 h-4 mr-3" />Wishlist</Link>
                        <Link to="/settings" onClick={() => setMobileOpen(false)} className="flex items-center px-3 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors"><Settings className="w-4 h-4 mr-3" />Settings</Link>
                      </div>

                      {isSeller && (
                        <>
                          <div className="border-t my-2" />
                          <div className="px-2 space-y-1">
                            <Link to="/create-product" onClick={() => setMobileOpen(false)} className="flex items-center px-3 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors"><Plus className="w-4 h-4 mr-3" />Create Product</Link>
                            <Link to="/earnings" onClick={() => setMobileOpen(false)} className="flex items-center px-3 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors"><DollarSign className="w-4 h-4 mr-3" />Earnings</Link>
                          </div>
                        </>
                      )}

                      {isAdmin && (
                        <>
                          <div className="border-t my-2" />
                          <div className="px-2 space-y-1">
                            <Link to="/admin" onClick={() => setMobileOpen(false)} className="flex items-center px-3 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors"><Settings className="w-4 h-4 mr-3" />Admin</Link>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Sign out */}
                    <div className="p-4 border-t">
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-destructive hover:text-destructive"
                        onClick={() => { signOut(); setMobileOpen(false); }}
                      >
                        <LogOut className="w-4 h-4 mr-3" />Sign Out
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" asChild className="rounded-full" size="sm">
                <Link to="/login">Sign In</Link>
              </Button>
              <Button asChild className="rounded-full" size="sm">
                <Link to="/signup">Sign Up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
