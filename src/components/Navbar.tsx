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
import { User, Plus, Settings, LogOut, ShoppingBag, DollarSign, Heart, MessageSquare, LayoutDashboard, Menu, Briefcase } from 'lucide-react';

import { useEffect, useState } from 'react';
import { db } from '@/lib/dkaiDb';
import { NotificationCenter } from '@/components/NotificationCenter';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { REVIEW_STATUS_GROUPS } from '@/lib/reviewStatus';
import { MainNav } from '@/components/nav/MainNav';
import { MobileMainNav } from '@/components/nav/MobileMainNav';
import { useLocation } from 'react-router-dom';

export function Navbar() {
  const { user, signOut } = useAuth();
  const { hasRole: isSeller } = useHasRole('seller');
  const { hasRole: isAdmin } = useHasRole('admin');
  // Server-side role check — replaces the old hardcoded email comparison.
  // The frontend flag is UI-only; every privileged edge function must
  // re-verify the super_admin role server-side.
  const { hasRole: isSuperAdmin } = useHasRole('super_admin');
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingProducts, setPendingProducts] = useState(0);
  const location = useLocation();

  // Close the mobile sheet whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!isAdmin) return;
    const loadPending = async () => {
      const { count } = await db
        .from('dkai_products')
        .select('id', { count: 'exact', head: true })
        .in('review_status', REVIEW_STATUS_GROUPS.PENDING);
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

  // Keep the header avatar in sync with the saved profile (same source as Edit Profile)
  const [myProfile, setMyProfile] = useState<{ avatar_url: string | null; full_name: string | null } | null>(null);
  useEffect(() => {
    if (!user) {
      setMyProfile(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data } = await db
        .from('dkai_profiles')
        .select('avatar_url, full_name')
        .eq('id', user.id)
        .maybeSingle();
      if (!cancelled && data) setMyProfile(data as any);
    };
    load();
    const onUpdated = () => load();
    window.addEventListener('dkai:profile-updated', onUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('dkai:profile-updated', onUpdated);
    };
  }, [user]);

  const avatarSrc = myProfile?.avatar_url || user?.user_metadata?.avatar_url || undefined;
  const displayName = myProfile?.full_name || user?.user_metadata?.full_name || 'User';

  return (
    <nav className="bg-white border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Left: Logo pill */}
        <Link to="/" className="bg-gray-900 rounded-lg p-1 px-2 hover:opacity-90 transition-opacity">
          <img src="/logo.png" alt="DK AI Marketplace" className="h-9 w-auto" />
        </Link>

        {/* Center: main navigation (dropdowns) */}
        <div className="hidden md:flex items-center gap-4">
          <MainNav />
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
          <LanguageSwitcher />
          {user ? (

            <>
              <NotificationCenter />
              {isSeller ? (
                <Button asChild size="sm" className="rounded-full hidden lg:flex">
                  <Link to="/create-product">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Listing
                  </Link>
                </Button>
              ) : (
                <Button asChild size="sm" className="rounded-full hidden lg:flex">
                  <Link to="/seller-onboarding">
                    <Briefcase className="w-4 h-4 mr-2" />
                    Become a Seller
                  </Link>
                </Button>
              )}


              {/* Desktop avatar dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full hidden md:flex">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={avatarSrc} />
                      <AvatarFallback className="text-xs">
                        {displayName?.[0] || user.email?.[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold">{displayName}</p>
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
                        <Link to="/admin/product-review" className="flex items-center justify-between gap-2">
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
                          <AvatarImage src={avatarSrc} />
                          <AvatarFallback>{displayName?.[0] || user.email?.[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{displayName}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                      </div>
                    </div>

                    {/* Navigation links */}
                    <div className="flex-1 overflow-auto py-2">
                      <MobileMainNav onNavigate={() => setMobileOpen(false)} />
                      <div className="px-2 space-y-1">
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
                            <Link to="/admin/product-review" onClick={() => setMobileOpen(false)} className="flex items-center justify-between px-3 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors">
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
              <Button variant="ghost" asChild size="sm" className="hidden sm:inline-flex">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button variant="navCta" asChild size="sm">
                <Link to="/signup">Get started</Link>
              </Button>

              {/* Mobile hamburger for signed-out visitors */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden rounded-full" aria-label="Open navigation menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px] p-0">
                  <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                  <div className="flex flex-col h-full">
                    <div className="flex-1 overflow-auto py-4">
                      <MobileMainNav onNavigate={() => setMobileOpen(false)} />
                    </div>
                    <div className="p-4 border-t space-y-2">
                      <Button variant="outline" asChild className="w-full">
                        <Link to="/login" onClick={() => setMobileOpen(false)}>Sign in</Link>
                      </Button>
                      <Button variant="navCta" asChild className="w-full">
                        <Link to="/signup" onClick={() => setMobileOpen(false)}>Get started</Link>
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
