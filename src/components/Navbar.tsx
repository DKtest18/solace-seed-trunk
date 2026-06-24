import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { NavLink } from '@/components/NavLink';

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
import { User, Plus, Settings, LogOut, ShoppingBag, DollarSign, Heart, MessageSquare, LayoutDashboard, Menu } from 'lucide-react';

import { useEffect, useState } from 'react';
import { db } from '@/lib/dkaiDb';
import { NotificationCenter } from '@/components/NotificationCenter';

const navLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/marketplace', label: 'Marketplace' },
  
];

const SUPER_ADMIN_EMAIL = 'dari@dkaisystem.com';

export function Navbar() {
  const { user, signOut } = useAuth();
  const { hasRole: isSeller } = useHasRole('seller');
  const { hasRole: isAdmin } = useHasRole('admin');
  const isSuperAdmin = user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingProducts, setPendingProducts] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    const loadPending = async () => {
      const { count } = await db
        .from('dkai_products')
        .select('id', { count: 'exact', head: true })
        .eq('review_status', 'submitted');
      setPendingProducts(count || 0);
    };
    loadPending();
    const interval = setInterval(loadPending, 60_000);
    return () => clearInterval(interval);
  }, [isAdmin]);


  // Messaging removed in favor of Product Q&A
  useEffect(() => {
    setUnreadCount(0);
  }, [user]);

  return (
    <nav className="bg-white border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Left: Logo pill */}
        <Link to="/" className="bg-gray-900 rounded-lg p-1 px-2 hover:opacity-90 transition-opacity">
          <img src="/logo.png" alt="DK AI Marketplace" className="h-9 w-auto" />
        </Link>

        {/* Center: nav links */}
        <div className="hidden md:flex items-center space-x-7">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              activeClassName="text-primary"
              className="text-sm font-medium text-gray-700 hover:text-primary transition-colors"
            >
              {link.label}
            </NavLink>
          ))}
          {isSeller && (
            <NavLink
              to="/seller-dashboard"
              activeClassName="text-primary"
              className="text-sm font-medium text-gray-700 hover:text-primary transition-colors"
            >
              Dashboard
            </NavLink>
          )}
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
                      <DropdownMenuItem asChild>
                        <Link to="/admin/waitlist" className="flex items-center justify-between gap-2">
                          <span className="flex items-center"><User className="w-4 h-4 mr-2" />Product Approvals</span>
                          {pendingProducts > 0 && (
                            <Badge variant="destructive" className="rounded-full h-5 px-2 text-xs">{pendingProducts}</Badge>
                          )}
                        </Link>
                      </DropdownMenuItem>
                      {isSuperAdmin && (
                        <DropdownMenuItem asChild>
                          <Link to="/admin/users"><User className="w-4 h-4 mr-2" />User Management</Link>
                        </DropdownMenuItem>
                      )}
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
                            <Link to="/admin/waitlist" onClick={() => setMobileOpen(false)} className="flex items-center justify-between px-3 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors">
                              <span className="flex items-center"><User className="w-4 h-4 mr-3" />Product Approvals</span>
                              {pendingProducts > 0 && <Badge variant="destructive" className="rounded-full h-5 px-2 text-xs">{pendingProducts}</Badge>}
                            </Link>
                            {isSuperAdmin && (
                              <Link to="/admin/users" onClick={() => setMobileOpen(false)} className="flex items-center px-3 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors">
                                <User className="w-4 h-4 mr-3" />User Management
                              </Link>
                            )}
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
            <div className="flex items-center gap-2">
              <Button variant="ghost" asChild size="sm">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button variant="navCta" asChild size="sm">
                <Link to="/signup">Get started</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
