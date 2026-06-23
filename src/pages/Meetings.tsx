import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  Calendar, Globe, MessageSquare, Search, User, Video,
  MessageSquareText, SlidersHorizontal, Users as UsersIcon, X,
} from 'lucide-react';
import { MeetingBookingDialog } from '@/components/meetings/MeetingBookingDialog';
import { OpenRequestForm } from '@/components/meetings/OpenRequestForm';
import { BuyerCalendarView } from '@/components/meetings/BuyerCalendarView';

interface SellerWithMeetings {
  seller_id: string;
  meetings_enabled: boolean;
  booking_mode: 'calendar' | 'open_request';
  timezone: string;
  preferred_platform: string;
  calendar_visibility?: string;
  meeting_pitch?: string;
  profile: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string;
    bio: string;
    creator_name: string;
  };
  meeting_types: {
    id: string;
    name: string;
    description?: string;
    is_paid: boolean;
    price: number;
    duration_minutes: number;
    is_group: boolean;
    max_participants?: number;
  }[];
  product_count?: number;
  sales_count?: number;
  achievements?: { title: string; icon_url: string }[];
}

export default function Meetings() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [meetingTypeFilter, setMeetingTypeFilter] = useState<string>('all');
  const [bookingModeFilter, setBookingModeFilter] = useState<string>('all');
  const [selectedSeller, setSelectedSeller] = useState<SellerWithMeetings | null>(null);
  const [calendarViewOpen, setCalendarViewOpen] = useState(false);
  const [openRequestFormOpen, setOpenRequestFormOpen] = useState(false);

  const { data: sellers, isLoading } = useQuery({
    queryKey: ['sellers-with-meetings'],
    queryFn: async () => {
      const { data: configs, error: configError } = await supabase
        .from('seller_meeting_configs')
        .select('*')
        .eq('meetings_enabled', true);

      if (configError) throw configError;
      if (!configs?.length) return [];

      const sellerIds = configs.map(c => c.seller_id);
      const { data: profiles, error: profileError } = await db
        .from('dkai_profiles')
        .select('id, username, full_name, avatar_url, bio, creator_name')
        .in('id', sellerIds);

      if (profileError) throw profileError;

      const calendarSellerIds = configs.filter(c => c.booking_mode === 'calendar').map(c => c.seller_id);
      let meetingTypes: any[] = [];
      if (calendarSellerIds.length > 0) {
        const { data: types, error: typesError } = await supabase
          .from('meeting_types')
          .select('*')
          .in('seller_id', calendarSellerIds)
          .eq('is_active', true);

        if (typesError) throw typesError;
        meetingTypes = types || [];
      }

      const { data: productCounts } = await db
        .from('dkai_products')
        .select('seller_id')
        .in('seller_id', sellerIds)
        .eq('is_published', true);

      const productCountMap = new Map<string, number>();
      productCounts?.forEach(p => {
        productCountMap.set(p.seller_id, (productCountMap.get(p.seller_id) || 0) + 1);
      });

      const { data: salesData } = await db
        .from('dkai_orders')
        .select('product_id, dkai_products!inner(seller_id)')
        .in('status', ['completed', 'payment_confirmed', 'delivered']);

      const salesCountMap = new Map<string, number>();
      salesData?.forEach((order: any) => {
        const sellerId = order.products?.seller_id;
        if (sellerId && sellerIds.includes(sellerId)) {
          salesCountMap.set(sellerId, (salesCountMap.get(sellerId) || 0) + 1);
        }
      });

      const { data: achievementsData } = await db
        .from('dkai_achievements')
        .select('user_id, title, icon_url')
        .in('user_id', sellerIds)
        .order('earned_at', { ascending: false });

      const achievementsMap = new Map<string, { title: string; icon_url: string }[]>();
      achievementsData?.forEach(a => {
        const existing = achievementsMap.get(a.user_id) || [];
        if (existing.length < 3) {
          existing.push({ title: a.title, icon_url: a.icon_url || '' });
          achievementsMap.set(a.user_id, existing);
        }
      });

      return configs.map(config => ({
        ...config,
        booking_mode: (config.booking_mode as 'calendar' | 'open_request') || 'calendar',
        calendar_visibility: config.calendar_visibility || 'public',
        meeting_pitch: config.meeting_pitch || null,
        profile: profiles?.find(p => p.id === config.seller_id) || null,
        meeting_types: meetingTypes?.filter(mt => mt.seller_id === config.seller_id) || [],
        product_count: productCountMap.get(config.seller_id) || 0,
        sales_count: salesCountMap.get(config.seller_id) || 0,
        achievements: achievementsMap.get(config.seller_id) || []
      })).filter(s => {
        if (s.calendar_visibility === 'private') return false;
        return s.profile;
      }) as SellerWithMeetings[];
    }
  });

  const filteredSellers = sellers?.filter(seller => {
    const matchesSearch =
      seller.profile.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      seller.profile.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      seller.profile.bio?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = meetingTypeFilter === 'all' ||
      (meetingTypeFilter === 'free' && seller.meeting_types.some(mt => !mt.is_paid)) ||
      (meetingTypeFilter === 'paid' && seller.meeting_types.some(mt => mt.is_paid)) ||
      (meetingTypeFilter === 'group' && seller.meeting_types.some(mt => mt.is_group));

    const matchesBookingMode = bookingModeFilter === 'all' ||
      (bookingModeFilter === 'calendar' && seller.booking_mode === 'calendar') ||
      (bookingModeFilter === 'open_request' && seller.booking_mode === 'open_request');

    return matchesSearch && matchesType && matchesBookingMode;
  });

  const handleBookMeeting = (seller: SellerWithMeetings) => {
    if (!user) {
      window.location.href = '/login?redirect=/meetings';
      return;
    }
    setSelectedSeller(seller);
    if (seller.booking_mode === 'open_request') {
      setOpenRequestFormOpen(true);
    } else {
      setCalendarViewOpen(true);
    }
  };

  const canBookSeller = (seller: SellerWithMeetings) => {
    if (seller.calendar_visibility === 'private') return false;
    return seller.booking_mode === 'open_request' || seller.meeting_types.length > 0;
  };

  const clearFilters = () => {
    setSearchQuery('');
    setMeetingTypeFilter('all');
    setBookingModeFilter('all');
  };

  const hasActiveFilters = meetingTypeFilter !== 'all' || bookingModeFilter !== 'all';

  const FilterPill = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
    <span className="rounded-full bg-primary-soft text-primary px-3 py-1 text-xs flex items-center gap-1">
      {label}
      <button onClick={onRemove} className="hover:opacity-70" aria-label={`Remove ${label}`}>
        <X className="w-3 h-3" />
      </button>
    </span>
  );

  const FilterPanel = () => (
    <div>
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Meeting Type</h3>
        <Select value={meetingTypeFilter} onValueChange={setMeetingTypeFilter}>
          <SelectTrigger className="text-sm"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="free">Free Meetings</SelectItem>
            <SelectItem value="paid">Paid Meetings</SelectItem>
            <SelectItem value="group">Group Meetings</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Booking Mode</h3>
        <Select value={bookingModeFilter} onValueChange={setBookingModeFilter}>
          <SelectTrigger className="text-sm"><SelectValue placeholder="All Modes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modes</SelectItem>
            <SelectItem value="calendar">Calendar Booking</SelectItem>
            <SelectItem value="open_request">Open Requests</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button variant="outline" onClick={clearFilters} className="w-full">
        Clear Filters
      </Button>
    </div>
  );

  const SkeletonCard = () => (
    <Card className="overflow-hidden">
      <Skeleton className="h-20 w-full" />
      <div className="px-6 pb-6 -mt-10">
        <Skeleton className="h-20 w-20 rounded-full mx-auto ring-4 ring-white" />
        <Skeleton className="h-5 w-32 mx-auto mt-4" />
        <Skeleton className="h-4 w-24 mx-auto mt-2" />
        <div className="flex justify-center gap-2 mt-4">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-10 w-full mt-4" />
      </div>
    </Card>
  );

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <header className="max-w-7xl mx-auto px-6 pt-12 pb-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-display font-semibold text-gray-900 mb-2">
                Book a call with AI experts
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl">
                1-on-1 consultations with verified AI builders. Get help with your specific use case,
                technical questions, or product strategy.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/join-meeting">
                <Video className="mr-2 h-4 w-4" />
                Join Meeting
              </Link>
            </Button>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-6 pb-16 grid lg:grid-cols-[280px_1fr] gap-8">
          {/* Filters sidebar */}
          <aside className="hidden lg:block sticky top-24 self-start">
            <FilterPanel />
          </aside>

          {/* Right column */}
          <div className="min-w-0">
            {/* Search */}
            <div className="mb-6 flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search experts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-lg border border-border bg-white px-4 py-2.5 text-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
                />
              </div>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="lg:hidden">
                    <SlidersHorizontal className="w-4 h-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <FilterPanel />
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Active filter pills */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 items-center mb-6">
                {meetingTypeFilter !== 'all' && (
                  <FilterPill label={`Type: ${meetingTypeFilter}`} onRemove={() => setMeetingTypeFilter('all')} />
                )}
                {bookingModeFilter !== 'all' && (
                  <FilterPill label={`Mode: ${bookingModeFilter}`} onRemove={() => setBookingModeFilter('all')} />
                )}
              </div>
            )}

            {/* Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : filteredSellers && filteredSellers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredSellers.map((seller) => {
                  const minPaid = seller.meeting_types
                    .filter(mt => mt.is_paid)
                    .sort((a, b) => Number(a.price) - Number(b.price))[0];
                  const minFree = seller.meeting_types.find(mt => !mt.is_paid);
                  const priceLabel = minPaid
                    ? `€${minPaid.price} / ${minPaid.duration_minutes}min`
                    : minFree
                      ? `Free / ${minFree.duration_minutes}min`
                      : seller.booking_mode === 'open_request' ? 'Open Request' : 'Contact';

                  return (
                    <Card key={seller.seller_id} className="overflow-hidden hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
                      {/* Gradient header strip */}
                      <div className="h-20 bg-gradient-to-r from-primary-soft to-background-soft" />

                      <div className="px-6 pb-6 flex flex-col flex-1">
                        <Link to={`/u/${seller.profile.username}`} className="self-center">
                          <Avatar className="w-20 h-20 ring-4 ring-white -mt-10 mx-auto">
                            <AvatarImage src={seller.profile.avatar_url} />
                            <AvatarFallback>
                              {seller.profile.full_name?.[0] || seller.profile.username?.[0] || 'S'}
                            </AvatarFallback>
                          </Avatar>
                        </Link>

                        <Link to={`/u/${seller.profile.username}`} className="text-center mt-3 hover:underline">
                          <h3 className="font-display text-lg font-semibold text-gray-900">
                            {seller.profile.full_name || seller.profile.creator_name || seller.profile.username}
                          </h3>
                        </Link>
                        <p className="text-sm text-muted-foreground text-center mb-3">
                          @{seller.profile.username}
                        </p>

                        {(seller.meeting_pitch || seller.profile.bio) && (
                          <p className="text-sm text-muted-foreground text-center mb-4 line-clamp-2">
                            {seller.meeting_pitch || seller.profile.bio}
                          </p>
                        )}

                        {/* Skill / signal pills */}
                        <div className="flex flex-wrap gap-1.5 justify-center mb-4">
                          {seller.booking_mode === 'open_request' && (
                            <span className="bg-primary-soft text-primary text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                              <MessageSquareText className="h-3 w-3" /> Open Request
                            </span>
                          )}
                          {seller.meeting_types.slice(0, 3).map((type) => (
                            <span key={type.id} className="bg-primary-soft text-primary text-xs px-2.5 py-1 rounded-full">
                              {type.duration_minutes}min{type.is_group ? ' · Group' : ''}
                            </span>
                          ))}
                          {seller.meeting_types.length > 3 && (
                            <span className="bg-background-soft text-muted-foreground text-xs px-2.5 py-1 rounded-full">
                              +{seller.meeting_types.length - 3}
                            </span>
                          )}
                        </div>

                        {/* Trust row */}
                        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground mb-4">
                          <span className="inline-flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {seller.timezone}
                          </span>
                          {(seller.sales_count ?? 0) > 0 && (
                            <span>· {seller.sales_count} sales</span>
                          )}
                        </div>

                        {/* Bottom */}
                        <div className="mt-auto flex items-center justify-between pt-4 border-t border-border gap-2">
                          <span className="text-sm font-medium text-gray-900">{priceLabel}</span>
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" asChild aria-label="Profile">
                              <Link to={`/u/${seller.profile.username}`}>
                                <User className="h-4 w-4" />
                              </Link>
                            </Button>
                            {user && (
                              <Button variant="outline" size="icon" asChild aria-label="Message">
                                <Link to={`/messages?seller=${seller.seller_id}`}>
                                  <MessageSquare className="h-4 w-4" />
                                </Link>
                              </Button>
                            )}
                            <Button
                              variant="navCta"
                              size="sm"
                              onClick={() => handleBookMeeting(seller)}
                              disabled={!canBookSeller(seller)}
                            >
                              {seller.booking_mode === 'open_request' ? 'Request' : 'Book call'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20">
                <UsersIcon className="mx-auto mb-4 text-muted-foreground" size={48} />
                <h2 className="font-display text-xl font-semibold text-gray-900 mb-2">
                  No experts match your filters
                </h2>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Try removing some filters or check back soon — we're pre-launch and onboarding new
                  AI experts daily.
                </p>
                <Button variant="outline" onClick={clearFilters}>Reset filters</Button>
              </div>
            )}
          </div>
        </div>

        {/* Calendar booking dialog */}
        {selectedSeller && selectedSeller.booking_mode === 'calendar' && (
          <Dialog open={calendarViewOpen} onOpenChange={setCalendarViewOpen}>
            <DialogContent className="max-w-6xl h-[90vh] p-0">
              <BuyerCalendarView
                sellerId={selectedSeller.seller_id}
                sellerProfile={selectedSeller.profile}
                sellerConfig={{
                  seller_id: selectedSeller.seller_id,
                  timezone: selectedSeller.timezone,
                  calendar_visibility: selectedSeller.calendar_visibility || 'public',
                  booking_mode: selectedSeller.booking_mode
                }}
                meetingTypes={selectedSeller.meeting_types}
                onClose={() => setCalendarViewOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )}

        {/* Open Request Form */}
        {selectedSeller && selectedSeller.booking_mode === 'open_request' && (
          <OpenRequestForm
            open={openRequestFormOpen}
            onOpenChange={setOpenRequestFormOpen}
            seller={selectedSeller}
          />
        )}
      </div>
    </AppLayout>
  );
}
