import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Calendar, Clock, Globe, MessageSquare, Search, User, Video, MessageSquareText, ShoppingBag, Trophy, Package } from 'lucide-react';
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
  // Trust signals
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
  const [calendarBookingOpen, setCalendarBookingOpen] = useState(false);
  const [openRequestFormOpen, setOpenRequestFormOpen] = useState(false);

  const { data: sellers, isLoading } = useQuery({
    queryKey: ['sellers-with-meetings'],
    queryFn: async () => {
      // Get sellers with meetings enabled
      const { data: configs, error: configError } = await supabase
        .from('seller_meeting_configs')
        .select('*')
        .eq('meetings_enabled', true);

      if (configError) throw configError;
      if (!configs?.length) return [];

      // Get profiles for these sellers
      const sellerIds = configs.map(c => c.seller_id);
      const { data: profiles, error: profileError } = await db
        .from('dkai_profiles')
        .select('id, username, full_name, avatar_url, bio, creator_name')
        .in('id', sellerIds);

      if (profileError) throw profileError;

      // Get meeting types for calendar-mode sellers
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

      // Get product counts for sellers
      const { data: productCounts } = await db
        .from('dkai_products')
        .select('seller_id')
        .in('seller_id', sellerIds)
        .eq('is_published', true);

      const productCountMap = new Map<string, number>();
      productCounts?.forEach(p => {
        productCountMap.set(p.seller_id, (productCountMap.get(p.seller_id) || 0) + 1);
      });

      // Get sales counts (completed orders) for sellers
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

      // Get top achievements for sellers
      const { data: achievementsData } = await supabase
        .from('achievements')
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

      // Combine data - filter by visibility
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
        // Filter out sellers with private calendars (only me)
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
    
    // Open the appropriate dialog based on booking mode
    if (seller.booking_mode === 'open_request') {
      setOpenRequestFormOpen(true);
    } else {
      // Open the full calendar view for direct slot booking
      setCalendarViewOpen(true);
    }
  };

  const canBookSeller = (seller: SellerWithMeetings) => {
    // Check visibility
    if (seller.calendar_visibility === 'private') return false;
    // For followers-only, would need to check follow status
    // For now, allow booking for public and followers
    return seller.booking_mode === 'open_request' || seller.meeting_types.length > 0;
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
            <h1 className="text-3xl font-bold text-foreground">Book a Meeting</h1>
            <Button asChild size="lg" variant="default">
              <Link to="/join-meeting">
                <Video className="mr-2 h-5 w-5" />
                Join Meeting
              </Link>
            </Button>
          </div>
          <p className="text-muted-foreground">
            Schedule meetings with sellers for consultations, project discussions, or service delivery.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sellers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={meetingTypeFilter} onValueChange={setMeetingTypeFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Meeting type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="free">Free Meetings</SelectItem>
              <SelectItem value="paid">Paid Meetings</SelectItem>
              <SelectItem value="group">Group Meetings</SelectItem>
            </SelectContent>
          </Select>
          <Select value={bookingModeFilter} onValueChange={setBookingModeFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Booking mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modes</SelectItem>
              <SelectItem value="calendar">Calendar Booking</SelectItem>
              <SelectItem value="open_request">Open Requests</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Seller Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center gap-4">
                  <Skeleton className="h-16 w-16 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-16 w-full" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-10 w-full" />
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : filteredSellers?.length === 0 ? (
          <div className="text-center py-12">
            <Video className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No sellers available</h3>
            <p className="text-muted-foreground">
              {searchQuery || meetingTypeFilter !== 'all' 
                ? 'Try adjusting your filters'
                : 'No sellers have enabled meetings yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSellers?.map((seller) => (
              <Card key={seller.seller_id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex items-start gap-4">
                    <Link to={`/u/${seller.profile.username}`}>
                      <Avatar className="h-16 w-16 cursor-pointer hover:ring-2 hover:ring-primary transition-all">
                        <AvatarImage src={seller.profile.avatar_url} />
                        <AvatarFallback>
                          {seller.profile.full_name?.[0] || seller.profile.username?.[0] || 'S'}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link to={`/u/${seller.profile.username}`} className="hover:underline">
                        <h3 className="font-semibold text-foreground truncate">
                          {seller.profile.full_name || seller.profile.creator_name || seller.profile.username}
                        </h3>
                      </Link>
                      <p className="text-sm text-muted-foreground truncate">@{seller.profile.username}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Globe className="h-3 w-3" />
                          <span>{seller.timezone}</span>
                        </div>
                        {seller.booking_mode === 'open_request' && (
                          <Badge variant="outline" className="text-xs">
                            <MessageSquareText className="h-3 w-3 mr-1" />
                            Open Request
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pb-4">
                  {/* Meeting pitch or bio */}
                  {(seller.meeting_pitch || seller.profile.bio) && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {seller.meeting_pitch || seller.profile.bio}
                    </p>
                  )}

                  {/* Trust signals: Products, Sales, Achievements */}
                  <div className="flex flex-wrap items-center gap-3 mb-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      <span>{seller.product_count || 0} product{seller.product_count !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ShoppingBag className="h-3 w-3" />
                      <span>{seller.sales_count || 0} sale{seller.sales_count !== 1 ? 's' : ''}</span>
                    </div>
                    {seller.achievements && seller.achievements.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Trophy className="h-3 w-3 text-amber-500" />
                        <span className="text-amber-600">{seller.achievements.length} achievement{seller.achievements.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>

                  {/* Achievement badges */}
                  {seller.achievements && seller.achievements.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {seller.achievements.slice(0, 3).map((ach, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs bg-amber-50 border-amber-200 text-amber-700">
                          <Trophy className="h-2.5 w-2.5 mr-1" />
                          {ach.title}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  {/* Meeting Types or Open Request Info */}
                  <div className="space-y-2">
                    {seller.booking_mode === 'calendar' ? (
                      <>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Available Meetings</p>
                        <div className="flex flex-wrap gap-2">
                          {seller.meeting_types.slice(0, 3).map((type) => (
                            <Badge 
                              key={type.id} 
                              variant={type.is_paid ? "default" : "secondary"}
                              className="text-xs"
                            >
                              <Clock className="h-3 w-3 mr-1" />
                              {type.duration_minutes}min
                              {type.is_paid ? ` - $${type.price}` : ' - Free'}
                              {type.is_group && ' (Group)'}
                            </Badge>
                          ))}
                          {seller.meeting_types.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{seller.meeting_types.length - 3} more
                            </Badge>
                          )}
                          {seller.meeting_types.length === 0 && (
                            <p className="text-xs text-muted-foreground">No meeting types defined</p>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Open Requests</p>
                        <p className="text-xs text-muted-foreground">
                          This seller accepts open meeting requests. Submit your preferred date/time and they will confirm.
                        </p>
                      </>
                    )}
                  </div>
                </CardContent>
                
                <CardFooter className="flex gap-2 pt-4 border-t">
                  <Button 
                    className="flex-1"
                    onClick={() => handleBookMeeting(seller)}
                    disabled={!canBookSeller(seller)}
                  >
                    {seller.booking_mode === 'open_request' ? (
                      <>
                        <MessageSquareText className="h-4 w-4 mr-2" />
                        Request Meeting
                      </>
                    ) : (
                      <>
                        <Calendar className="h-4 w-4 mr-2" />
                        Book Meeting
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="icon" asChild>
                    <Link to={`/u/${seller.profile.username}`}>
                      <User className="h-4 w-4" />
                    </Link>
                  </Button>
                  {user && (
                    <Button variant="outline" size="icon" asChild>
                      <Link to={`/messages?seller=${seller.seller_id}`}>
                        <MessageSquare className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Full Calendar View Dialog for Direct Booking */}
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
