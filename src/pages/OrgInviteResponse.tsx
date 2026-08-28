import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Building2, CheckCircle, XCircle, Loader2, AlertTriangle, Shield, User } from 'lucide-react';
import { HourglassLoader } from '@/components/HourglassLoader';

interface OrgInvite {
  id: string;
  organization_id: string;
  invitee_email: string;
  role: string;
  status: string;
  expires_at: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    description: string | null;
  } | null;
}

export default function OrgInviteResponse() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<OrgInvite | null>(null);
  const [responded, setResponded] = useState(false);
  const [responseResult, setResponseResult] = useState<'accepted' | 'declined' | null>(null);

  useEffect(() => {
    const fetchInvite = async () => {
      if (!token) {
        setError('Invalid invite link');
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('organization_invites')
          .select(`
            *,
            organization:organizations(id, name, slug, logo_url, description)
          `)
          .eq('invite_token', token)
          .single();

        if (fetchError || !data) {
          setError('Invite not found or invalid');
          setLoading(false);
          return;
        }

        setInvite(data as unknown as OrgInvite);

        if (data.status !== 'pending') {
          setResponded(true);
          setResponseResult(data.status as 'accepted' | 'declined');
        }

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
    if (!token || !user) {
      toast.error('You must be logged in to respond to this invite');
      return;
    }
    
    setResponding(true);
    
    try {
      const { data, error: responseError } = await supabase.functions.invoke('respond-org-invite', {
        body: {
          invite_token: token,
          response
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
            <HourglassLoader size={96} />
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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign In Required</CardTitle>
            <CardDescription>
              You need to sign in to respond to this organization invite.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invite && (
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={invite.organization?.logo_url || undefined} />
                  <AvatarFallback>
                    {invite.organization?.name?.charAt(0)?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{invite.organization?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    You're invited as {invite.role}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={() => navigate('/login')} className="w-full">
              Sign In to Continue
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
                <CardTitle>Welcome to {invite?.organization?.name}!</CardTitle>
                <CardDescription>
                  You're now a member of this organization.
                </CardDescription>
              </>
            ) : (
              <>
                <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <CardTitle>Invite Declined</CardTitle>
                <CardDescription>
                  You've declined this organization invitation.
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardFooter className="flex gap-2 justify-center">
            {responseResult === 'accepted' && (
              <Button onClick={() => navigate('/organizations')}>
                View Organizations
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Avatar className="h-20 w-20 mx-auto mb-4">
            <AvatarImage src={invite.organization?.logo_url || undefined} />
            <AvatarFallback className="text-2xl">
              {invite.organization?.name?.charAt(0)?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <CardTitle>Join {invite.organization?.name}</CardTitle>
          <CardDescription>
            You've been invited to join this organization
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {invite.organization?.description && (
            <p className="text-sm text-muted-foreground text-center">
              {invite.organization.description}
            </p>
          )}

          <div className="flex items-center justify-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              {invite.role === 'admin' ? (
                <Shield className="h-3 w-3" />
              ) : (
                <User className="h-3 w-3" />
              )}
              <span className="capitalize">{invite.role}</span>
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            This invitation was sent to {invite.invitee_email}
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
