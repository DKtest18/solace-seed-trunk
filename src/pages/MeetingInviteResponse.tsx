import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Calendar, Clock, User, Users, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface InviteData {
  id: string;
  meeting_id: string;
  invitee_email: string;
  participant_role: string;
  status: string;
  message: string | null;
  expires_at: string;
  meeting: {
    id: string;
    meeting_date: string;
    meeting_time: string;
    duration_minutes: number;
    seller: {
      full_name: string | null;
      creator_name: string | null;
      avatar_url: string | null;
    } | null;
  } | null;
  inviter: {
    full_name: string | null;
    creator_name: string | null;
  } | null;
}

export default function MeetingInviteResponse() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [responded, setResponded] = useState(false);
  const [responseResult, setResponseResult] = useState<'accepted' | 'declined' | null>(null);
  
  // Consent preferences
  const [consentRecording, setConsentRecording] = useState(false);
  const [consentTranscript, setConsentTranscript] = useState(false);
  const [consentSummary, setConsentSummary] = useState(true);

  useEffect(() => {
    const fetchInvite = async () => {
      if (!token) {
        setError('Invalid invite link');
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('meeting_invites')
          .select(`
            *,
            meeting:meetings(
              id,
              meeting_date,
              meeting_time,
              duration_minutes,
              seller:profiles!meetings_seller_id_fkey(full_name, creator_name, avatar_url)
            ),
            inviter:profiles!meeting_invites_inviter_id_fkey(full_name, creator_name)
          `)
          .eq('invite_token', token)
          .single();

        if (fetchError || !data) {
          setError('Invite not found or invalid');
          setLoading(false);
          return;
        }

        setInvite(data as unknown as InviteData);

        // Check if already responded
        if (data.status !== 'pending') {
          setResponded(true);
          setResponseResult(data.status as 'accepted' | 'declined');
        }

        // Check if expired
        if (new Date(data.expires_at) < new Date()) {
          setError('This invite has expired');
        }
      } catch (err) {
        console.error('Error fetching invite:', err);
        setError('Failed to load invite');
      } finally {
        setLoading(false);
      }
    };

    fetchInvite();
  }, [token]);

  const handleResponse = async (response: 'accept' | 'decline') => {
    if (!token) return;
    
    setResponding(true);
    
    try {
      const { data, error: responseError } = await supabase.functions.invoke('respond-meeting-invite', {
        body: {
          invite_token: token,
          response,
          consent_recording: consentRecording,
          consent_transcript: consentTranscript,
          consent_summary: consentSummary
        }
      });

      if (responseError) {
        throw new Error(responseError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setResponded(true);
      setResponseResult(response === 'accept' ? 'accepted' : 'declined');
      toast.success(data?.message || `Invite ${response}ed successfully`);
    } catch (err: any) {
      console.error('Response error:', err);
      toast.error(err.message || 'Failed to respond to invite');
    } finally {
      setResponding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Loading invite...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <CardTitle>Invite Error</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => navigate('/')} className="w-full">
              Go to Homepage
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (responded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            {responseResult === 'accepted' ? (
              <>
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <CardTitle>You're In!</CardTitle>
                <CardDescription>
                  You've been added to the meeting. You'll receive a notification when it's time to join.
                </CardDescription>
              </>
            ) : (
              <>
                <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <CardTitle>Invite Declined</CardTitle>
                <CardDescription>
                  You've declined this meeting invitation.
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardFooter className="flex gap-2 justify-center">
            {responseResult === 'accepted' && (
              <Button onClick={() => navigate('/my-meetings')}>
                View My Meetings
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate('/')}>
              Go Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!invite) {
    return null;
  }

  const inviterName = invite.inviter?.full_name || invite.inviter?.creator_name || 'Someone';
  const sellerName = invite.meeting?.seller?.full_name || invite.meeting?.seller?.creator_name || 'Host';
  const meetingDate = invite.meeting?.meeting_date 
    ? format(new Date(invite.meeting.meeting_date), 'EEEE, MMMM d, yyyy')
    : 'Date TBD';
  const meetingTime = invite.meeting?.meeting_time || 'Time TBD';
  const roleDisplay = invite.participant_role.replace('_', ' ');

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-6 w-6 text-primary" />
            <CardTitle>Meeting Invitation</CardTitle>
          </div>
          <CardDescription>
            <strong>{inviterName}</strong> has invited you to join a meeting with <strong>{sellerName}</strong>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Meeting Details */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{meetingDate}</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{meetingTime} ({invite.meeting?.duration_minutes} minutes)</span>
            </div>
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>Your role: <span className="capitalize">{roleDisplay}</span></span>
            </div>
          </div>

          {/* Inviter's Message */}
          {invite.message && (
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Message from {inviterName}:</p>
              <p className="italic">"{invite.message}"</p>
            </div>
          )}

          <Separator />

          {/* Consent Preferences */}
          <div className="space-y-4">
            <h4 className="font-medium">Meeting Preferences</h4>
            <p className="text-sm text-muted-foreground">
              Please indicate your preferences for this meeting. Recording and transcription require consent from all participants.
            </p>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="recording"
                  checked={consentRecording}
                  onCheckedChange={(checked) => setConsentRecording(checked === true)}
                />
                <Label htmlFor="recording" className="text-sm font-normal">
                  I consent to meeting recording
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="transcript"
                  checked={consentTranscript}
                  onCheckedChange={(checked) => setConsentTranscript(checked === true)}
                />
                <Label htmlFor="transcript" className="text-sm font-normal">
                  I consent to live transcription
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="summary"
                  checked={consentSummary}
                  onCheckedChange={(checked) => setConsentSummary(checked === true)}
                />
                <Label htmlFor="summary" className="text-sm font-normal">
                  I want to receive an AI summary after the meeting
                </Label>
              </div>
            </div>
          </div>

          {/* Expiry Warning */}
          <p className="text-xs text-muted-foreground text-center">
            This invitation expires on {format(new Date(invite.expires_at), 'MMM d, yyyy')}
          </p>
        </CardContent>

        <CardFooter className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => handleResponse('decline')}
            disabled={responding}
          >
            {responding ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
            Decline
          </Button>
          <Button
            className="flex-1"
            onClick={() => handleResponse('accept')}
            disabled={responding}
          >
            {responding ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            Accept
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
