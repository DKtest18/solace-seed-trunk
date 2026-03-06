import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Users, Video, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';

interface WaitingRoomProps {
  meetingStartTime: string;
  roomCode: string;
  meetingId: string;
  displayName: string;
  reason?: 'early' | 'pending_acceptance';
}

export function WaitingRoom({ meetingStartTime, roomCode, meetingId, displayName, reason = 'early' }: WaitingRoomProps) {
  const navigate = useNavigate();
  const [timeRemaining, setTimeRemaining] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);
  const [canEnter, setCanEnter] = useState(false);

  const calculateTimeRemaining = useCallback(() => {
    const now = new Date();
    const startTime = new Date(meetingStartTime);
    const diff = startTime.getTime() - now.getTime();

    if (diff <= 0) {
      setCanEnter(true);
      setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      return;
    }

    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((diff % (60 * 1000)) / 1000);
    
    setTimeRemaining({ days, hours, minutes, seconds });
    setCanEnter(false);
  }, [meetingStartTime]);

  useEffect(() => {
    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);
    return () => clearInterval(interval);
  }, [calculateTimeRemaining]);

  const handleEnterMeeting = () => {
    // Redirect to external dkmeeting.com
    window.location.href = `https://dkmeeting.com?mid=${encodeURIComponent(meetingId)}&mc=${encodeURIComponent(roomCode)}`;
  };

  const handleLeave = () => {
    navigate('/my-meetings');
  };

  const formatTime = () => {
    if (!timeRemaining) return '--:--:--';
    
    const { days, hours, minutes, seconds } = timeRemaining;
    
    if (days > 0) {
      return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
    }
    
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // If waiting for pending acceptance
  if (reason === 'pending_acceptance') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg text-center">
          <CardHeader className="pb-4">
            <div className="mx-auto w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-10 w-10 text-amber-500" />
            </div>
            <CardTitle className="text-2xl">Waiting for Seller</CardTitle>
            <CardDescription className="text-base">
              The seller has not yet accepted your meeting request.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-8">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                You will receive a notification when the seller responds to your request.
              </p>
              <p className="text-xs text-muted-foreground">
                Meeting ID: <span className="font-mono">{meetingId}</span>
              </p>
            </div>

            <Button variant="outline" className="w-full" onClick={handleLeave}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to My Meetings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Video className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Waiting Room</CardTitle>
          <CardDescription className="text-base">
            {canEnter
              ? 'The meeting is ready! You can enter now.'
              : 'Waiting for the meeting to start...'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Countdown Timer */}
          {timeRemaining && !canEnter && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Meeting starts in</p>
              <div className="flex items-center justify-center gap-2">
                <Clock className="h-8 w-8 text-primary animate-pulse" />
                <span className="text-5xl font-bold font-mono text-foreground">
                  {formatTime()}
                </span>
              </div>
              {timeRemaining.days > 0 && (
                <p className="text-xs text-muted-foreground">
                  You can join up to 24 hours before the meeting starts
                </p>
              )}
            </div>
          )}

          {/* Ready to enter */}
          {canEnter && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-primary">
                <RefreshCw className="h-6 w-6 animate-spin" />
                <span className="text-xl font-medium">Meeting is live!</span>
              </div>
            </div>
          )}

          {/* Status */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="text-sm">Waiting for the other participant</span>
            </div>
            <p className="text-xs text-muted-foreground">
              You're logged in as <span className="font-medium">{displayName}</span>
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleLeave}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Leave
            </Button>
            <Button
              className="flex-1"
              onClick={handleEnterMeeting}
              disabled={!canEnter}
            >
              <Video className="mr-2 h-4 w-4" />
              {canEnter ? 'Enter Meeting' : 'Please Wait'}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            You can leave and rejoin anytime. The meeting will continue even if you leave.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}