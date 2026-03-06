import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Video, AlertCircle, User, Hash, Lock, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WaitingRoom } from '@/components/meetings/WaitingRoom';

export default function JoinMeetingByCode() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [displayName, setDisplayName] = useState('');
  const [meetingId, setMeetingId] = useState(searchParams.get('mid') || '');
  const [meetingCode, setMeetingCode] = useState(searchParams.get('mc') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Waiting room state
  const [showWaitingRoom, setShowWaitingRoom] = useState(false);
  const [waitingRoomData, setWaitingRoomData] = useState<{
    meetingStartTime: string;
    roomCode: string;
    meetingId: string;
    reason?: 'early' | 'pending_acceptance';
  } | null>(null);

  // Too early countdown state
  const [tooEarly, setTooEarly] = useState(false);
  const [tooEarlyData, setTooEarlyData] = useState<{
    allowedFrom: string;
    meetingStartTime: string;
    hoursRemaining: number;
    minutesRemaining: number;
  } | null>(null);

  // Pre-fill display name from profile
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        setDisplayName(profile.full_name || profile.username || '');
      }
    };
    
    loadProfile();
  }, [user]);

  // Auto-update countdown for too-early state
  useEffect(() => {
    if (!tooEarly || !tooEarlyData) return;

    const interval = setInterval(() => {
      const now = new Date();
      const allowedFrom = new Date(tooEarlyData.allowedFrom);
      const diff = allowedFrom.getTime() - now.getTime();

      if (diff <= 0) {
        // Time to retry join
        setTooEarly(false);
        setTooEarlyData(null);
        toast.info('Join window is now open. Attempting to join...');
        handleJoin(new Event('submit') as any);
      } else {
        const hours = Math.floor(diff / (60 * 60 * 1000));
        const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
        setTooEarlyData(prev => prev ? { ...prev, hoursRemaining: hours, minutesRemaining: minutes } : null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [tooEarly, tooEarlyData]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTooEarly(false);
    setTooEarlyData(null);
    
    if (!displayName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    if (!meetingId.trim()) {
      setError('Please enter a Meeting ID');
      return;
    }
    
    if (!meetingCode.trim()) {
      setError('Please enter a Meeting Code');
      return;
    }

    if (!user) {
      // Redirect to login with return URL
      navigate(`/login?redirect=/join-meeting&mid=${encodeURIComponent(meetingId)}&mc=${encodeURIComponent(meetingCode)}`);
      return;
    }

    setLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('join-by-code', {
        body: {
          meeting_id: meetingId.trim(),
          meeting_code: meetingCode.trim().toUpperCase(),
          display_name: displayName.trim()
        }
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to join meeting');
      }

      // Handle different response types
      if (data.requires_auth) {
        navigate(`/login?redirect=/join-meeting&mid=${encodeURIComponent(meetingId)}&mc=${encodeURIComponent(meetingCode)}`);
        return;
      }

      // Check for status-based responses
      if (data.reason === 'pending_acceptance') {
        setWaitingRoomData({
          meetingStartTime: '',
          roomCode: '',
          meetingId: meetingId,
          reason: 'pending_acceptance'
        });
        setShowWaitingRoom(true);
        return;
      }

      if (data.reason === 'declined') {
        setError('This meeting was declined by the seller.');
        return;
      }

      if (data.reason === 'canceled') {
        setError('This meeting has been canceled.');
        return;
      }

      if (data.reason === 'expired' || data.expired) {
        setError(data.message || 'This meeting has ended.');
        return;
      }

      if (data.reason === 'code_expired') {
        setError('The meeting code has expired.');
        return;
      }

      if (data.reason === 'payment_required') {
        setError('Payment is required to join this meeting.');
        return;
      }

      // Handle too early case - show countdown
      if (data.too_early && data.can_join === false) {
        setTooEarly(true);
        setTooEarlyData({
          allowedFrom: data.allowed_from,
          meetingStartTime: data.meeting_start_time,
          hoursRemaining: data.hours_remaining || 0,
          minutesRemaining: data.minutes_remaining || 0
        });
        return;
      }

      // Handle error responses
      if (data.error) {
        setError(data.error);
        return;
      }

      // Handle successful join - redirect to dkmeeting.com
      if (data.success && data.can_join) {
        // Check if this is an early join - show waiting room
        if (data.is_early_join && data.meeting_start_time) {
          setWaitingRoomData({
            meetingStartTime: data.meeting_start_time,
            roomCode: data.room_code,
            meetingId: data.meeting_id,
            reason: 'early'
          });
          setShowWaitingRoom(true);
          toast.success('You can wait here until the meeting starts');
        } else {
          // Redirect to external dkmeeting.com with meeting ID and code
          toast.success('Redirecting to meeting...');
          const externalUrl = `https://dkmeeting.com?mid=${encodeURIComponent(meetingId.trim())}&mc=${encodeURIComponent(meetingCode.trim().toUpperCase())}`;
          window.location.href = externalUrl;
        }
      } else {
        setError(data.message || 'Unable to join meeting. Please check your details.');
      }
    } catch (err: any) {
      console.error('Join error:', err);
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Format meeting code input (uppercase, add dashes for readability)
  const handleCodeChange = (value: string) => {
    // Remove non-alphanumeric characters and uppercase
    const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    setMeetingCode(cleaned);
  };

  // Show waiting room if early join or pending
  if (showWaitingRoom && waitingRoomData) {
    return (
      <WaitingRoom
        meetingStartTime={waitingRoomData.meetingStartTime}
        roomCode={waitingRoomData.roomCode}
        meetingId={waitingRoomData.meetingId}
        displayName={displayName}
        reason={waitingRoomData.reason}
      />
    );
  }

  // Show too-early countdown
  if (tooEarly && tooEarlyData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-4">
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
            <CardTitle className="text-2xl">Too Early to Join</CardTitle>
            <CardDescription>
              The join window opens 24 hours before the meeting
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">You can join in</p>
              <div className="flex items-center justify-center gap-2">
                <Clock className="h-6 w-6 text-primary animate-pulse" />
                <span className="text-4xl font-bold font-mono text-foreground">
                  {tooEarlyData.hoursRemaining > 0 
                    ? `${tooEarlyData.hoursRemaining}h ${tooEarlyData.minutesRemaining}m`
                    : `${tooEarlyData.minutesRemaining}m`
                  }
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Meeting starts: {new Date(tooEarlyData.meetingStartTime).toLocaleString()}
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This page will automatically retry when the join window opens.
                You can also come back later.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => navigate('/my-meetings')}
              >
                My Meetings
              </Button>
              <Button 
                className="flex-1"
                onClick={() => {
                  setTooEarly(false);
                  setTooEarlyData(null);
                }}
              >
                Back to Form
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Video className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Join Meeting</CardTitle>
          <CardDescription>
            Enter your meeting details to join
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleJoin} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="displayName" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Your Name
              </Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Enter your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="meetingId" className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Meeting ID
              </Label>
              <Input
                id="meetingId"
                type="text"
                placeholder="Enter Meeting ID"
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
                disabled={loading}
                required
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                The Meeting ID is in your email or notification
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="meetingCode" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Meeting Code
              </Label>
              <Input
                id="meetingCode"
                type="text"
                placeholder="Enter 8-character code"
                value={meetingCode}
                onChange={(e) => handleCodeChange(e.target.value)}
                disabled={loading}
                required
                maxLength={10}
                className="font-mono uppercase tracking-widest text-center text-lg"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={loading || authLoading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <Video className="mr-2 h-4 w-4" />
                  Join Meeting
                </>
              )}
            </Button>

            {!user && (
              <p className="text-sm text-center text-muted-foreground">
                You'll need to sign in to join the meeting
              </p>
            )}
          </form>

          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-muted-foreground text-center">
              You can join up to 24 hours before the scheduled time.
              <br />
              Check your email or notifications for meeting details.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}