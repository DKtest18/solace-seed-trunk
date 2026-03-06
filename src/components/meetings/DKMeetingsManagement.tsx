import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { externalSupabase } from '@/lib/externalSupabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format, parseISO, isPast, isFuture } from 'date-fns';
import { 
  Check, 
  X, 
  Clock, 
  Calendar, 
  User, 
  Video, 
  Copy, 
  AlertCircle,
  MessageSquare,
  FileText
} from 'lucide-react';

// Interface matching dk_meetings2 table
interface DKMeeting {
  meeting_id: string;
  meeting_cod: string;
  buyer_name: string;
  buyer_id: string | null;
  seller_name: string;
  seller_id: string | null;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
  approved_at: string;
  ended_at: string;
}

// Interface for post-meeting storage data
interface DKMeetingStorage {
  id: string;
  meeting_id: string;
  audio_recording_url: string | null;
  video_recording_url: string | null;
  transcript_url: string | null;
  ai_summary: string | null;
  notes_buyer: string | null;
  notes_seller: string | null;
}

export function DKMeetingsManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<DKMeeting | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [sellerNotes, setSellerNotes] = useState('');

  // Fetch DK AI Meetings for this seller from dk_meetings2
  const { data: dkMeetings, isLoading } = useQuery({
    queryKey: ['dk-meetings-seller', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Query by seller_id for reliable matching
      const { data, error } = await externalSupabase
        .from('dk_meetings2')
        .select('*')
        .eq('seller_id', user.id)
        .order('start_time', { ascending: false });

      if (error) throw error;
      return data as DKMeeting[];
    },
    enabled: !!user
  });

  // Storage data not available for dk_meetings2 yet - placeholder
  const meetingStorage: Record<string, DKMeetingStorage> = {};

  // Realtime subscription for status updates
  useEffect(() => {
    if (!user) return;
    
    const channel = externalSupabase
      .channel('dk-meetings-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dk_meetings2'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['dk-meetings-seller'] });
        }
      )
      .subscribe();

    return () => {
      externalSupabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  // Accept meeting - updates dk_meetings2
  const acceptMutation = useMutation({
    mutationFn: async (meetingId: string) => {
      const { error } = await externalSupabase
        .from('dk_meetings2')
        .update({ status: 'accepted', approved_at: new Date().toISOString() })
        .eq('meeting_id', meetingId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Meeting accepted!');
      queryClient.invalidateQueries({ queryKey: ['dk-meetings-seller'] });
    },
    onError: (error: any) => {
      toast.error('Failed to accept meeting', { description: error.message });
    }
  });

  // Decline meeting - updates dk_meetings2
  const declineMutation = useMutation({
    mutationFn: async ({ meetingId, reason }: { meetingId: string; reason: string }) => {
      const { error } = await externalSupabase
        .from('dk_meetings2')
        .update({ status: 'declined' })
        .eq('meeting_id', meetingId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Meeting declined');
      setDeclineDialogOpen(false);
      setSelectedMeeting(null);
      setDeclineReason('');
      queryClient.invalidateQueries({ queryKey: ['dk-meetings-seller'] });
    },
    onError: (error: any) => {
      toast.error('Failed to decline meeting', { description: error.message });
    }
  });

  // Save seller notes - placeholder (dk_meetings2 doesn't have notes storage yet)
  const saveNotesMutation = useMutation({
    mutationFn: async ({ meetingId, notes }: { meetingId: string; notes: string }) => {
      // Notes storage not yet implemented for dk_meetings2
      toast.info('Notes feature coming soon');
    },
    onSuccess: () => {
      setNotesDialogOpen(false);
      setSelectedMeeting(null);
      setSellerNotes('');
    },
    onError: (error: any) => {
      toast.error('Failed to save notes', { description: error.message });
    }
  });

  const copyMeetingCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Meeting code copied!');
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'secondary', label: 'Pending' },
      accepted: { variant: 'default', label: 'Accepted' },
      declined: { variant: 'destructive', label: 'Declined' },
      ended: { variant: 'outline', label: 'Ended' },
      cancelled: { variant: 'destructive', label: 'Cancelled' }
    };
    const config = variants[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredMeetings = dkMeetings?.filter(m => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return m.status === 'pending';
    if (statusFilter === 'upcoming') return m.status === 'accepted' && isFuture(parseISO(m.start_time));
    if (statusFilter === 'past') return m.status === 'ended' || (m.status === 'accepted' && isPast(parseISO(m.end_time)));
    return m.status === statusFilter;
  });

  if (isLoading) {
    return (
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
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">DK AI Meetings</h2>
          <p className="text-sm text-muted-foreground">Manage meetings booked via DK AI Meeting platform</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Meetings</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="past">Past</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredMeetings?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No DK AI meetings</h3>
            <p className="text-muted-foreground">DK AI Meeting requests will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredMeetings?.map((meeting) => {
            const storage = meetingStorage?.[meeting.meeting_id];
            return (
              <Card key={meeting.meeting_id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Video className="h-5 w-5" />
                        {meeting.title}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <User className="h-4 w-4" />
                        {meeting.buyer_name}
                      </CardDescription>
                    </div>
                    {getStatusBadge(meeting.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{format(parseISO(meeting.start_time), 'EEEE, MMMM d, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {format(parseISO(meeting.start_time), 'h:mm a')} - {format(parseISO(meeting.end_time), 'h:mm a')}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Meeting Code:</span>
                        <code className="bg-muted px-2 py-1 rounded font-mono">{meeting.meeting_cod}</code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyMeetingCode(meeting.meeting_cod)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Meeting ID:</span>
                        <code className="bg-muted px-2 py-1 rounded font-mono text-xs">{meeting.meeting_id.slice(0, 8)}...</code>
                      </div>
                    </div>
                  </div>

                  {meeting.description && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm">{meeting.description}</p>
                    </div>
                  )}

                  {/* AI Summary if available (from DK_meeting_storage) */}
                  {storage?.ai_summary && (
                    <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">AI Summary</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{storage.ai_summary}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    {meeting.status === 'pending' && (
                      <>
                        <Button onClick={() => acceptMutation.mutate(meeting.meeting_id)} disabled={acceptMutation.isPending}>
                          <Check className="h-4 w-4 mr-2" /> Accept
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setSelectedMeeting(meeting);
                          setDeclineDialogOpen(true);
                        }}>
                          <X className="h-4 w-4 mr-2" /> Decline
                        </Button>
                      </>
                    )}
                    
                    {(meeting.status === 'accepted' || meeting.status === 'ended') && (
                      <Button variant="outline" onClick={() => {
                        setSelectedMeeting(meeting);
                        setSellerNotes(storage?.notes_seller || '');
                        setNotesDialogOpen(true);
                      }}>
                        <MessageSquare className="h-4 w-4 mr-2" /> Notes
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineDialogOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={() => selectedMeeting && declineMutation.mutate({ 
                meetingId: selectedMeeting.meeting_id, 
                reason: declineReason 
              })}
              disabled={declineMutation.isPending}
            >
              Decline Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Meeting Notes</DialogTitle>
            <DialogDescription>
              Add your private notes for this meeting.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Your notes..."
            value={sellerNotes}
            onChange={(e) => setSellerNotes(e.target.value)}
            rows={5}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => selectedMeeting && saveNotesMutation.mutate({ 
                meetingId: selectedMeeting.meeting_id, 
                notes: sellerNotes 
              })}
              disabled={saveNotesMutation.isPending}
            >
              Save Notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
