import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SellerSidebar } from '@/components/SellerSidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format, parseISO, isPast, isToday, isThisWeek, isThisMonth, addDays } from 'date-fns';
import { SellerMeetingsSettings } from '@/components/meetings/SellerMeetingsSettings';
import { SellerCalendar } from '@/components/meetings/SellerCalendar';
import { 
  Calendar, 
  Check, 
  Clock, 
  Video, 
  X, 
  AlertCircle,
  CalendarDays,
  Phone,
  Mail,
  Settings,
  Users,
  Filter
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
  participants?: {
    user_id: string;
    role: string;
    user?: {
      username: string;
      full_name: string;
      avatar_url: string;
    };
  }[];
}

export default function SellerMeetings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MeetingRequest | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [deadlineDialogOpen, setDeadlineDialogOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [deliveryDeadline, setDeliveryDeadline] = useState('');

  // Fetch seller meeting config for calendar visibility
  const { data: meetingConfig } = useQuery({
    queryKey: ['seller-meeting-config', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('seller_meeting_configs')
        .select('*')
        .eq('seller_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  // Update calendar visibility
  const updateVisibilityMutation = useMutation({
    mutationFn: async (visibility: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('seller_meeting_configs')
        .upsert({
          seller_id: user.id,
          calendar_visibility: visibility
        }, { onConflict: 'seller_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Calendar visibility updated');
      queryClient.invalidateQueries({ queryKey: ['seller-meeting-config'] });
    },
    onError: (error: any) => {
      toast.error('Failed to update visibility', { description: error.message });
    }
  });

  // Fetch pending meeting requests
  const { data: pendingRequests, isLoading: requestsLoading } = useQuery({
    queryKey: ['seller-meeting-requests', user?.id],
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
    enabled: !!user
  });

  // Fetch all meetings
  const { data: meetings, isLoading: meetingsLoading } = useQuery({
    queryKey: ['seller-meetings', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('meetings')
        .select(`
          *,
          meeting_type:meeting_types(name, is_paid, price)
        `)
        .eq('seller_id', user.id)
        .order('meeting_date', { ascending: true });

      if (error) throw error;

      // Get participants with profiles
      const meetingIds = data?.map(m => m.id) || [];
      if (meetingIds.length > 0) {
        const { data: participants } = await supabase
          .from('meeting_participants')
          .select('meeting_id, user_id, role')
          .in('meeting_id', meetingIds)
          .neq('role', 'seller');

        const userIds = [...new Set(participants?.map(p => p.user_id) || [])];
        const { data: users } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', userIds);

        return data?.map(meeting => ({
          ...meeting,
          participants: participants?.filter(p => p.meeting_id === meeting.id).map(p => ({
            ...p,
            user: users?.find(u => u.id === p.user_id)
          }))
        })) as Meeting[];
      }

      return data as Meeting[];
    },
    enabled: !!user
  });

  // Accept meeting request
  const acceptMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const request = pendingRequests?.find(r => r.id === requestId);
      if (!request) throw new Error('Request not found');

      const { error: updateError } = await supabase
        .from('meeting_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (updateError) throw updateError;

      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          request_id: requestId,
          meeting_type_id: request.meeting_type_id,
          seller_id: request.seller_id,
          meeting_date: request.requested_date,
          meeting_time: request.requested_time,
          duration_minutes: request.meeting_type?.duration_minutes || 30,
          meeting_platform: request.meeting_method || 'google_meet',
          status: 'scheduled'
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      await supabase.from('meeting_participants').insert([
        { meeting_id: meeting.id, user_id: request.seller_id, role: 'seller' },
        { meeting_id: meeting.id, user_id: request.buyer_id, role: 'buyer' }
      ]);

      return meeting;
    },
    onSuccess: () => {
      toast.success('Meeting request accepted!');
      queryClient.invalidateQueries({ queryKey: ['seller-meeting-requests'] });
      queryClient.invalidateQueries({ queryKey: ['seller-meetings'] });
    },
    onError: (error: any) => {
      toast.error('Failed to accept request', { description: error.message });
    }
  });

  // Decline meeting request
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
    },
    onSuccess: () => {
      toast.success('Meeting request declined');
      setDeclineDialogOpen(false);
      setSelectedRequest(null);
      setDeclineReason('');
      queryClient.invalidateQueries({ queryKey: ['seller-meeting-requests'] });
    },
    onError: (error: any) => {
      toast.error('Failed to decline request', { description: error.message });
    }
  });

  // Set delivery deadline
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
      queryClient.invalidateQueries({ queryKey: ['seller-meetings'] });
    },
    onError: (error: any) => {
      toast.error('Failed to set deadline', { description: error.message });
    }
  });

  // Mark as delivered
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
      queryClient.invalidateQueries({ queryKey: ['seller-meetings'] });
    },
    onError: (error: any) => {
      toast.error('Failed to mark as delivered', { description: error.message });
    }
  });

  // Filter meetings by date
  const filterMeetings = (meetingsList: Meeting[] | undefined) => {
    if (!meetingsList) return [];
    
    return meetingsList.filter(meeting => {
      const meetingDate = parseISO(meeting.meeting_date);
      
      switch (dateFilter) {
        case 'today':
          return isToday(meetingDate);
        case 'week':
          return isThisWeek(meetingDate);
        case 'month':
          return isThisMonth(meetingDate);
        default:
          return true;
      }
    });
  };

  const upcomingMeetings = filterMeetings(meetings?.filter(m => 
    !isPast(parseISO(`${m.meeting_date}T${m.meeting_time}`)) && 
    m.status === 'scheduled'
  ));
  
  const pastMeetings = filterMeetings(meetings?.filter(m => 
    isPast(parseISO(`${m.meeting_date}T${m.meeting_time}`)) || 
    m.status === 'completed'
  ));

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

  const getMeetingMethodIcon = (method: string | null) => {
    switch (method) {
      case 'phone':
        return <Phone className="h-4 w-4" />;
      case 'zoom':
      case 'teams':
      case 'google_meet':
        return <Video className="h-4 w-4" />;
      default:
        return <Video className="h-4 w-4" />;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>Please sign in to manage your meetings.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <SellerSidebar />
        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Meetings</h1>
                <p className="text-muted-foreground">Manage your meeting requests and scheduled sessions.</p>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="overview">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="pending">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Pending
                  {pendingRequests && pendingRequests.length > 0 && (
                    <Badge variant="destructive" className="ml-2">{pendingRequests.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="upcoming">
                  <Calendar className="h-4 w-4 mr-2" />
                  Upcoming
                </TabsTrigger>
                <TabsTrigger value="past">
                  <Clock className="h-4 w-4 mr-2" />
                  Past
                </TabsTrigger>
                <TabsTrigger value="settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview">
                <div className="grid gap-4 md:grid-cols-3 mb-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{pendingRequests?.length || 0}</div>
                      <p className="text-xs text-muted-foreground">Awaiting your response</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Upcoming Meetings</CardTitle>
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{meetings?.filter(m => m.status === 'scheduled').length || 0}</div>
                      <p className="text-xs text-muted-foreground">Scheduled sessions</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Completed</CardTitle>
                      <Check className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{meetings?.filter(m => m.status === 'completed').length || 0}</div>
                      <p className="text-xs text-muted-foreground">This month</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Calendar View */}
                <div className="mb-6">
                  <SellerCalendar 
                    calendarVisibility={meetingConfig?.calendar_visibility || 'private'}
                    onVisibilityChange={(visibility) => updateVisibilityMutation.mutate(visibility)}
                  />
                </div>

                {pendingRequests && pendingRequests.length > 0 && (
                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle className="text-lg">Recent Pending Requests</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {pendingRequests.slice(0, 3).map((request) => (
                          <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-4">
                              <Avatar>
                                <AvatarImage src={request.buyer?.avatar_url} />
                                <AvatarFallback>{request.contact_name?.[0] || request.buyer?.full_name?.[0] || '?'}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{request.contact_name || request.buyer?.full_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {format(parseISO(request.requested_date), 'MMM d')} at {request.requested_time?.slice(0, 5)}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => acceptMutation.mutate(request.id)}>
                                <Check className="h-4 w-4 mr-1" /> Accept
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => {
                                setSelectedRequest(request);
                                setDeclineDialogOpen(true);
                              }}>
                                <X className="h-4 w-4 mr-1" /> Decline
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Pending Requests Tab */}
              <TabsContent value="pending">
                {requestsLoading ? (
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
                ) : pendingRequests?.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="font-semibold mb-2">No pending requests</h3>
                      <p className="text-muted-foreground">New meeting requests will appear here.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {pendingRequests?.map((request) => (
                      <Card key={request.id}>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                              <Avatar className="h-12 w-12">
                                <AvatarImage src={request.buyer?.avatar_url} />
                                <AvatarFallback>{request.contact_name?.[0] || request.buyer?.full_name?.[0] || '?'}</AvatarFallback>
                              </Avatar>
                              <div>
                                <CardTitle className="text-lg">
                                  {request.is_open_request ? 'Open Request' : request.meeting_type?.name}
                                </CardTitle>
                                <CardDescription>
                                  from {request.contact_name || request.buyer?.full_name}
                                </CardDescription>
                              </div>
                            </div>
                            {request.is_open_request && (
                              <Badge variant="outline">Open Request</Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span>{format(parseISO(request.requested_date), 'EEEE, MMMM d, yyyy')}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>{request.requested_time?.slice(0, 5)}</span>
                              </div>
                              {request.meeting_method && (
                                <div className="flex items-center gap-2 text-sm">
                                  {getMeetingMethodIcon(request.meeting_method)}
                                  <span className="capitalize">{request.meeting_method.replace('_', ' ')}</span>
                                </div>
                              )}
                            </div>
                            {request.is_open_request && (
                              <div className="space-y-2">
                                {request.contact_email && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <span>{request.contact_email}</span>
                                  </div>
                                )}
                                {request.contact_phone && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    <span>{request.contact_phone}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {request.buyer_message && (
                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-sm">{request.buyer_message}</p>
                            </div>
                          )}

                          <div className="flex gap-2 pt-2">
                            <Button onClick={() => acceptMutation.mutate(request.id)} disabled={acceptMutation.isPending}>
                              <Check className="h-4 w-4 mr-2" /> Accept
                            </Button>
                            <Button variant="outline" onClick={() => {
                              setSelectedRequest(request);
                              setDeclineDialogOpen(true);
                            }}>
                              <X className="h-4 w-4 mr-2" /> Decline
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Upcoming Meetings Tab */}
              <TabsContent value="upcoming">
                <div className="flex items-center justify-between mb-4">
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by date" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Upcoming</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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
                      <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="font-semibold mb-2">No upcoming meetings</h3>
                      <p className="text-muted-foreground">Accept meeting requests to schedule sessions.</p>
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
                                {format(parseISO(meeting.meeting_date), 'EEEE, MMMM d, yyyy')} at {meeting.meeting_time?.slice(0, 5)}
                              </CardDescription>
                            </div>
                            {getStatusBadge(meeting.status)}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-4 mb-4">
                            {meeting.participants?.map((p) => (
                              <div key={p.user_id} className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={p.user?.avatar_url} />
                                  <AvatarFallback>{p.user?.full_name?.[0]}</AvatarFallback>
                                </Avatar>
                                <div className="text-sm">
                                  <p className="font-medium">{p.user?.full_name}</p>
                                  <p className="text-xs text-muted-foreground capitalize">{p.role}</p>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="flex gap-2">
                            {meeting.meeting_link && (
                              <Button asChild>
                                <a href={meeting.meeting_link} target="_blank" rel="noopener noreferrer">
                                  <Video className="h-4 w-4 mr-2" /> Join Meeting
                                </a>
                              </Button>
                            )}
                            {!meeting.delivery_deadline && (
                              <Button variant="outline" onClick={() => {
                                setSelectedMeeting(meeting);
                                setDeliveryDeadline(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
                                setDeadlineDialogOpen(true);
                              }}>
                                Set Deadline
                              </Button>
                            )}
                            {meeting.delivery_deadline && meeting.delivery_status === 'pending' && (
                              <Button variant="outline" onClick={() => markDeliveredMutation.mutate(meeting.id)}>
                                <Check className="h-4 w-4 mr-2" /> Mark Delivered
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Past Meetings Tab */}
              <TabsContent value="past">
                <div className="flex items-center justify-between mb-4">
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by date" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {pastMeetings?.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="font-semibold mb-2">No past meetings</h3>
                      <p className="text-muted-foreground">Completed meetings will appear here.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {pastMeetings?.map((meeting) => (
                      <Card key={meeting.id}>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg">{meeting.meeting_type?.name}</CardTitle>
                              <CardDescription>
                                {format(parseISO(meeting.meeting_date), 'EEEE, MMMM d, yyyy')} at {meeting.meeting_time?.slice(0, 5)}
                              </CardDescription>
                            </div>
                            <div className="flex gap-2">
                              {getStatusBadge(meeting.status)}
                              {meeting.delivery_status && (
                                <Badge variant={meeting.delivery_status === 'delivered' ? 'default' : 'secondary'}>
                                  {meeting.delivery_status === 'delivered' ? 'Delivered' : 'Pending Delivery'}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings">
                <SellerMeetingsSettings />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* Decline Dialog */}
      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Meeting Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for declining this request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason</Label>
              <Textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="e.g., Time slot not available, please suggest an alternative..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => selectedRequest && declineMutation.mutate({ requestId: selectedRequest.id, reason: declineReason })}
              disabled={declineMutation.isPending}
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
              <Label>Deadline Date</Label>
              <Input
                type="date"
                value={deliveryDeadline}
                onChange={(e) => setDeliveryDeadline(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeadlineDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => selectedMeeting && setDeadlineMutation.mutate({ meetingId: selectedMeeting.id, deadline: deliveryDeadline })}
              disabled={setDeadlineMutation.isPending}
            >
              Set Deadline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}