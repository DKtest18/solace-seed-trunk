import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format, parseISO, isPast, addDays } from 'date-fns';
import { MeetingAssetsSection } from '@/components/meetings/MeetingAssetsSection';
import { 
  Calendar, 
  Check, 
  Clock, 
  ExternalLink, 
  MessageSquare, 
  Video, 
  X, 
  AlertCircle,
  CalendarDays,
  Package,
  Phone,
  Mail,
  MessageSquareText
} from 'lucide-react';

interface MeetingRequest {
  id: string;
  meeting_type_id: string | null;
  seller_id: string;
  buyer_id: string;
  requested_date: string;
  requested_time: string;
  buyer_timezone: string;
  buyer_message: string | null;
  status: string;
  declined_reason: string | null;
  created_at: string;
  is_open_request: boolean;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  meeting_method: string | null;
  consent_to_contact: boolean;
  seller_proposed_date: string | null;
  seller_proposed_time: string | null;
  seller_proposed_method: string | null;
  seller_set_price: number | null;
  requires_payment: boolean;
  meeting_type: {
    name: string;
    duration_minutes: number;
    is_paid: boolean;
    price: number;
  } | null;
  seller?: {
    username: string;
    full_name: string;
    avatar_url: string;
  };
  buyer?: {
    username: string;
    full_name: string;
    avatar_url: string;
  };
}

interface Meeting {
  id: string;
  meeting_date: string;
  meeting_time: string;
  duration_minutes: number;
  meeting_link: string | null;
  meeting_platform: string | null;
  meeting_platform_type: string | null;
  room_id: string | null;
  status: string;
  delivery_deadline: string | null;
  delivery_status: string | null;
  notes: string | null;
  seller_id: string;
  meeting_type: {
    name: string;
    is_paid: boolean;
    price: number;
  };
  seller?: {
    username: string;
    full_name: string;
    avatar_url: string;
  };
  buyer?: {
    username: string;
    full_name: string;
    avatar_url: string;
  };
  meeting_room?: {
    id: string;
    room_code: string;
    join_slug: string;
    status: string;
  } | null;
}

export default function MyMeetings() {
  const { user } = useAuth();
  const { hasRole: isSeller } = useHasRole('seller');
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('upcoming');
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MeetingRequest | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [deadlineDialogOpen, setDeadlineDialogOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [deliveryDeadline, setDeliveryDeadline] = useState('');

  // Fetch meeting requests (as buyer)
  const { data: buyerRequests, isLoading: buyerRequestsLoading } = useQuery({
    queryKey: ['my-meeting-requests-buyer', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('meeting_requests')
        .select(`
          *,
          meeting_type:meeting_types(name, duration_minutes, is_paid, price)
        `)
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get seller profiles
      const sellerIds = [...new Set(data?.map(r => r.seller_id) || [])];
      if (sellerIds.length > 0) {
        const { data: sellers } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', sellerIds);

        return data?.map(req => ({
          ...req,
          seller: sellers?.find(s => s.id === req.seller_id)
        })) as MeetingRequest[];
      }

      return data as MeetingRequest[];
    },
    enabled: !!user
  });

  // Fetch meeting requests (as seller)
  const { data: sellerRequests, isLoading: sellerRequestsLoading } = useQuery({
    queryKey: ['my-meeting-requests-seller', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('meeting_requests')
        .select(`
          *,
          meeting_type:meeting_types(name, duration_minutes, is_paid, price)
        `)
        .eq('seller_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get buyer profiles
      const buyerIds = [...new Set(data?.map(r => r.buyer_id) || [])];
      if (buyerIds.length > 0) {
        const { data: buyers } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', buyerIds);

        return data?.map(req => ({
          ...req,
          buyer: buyers?.find(b => b.id === req.buyer_id)
        })) as MeetingRequest[];
      }

      return data as MeetingRequest[];
    },
    enabled: !!user && isSeller
  });

  // Fetch confirmed meetings
  const { data: meetings, isLoading: meetingsLoading } = useQuery({
    queryKey: ['my-meetings', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Get meetings where user is a participant
      const { data: participantData, error: participantError } = await supabase
        .from('meeting_participants')
        .select('meeting_id')
        .eq('user_id', user.id);

      if (participantError) throw participantError;

      const meetingIds = participantData?.map(p => p.meeting_id) || [];
      
      if (meetingIds.length === 0) return [];

      const { data, error } = await supabase
        .from('meetings')
        .select(`
          *,
          meeting_type:meeting_types(name, is_paid, price),
          meeting_room:meeting_rooms(id, room_code, join_slug, status)
        `)
        .in('id', meetingIds)
        .order('meeting_date', { ascending: true });

      if (error) throw error;

      // Get participant profiles
      const sellerIds = [...new Set(data?.map(m => m.seller_id) || [])];
      if (sellerIds.length > 0) {
        const { data: sellers } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', sellerIds);

        return data?.map(meeting => ({
          ...meeting,
          seller: sellers?.find(s => s.id === meeting.seller_id)
        })) as Meeting[];
      }

      return data as Meeting[];
    },
    enabled: !!user
  });

  // Accept meeting request mutation
  const acceptMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const request = sellerRequests?.find(r => r.id === requestId);
      if (!request) throw new Error('Request not found');

      // Update request status
      const { error: updateError } = await supabase
        .from('meeting_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Determine platform from request
      const platform = request.meeting_method || 'google_meet';
      const isDKAIMeeting = platform === 'dk_ai_meeting';

      // Create meeting
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          request_id: requestId,
          meeting_type_id: request.meeting_type_id,
          seller_id: request.seller_id,
          meeting_date: request.requested_date,
          meeting_time: request.requested_time,
          duration_minutes: request.meeting_type?.duration_minutes || 30,
          meeting_platform: platform,
          meeting_platform_type: isDKAIMeeting ? 'website' : 'external',
          status: 'scheduled'
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      // Add participants
      await supabase.from('meeting_participants').insert([
        { meeting_id: meeting.id, user_id: request.seller_id, role: 'seller' },
        { meeting_id: meeting.id, user_id: request.buyer_id, role: 'buyer' }
      ]);

      // If DK AI Meeting, create the meeting room
      if (isDKAIMeeting) {
        const { error: roomError } = await supabase.functions.invoke('create-meeting-room', {
          body: { meeting_id: meeting.id }
        });
        
        if (roomError) {
          console.error('Failed to create meeting room:', roomError);
          // Don't fail the whole operation, room can be created later
        }
      }

      return meeting;
    },
    onSuccess: () => {
      toast.success('Meeting request accepted!');
      queryClient.invalidateQueries({ queryKey: ['my-meeting-requests-seller'] });
      queryClient.invalidateQueries({ queryKey: ['my-meetings'] });
    },
    onError: (error: any) => {
      toast.error('Failed to accept request', { description: error.message });
    }
  });

  // Decline meeting request mutation
  const declineMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const { error } = await supabase
        .from('meeting_requests')
        .update({ 
          status: 'declined',
          declined_reason: reason 
        })
        .eq('id', requestId);

      if (error) throw error;

      // TODO: If paid meeting, trigger refund
    },
    onSuccess: () => {
      toast.success('Meeting request declined');
      setDeclineDialogOpen(false);
      setSelectedRequest(null);
      setDeclineReason('');
      queryClient.invalidateQueries({ queryKey: ['my-meeting-requests-seller'] });
    },
    onError: (error: any) => {
      toast.error('Failed to decline request', { description: error.message });
    }
  });

  // Set delivery deadline mutation
  const setDeadlineMutation = useMutation({
    mutationFn: async ({ meetingId, deadline }: { meetingId: string; deadline: string }) => {
      const { error } = await supabase
        .from('meetings')
        .update({ 
          delivery_deadline: deadline,
          delivery_status: 'pending'
        })
        .eq('id', meetingId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Delivery deadline set!');
      setDeadlineDialogOpen(false);
      setSelectedMeeting(null);
      setDeliveryDeadline('');
      queryClient.invalidateQueries({ queryKey: ['my-meetings'] });
    },
    onError: (error: any) => {
      toast.error('Failed to set deadline', { description: error.message });
    }
  });

  // Mark as delivered mutation
  const markDeliveredMutation = useMutation({
    mutationFn: async (meetingId: string) => {
      const { error } = await supabase
        .from('meetings')
        .update({ 
          delivery_status: 'delivered',
          delivered_at: new Date().toISOString(),
          status: 'completed'
        })
        .eq('id', meetingId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Marked as delivered!');
      queryClient.invalidateQueries({ queryKey: ['my-meetings'] });
    },
    onError: (error: any) => {
      toast.error('Failed to mark as delivered', { description: error.message });
    }
  });

  const upcomingMeetings = meetings?.filter(m => 
    !isPast(parseISO(`${m.meeting_date}T${m.meeting_time}`)) && 
    m.status === 'scheduled'
  );
  const pastMeetings = meetings?.filter(m => 
    isPast(parseISO(`${m.meeting_date}T${m.meeting_time}`)) || 
    m.status === 'completed'
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'secondary', label: 'Pending' },
      accepted: { variant: 'default', label: 'Accepted' },
      declined: { variant: 'destructive', label: 'Declined' },
      cancelled: { variant: 'outline', label: 'Cancelled' },
      scheduled: { variant: 'default', label: 'Scheduled' },
      completed: { variant: 'secondary', label: 'Completed' },
      no_show: { variant: 'destructive', label: 'No Show' }
    };
    const config = variants[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>Please sign in to view your meetings.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link to="/login?redirect=/my-meetings">Sign In</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">My Meetings</h1>
            <p className="text-muted-foreground">Manage your meeting requests and scheduled sessions.</p>
          </div>
          <Button asChild>
            <Link to="/meetings">
              <Calendar className="h-4 w-4 mr-2" />
              Book New Meeting
            </Link>
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="upcoming">
              <CalendarDays className="h-4 w-4 mr-2" />
              Upcoming
              {upcomingMeetings && upcomingMeetings.length > 0 && (
                <Badge variant="secondary" className="ml-2">{upcomingMeetings.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="requests">
              <MessageSquare className="h-4 w-4 mr-2" />
              My Requests
            </TabsTrigger>
            {isSeller && (
              <TabsTrigger value="pending">
                <AlertCircle className="h-4 w-4 mr-2" />
                Pending Approval
                {sellerRequests && sellerRequests.length > 0 && (
                  <Badge variant="destructive" className="ml-2">{sellerRequests.length}</Badge>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="past">
              <Clock className="h-4 w-4 mr-2" />
              Past
            </TabsTrigger>
          </TabsList>

          {/* Upcoming Meetings */}
          <TabsContent value="upcoming">
            {meetingsLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : upcomingMeetings?.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No upcoming meetings</h3>
                  <p className="text-muted-foreground mb-4">Book a meeting with a seller to get started.</p>
                  <Button asChild>
                    <Link to="/meetings">Browse Sellers</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {upcomingMeetings?.map((meeting) => (
                  <Card key={meeting.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{meeting.meeting_type?.name}</CardTitle>
                          <CardDescription>
                            {format(parseISO(meeting.meeting_date), 'EEEE, MMMM d, yyyy')} at {meeting.meeting_time.slice(0, 5)}
                          </CardDescription>
                        </div>
                        {getStatusBadge(meeting.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4">
                        {meeting.seller && (
                          <Link to={`/u/${meeting.seller.username}`} className="flex items-center gap-2">
                            <Avatar>
                              <AvatarImage src={meeting.seller.avatar_url} />
                              <AvatarFallback>{meeting.seller.full_name?.[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{meeting.seller.full_name}</p>
                              <p className="text-xs text-muted-foreground">@{meeting.seller.username}</p>
                            </div>
                          </Link>
                        )}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          {meeting.duration_minutes} minutes
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex gap-2 flex-wrap">
                      {/* DK AI Meeting - hosted on website */}
                      {(meeting.meeting_platform === 'dk_ai_meeting' || meeting.meeting_platform_type === 'website') && meeting.meeting_room?.room_code && (
                        <Button asChild className="bg-primary">
                          <Link to={`/meeting-room/${meeting.meeting_room.room_code}`}>
                            <Video className="h-4 w-4 mr-2" />
                            Join DK AI Meeting
                          </Link>
                        </Button>
                      )}
                      {/* External meeting link */}
                      {meeting.meeting_link && meeting.meeting_platform !== 'dk_ai_meeting' && (
                        <Button asChild>
                          <a href={meeting.meeting_link} target="_blank" rel="noopener noreferrer">
                            <Video className="h-4 w-4 mr-2" />
                            Join Meeting
                            <ExternalLink className="h-4 w-4 ml-2" />
                          </a>
                        </Button>
                      )}
                      {/* No room yet for DK AI Meeting - show status */}
                      {meeting.meeting_platform === 'dk_ai_meeting' && !meeting.meeting_room?.room_code && (
                        <Badge variant="outline" className="text-muted-foreground">
                          <Clock className="h-3 w-3 mr-1" />
                          Room being prepared...
                        </Badge>
                      )}
                      {user.id === meeting.seller_id && !meeting.delivery_deadline && (
                        <Button 
                          variant="outline"
                          onClick={() => {
                            setSelectedMeeting(meeting);
                            setDeadlineDialogOpen(true);
                          }}
                        >
                          <Package className="h-4 w-4 mr-2" />
                          Set Deadline
                        </Button>
                      )}
                      {meeting.delivery_deadline && (
                        <div className="flex items-center gap-2 text-sm">
                          <Package className="h-4 w-4" />
                          Deadline: {format(parseISO(meeting.delivery_deadline), 'MMM d, yyyy')}
                          {user.id === meeting.seller_id && meeting.delivery_status !== 'delivered' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => markDeliveredMutation.mutate(meeting.id)}
                              disabled={markDeliveredMutation.isPending}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Mark Delivered
                            </Button>
                          )}
                        </div>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* My Requests (as buyer) */}
          <TabsContent value="requests">
            {buyerRequestsLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : buyerRequests?.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No meeting requests</h3>
                  <p className="text-muted-foreground mb-4">You haven't requested any meetings yet.</p>
                  <Button asChild>
                    <Link to="/meetings">Book a Meeting</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {buyerRequests?.map((request) => (
                  <Card key={request.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {request.is_open_request ? (
                              <>
                                <MessageSquareText className="h-5 w-5" />
                                Open Meeting Request
                              </>
                            ) : (
                              request.meeting_type?.name || 'Meeting Request'
                            )}
                          </CardTitle>
                          <CardDescription>
                            Requested for {format(parseISO(request.requested_date), 'EEEE, MMMM d, yyyy')} at {request.requested_time.slice(0, 5)}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {request.is_open_request && (
                            <Badge variant="outline">Open Request</Badge>
                          )}
                          {getStatusBadge(request.status)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {request.seller && (
                        <Link to={`/u/${request.seller.username}`} className="flex items-center gap-2 w-fit">
                          <Avatar>
                            <AvatarImage src={request.seller.avatar_url} />
                            <AvatarFallback>{request.seller.full_name?.[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{request.seller.full_name}</p>
                            <p className="text-xs text-muted-foreground">@{request.seller.username}</p>
                          </div>
                        </Link>
                      )}
                      {request.buyer_message && (
                        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                          <p className="text-sm">{request.buyer_message}</p>
                        </div>
                      )}
                      {request.declined_reason && (
                        <div className="mt-4 p-3 bg-destructive/10 rounded-lg">
                          <p className="text-sm text-destructive">Declined: {request.declined_reason}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Pending Approval (as seller) */}
          {isSeller && (
            <TabsContent value="pending">
              {sellerRequestsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i}>
                      <CardHeader>
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-32" />
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              ) : sellerRequests?.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">No pending requests</h3>
                    <p className="text-muted-foreground">No meeting requests awaiting your approval.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {sellerRequests?.map((request) => (
                    <Card key={request.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              {request.is_open_request ? (
                                <>
                                  <MessageSquareText className="h-5 w-5" />
                                  Open Meeting Request
                                </>
                              ) : (
                                request.meeting_type?.name || 'Meeting Request'
                              )}
                            </CardTitle>
                            <CardDescription>
                              {format(parseISO(request.requested_date), 'EEEE, MMMM d, yyyy')} at {request.requested_time.slice(0, 5)}
                            </CardDescription>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {request.is_open_request && (
                              <Badge variant="outline">
                                <MessageSquareText className="h-3 w-3 mr-1" />
                                Open Request
                              </Badge>
                            )}
                            {!request.is_open_request && request.meeting_type && (
                              <Badge variant="secondary">
                                {request.meeting_type.is_paid ? `$${request.meeting_type.price}` : 'Free'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Buyer info */}
                        {request.buyer && (
                          <Link to={`/u/${request.buyer.username}`} className="flex items-center gap-2 w-fit">
                            <Avatar>
                              <AvatarImage src={request.buyer.avatar_url} />
                              <AvatarFallback>{request.buyer.full_name?.[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{request.buyer.full_name}</p>
                              <p className="text-xs text-muted-foreground">@{request.buyer.username}</p>
                            </div>
                          </Link>
                        )}
                        
                        {/* Open request specific info */}
                        {request.is_open_request && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">Contact Information</p>
                              {request.contact_name && (
                                <p className="text-sm font-medium">{request.contact_name}</p>
                              )}
                              {request.contact_email && (
                                <p className="text-sm flex items-center gap-2">
                                  <Mail className="h-3 w-3 text-muted-foreground" />
                                  {request.contact_email}
                                </p>
                              )}
                              {request.contact_phone && (
                                <p className="text-sm flex items-center gap-2">
                                  <Phone className="h-3 w-3 text-muted-foreground" />
                                  {request.contact_phone}
                                </p>
                              )}
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">Meeting Details</p>
                              {request.meeting_method && (
                                <Badge variant="outline" className="capitalize">
                                  {request.meeting_method === 'phone' ? (
                                    <><Phone className="h-3 w-3 mr-1" /> Phone Call</>
                                  ) : (
                                    <><Video className="h-3 w-3 mr-1" /> {request.meeting_method.replace('_', ' ')}</>
                                  )}
                                </Badge>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Timezone: {request.buyer_timezone}
                              </p>
                            </div>
                          </div>
                        )}
                        
                        {request.buyer_message && (
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Message from buyer:</p>
                            <p className="text-sm">{request.buyer_message}</p>
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="flex gap-2">
                        <Button 
                          onClick={() => acceptMutation.mutate(request.id)}
                          disabled={acceptMutation.isPending}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Accept
                        </Button>
                        <Button 
                          variant="destructive"
                          onClick={() => {
                            setSelectedRequest(request);
                            setDeclineDialogOpen(true);
                          }}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Decline
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {/* Past Meetings */}
          <TabsContent value="past">
            {meetingsLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : pastMeetings?.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No past meetings</h3>
                  <p className="text-muted-foreground">Your completed meetings will appear here.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {pastMeetings?.map((meeting) => (
                  <Card key={meeting.id} className="opacity-75">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{meeting.meeting_type?.name}</CardTitle>
                          <CardDescription>
                            {format(parseISO(meeting.meeting_date), 'EEEE, MMMM d, yyyy')} at {meeting.meeting_time.slice(0, 5)}
                          </CardDescription>
                        </div>
                        {getStatusBadge(meeting.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {meeting.seller && (
                        <Link to={`/u/${meeting.seller.username}`} className="flex items-center gap-2 w-fit mb-3">
                          <Avatar>
                            <AvatarImage src={meeting.seller.avatar_url} />
                            <AvatarFallback>{meeting.seller.full_name?.[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{meeting.seller.full_name}</p>
                            <p className="text-xs text-muted-foreground">@{meeting.seller.username}</p>
                          </div>
                        </Link>
                      )}
                      {meeting.delivery_status === 'delivered' && (
                        <Badge variant="default" className="mb-2">
                          <Check className="h-3 w-3 mr-1" />
                          Delivered
                        </Badge>
                      )}
                    </CardContent>
                    <CardFooter className="flex gap-2 flex-wrap border-t pt-4">
                      <MeetingAssetsSection meetingId={meeting.id} />
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Decline Dialog */}
      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Meeting Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for declining this meeting request.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for declining..."
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => selectedRequest && declineMutation.mutate({ 
                requestId: selectedRequest.id, 
                reason: declineReason 
              })}
              disabled={!declineReason || declineMutation.isPending}
            >
              Decline Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deadline Dialog */}
      <Dialog open={deadlineDialogOpen} onOpenChange={setDeadlineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Delivery Deadline</DialogTitle>
            <DialogDescription>
              Set a deadline for delivering the work discussed in this meeting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="deadline">Delivery Deadline</Label>
              <Input
                id="deadline"
                type="date"
                value={deliveryDeadline}
                onChange={(e) => setDeliveryDeadline(e.target.value)}
                min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeadlineDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => selectedMeeting && setDeadlineMutation.mutate({ 
                meetingId: selectedMeeting.id, 
                deadline: deliveryDeadline 
              })}
              disabled={!deliveryDeadline || setDeadlineMutation.isPending}
            >
              Set Deadline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
