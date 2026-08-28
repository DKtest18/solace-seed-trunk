import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Copy, Mail, Users, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { HourglassLoader } from '@/components/HourglassLoader';

export default function Invites() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');

  // Fetch user's invites
  const { data: invites, isLoading } = useQuery({
    queryKey: ['invites', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_invites')
        .select('*')
        .eq('inviter_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Generate invite code
  const generateCode = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  // Create invite mutation
  const createInvite = useMutation({
    mutationFn: async (inviteeEmail: string) => {
      const inviteCode = generateCode();
      
      const { data, error } = await supabase
        .from('user_invites')
        .insert({
          inviter_id: user?.id,
          invitee_email: inviteeEmail,
          invite_code: inviteCode,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] });
      toast.success('Invite sent successfully!');
      setEmail('');
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleSendInvite = () => {
    if (!email) {
      toast.error('Please enter an email address');
      return;
    }
    createInvite.mutate(email);
  };

  const copyInviteLink = (code: string) => {
    const link = `${window.location.origin}/signup?invite=${code}`;
    navigator.clipboard.writeText(link);
    toast.success('Invite link copied to clipboard!');
  };

  const stats = {
    totalInvites: invites?.length || 0,
    acceptedInvites: invites?.filter(i => i.status === 'accepted').length || 0,
    pendingInvites: invites?.filter(i => i.status === 'pending').length || 0,
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-background p-8">
        <div className="container mx-auto max-w-5xl">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Invite Friends</h1>
            <p className="text-muted-foreground">
              Invite your friends to join the marketplace and earn rewards
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Total Invites
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalInvites}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Accepted
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{stats.acceptedInvites}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Pending
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">{stats.pendingInvites}</div>
              </CardContent>
            </Card>
          </div>

          {/* Send Invite Form */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Send New Invite</CardTitle>
              <CardDescription>Invite a friend via email</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="friend@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleSendInvite}
                  disabled={createInvite.isPending}
                  className="mt-auto"
                >
                  {createInvite.isPending ? 'Sending...' : 'Send Invite'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Invites List */}
          <Card>
            <CardHeader>
              <CardTitle>Your Invites</CardTitle>
              <CardDescription>Track all your sent invitations</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8"><HourglassLoader size={64} /></div>
              ) : invites && invites.length > 0 ? (
                <div className="space-y-4">
                  {invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{invite.invitee_email || 'No email'}</div>
                        <div className="text-sm text-muted-foreground">
                          Code: {invite.invite_code}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Sent {new Date(invite.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            invite.status === 'accepted' ? 'default' :
                            invite.status === 'pending' ? 'secondary' : 'outline'
                          }
                        >
                          {invite.status}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyInviteLink(invite.invite_code)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No invites sent yet. Start inviting friends!
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
