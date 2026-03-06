import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Video } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function JoinMeetingPage() {
  const { joinSlug } = useParams<{ joinSlug: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setError('Please sign in to join the meeting');
      setLoading(false);
      return;
    }

    if (!joinSlug) {
      setError('Invalid meeting link');
      setLoading(false);
      return;
    }

    // Lookup room by join_slug and redirect to meeting room
    const lookupRoom = async () => {
      try {
        const { data: room, error: roomError } = await supabase
          .from('meeting_rooms')
          .select('room_code')
          .eq('join_slug', joinSlug)
          .single();

        if (roomError || !room) {
          setError('Meeting not found. The link may be invalid or expired.');
          setLoading(false);
          return;
        }

        // Redirect to meeting room with room_code
        navigate(`/meeting-room/${room.room_code}`, { replace: true });
      } catch (err: any) {
        setError(err.message || 'Failed to find meeting');
        setLoading(false);
      }
    };

    lookupRoom();
  }, [joinSlug, user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Connecting to meeting...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle>Unable to Join</CardTitle>
            </div>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            {!user ? (
              <Button asChild>
                <Link to={`/login?redirect=/meetings/join/${joinSlug}`}>Sign In</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link to="/my-meetings">
                  <Video className="h-4 w-4 mr-2" />
                  My Meetings
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
