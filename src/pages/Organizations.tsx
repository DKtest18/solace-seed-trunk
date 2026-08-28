import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';
import { 
  Building2, 
  Users, 
  Plus, 
  Mail, 
  UserPlus, 
  Settings, 
  Loader2, 
  Crown, 
  Shield, 
  User,
  MoreVertical,
  UserMinus,
  ArrowUpDown
} from 'lucide-react';
import {
import { HourglassLoader } from '@/components/HourglassLoader';
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  billing_email: string | null;
  description: string | null;
  created_at: string;
}

interface OrgMember {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
  profile?: {
    full_name: string | null;
    creator_name: string | null;
    avatar_url: string | null;
  };
}

export default function Organizations() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<OrgMember | null>(null);
  
  // Form state
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [newOrgDescription, setNewOrgDescription] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');

  // Fetch user's organizations
  const { data: organizations, isLoading } = useQuery({
    queryKey: ['user-organizations', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          organization_id,
          role,
          organization:organizations(*)
        `)
        .eq('user_id', user?.id);

      if (error) throw error;
      return data?.map(m => ({
        ...m.organization,
        userRole: m.role
      })) || [];
    },
    enabled: !!user?.id
  });

  // Fetch members for selected org
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['org-members', selectedOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', selectedOrg?.id)
        .order('role', { ascending: true });

      if (error) throw error;
      
      // Fetch profiles separately
      const userIds = data?.map(m => m.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, creator_name, avatar_url')
        .in('id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]));
      
      return data?.map(m => ({
        ...m,
        profile: profileMap.get(m.user_id)
      })) as OrgMember[];
    },
    enabled: !!selectedOrg?.id
  });

  // Create organization mutation
  const createOrgMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('create-organization', {
        body: {
          name: newOrgName,
          slug: newOrgSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          description: newOrgDescription || null
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Organization created successfully');
      queryClient.invalidateQueries({ queryKey: ['user-organizations'] });
      setCreateDialogOpen(false);
      setNewOrgName('');
      setNewOrgSlug('');
      setNewOrgDescription('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  // Invite member mutation
  const inviteMemberMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('invite-org-member', {
        body: {
          organization_id: selectedOrg?.id,
          invitee_email: inviteEmail,
          role: inviteRole
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteDialogOpen(false);
      setInviteEmail('');
      setInviteRole('member');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  // Manage member mutation
  const manageMemberMutation = useMutation({
    mutationFn: async ({ action, targetUserId, newRole }: { 
      action: 'change_role' | 'remove' | 'leave'; 
      targetUserId: string; 
      newRole?: string 
    }) => {
      const { data, error } = await supabase.functions.invoke('manage-org-member', {
        body: {
          organization_id: selectedOrg?.id,
          target_user_id: targetUserId,
          action,
          new_role: newRole
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, variables) => {
      if (variables.action === 'leave') {
        toast.success('You have left the organization');
        setSelectedOrg(null);
      } else if (variables.action === 'remove') {
        toast.success('Member removed');
      } else {
        toast.success('Role updated');
      }
      queryClient.invalidateQueries({ queryKey: ['org-members', selectedOrg?.id] });
      queryClient.invalidateQueries({ queryKey: ['user-organizations'] });
      setMemberToRemove(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const getUserRole = (orgId: string) => {
    return organizations?.find(o => o.id === orgId)?.userRole || 'member';
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'admin': return <Shield className="h-4 w-4 text-blue-500" />;
      default: return <User className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner': return 'default';
      case 'admin': return 'secondary';
      default: return 'outline';
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Please sign in to manage organizations.</p>
            <Button className="mt-4" onClick={() => navigate('/login')}>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            Organizations
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your organizations and team members
          </p>
        </div>
        
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Organization
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Organization</DialogTitle>
              <DialogDescription>
                Create a new organization to manage team bookings and meetings.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Organization Name</Label>
                <Input
                  id="name"
                  placeholder="Acme Inc."
                  value={newOrgName}
                  onChange={(e) => {
                    setNewOrgName(e.target.value);
                    setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="slug">URL Slug</Label>
                <Input
                  id="slug"
                  placeholder="acme-inc"
                  value={newOrgSlug}
                  onChange={(e) => setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                />
                <p className="text-xs text-muted-foreground">
                  Only lowercase letters, numbers, and hyphens
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="A brief description of your organization..."
                  value={newOrgDescription}
                  onChange={(e) => setNewOrgDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => createOrgMutation.mutate()}
                disabled={!newOrgName || !newOrgSlug || createOrgMutation.isPending}
              >
                {createOrgMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Organizations List */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Organizations</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 text-center">
                  <HourglassLoader size={64} />
                </div>
              ) : organizations?.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No organizations yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {organizations?.map((org: any) => (
                    <button
                      key={org.id}
                      onClick={() => setSelectedOrg(org)}
                      className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                        selectedOrg?.id === org.id ? 'bg-muted' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={org.logo_url || undefined} />
                          <AvatarFallback>
                            {org.name?.charAt(0)?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{org.name}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            {getRoleIcon(org.userRole)}
                            <span className="capitalize">{org.userRole}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Organization Details */}
        <div className="md:col-span-2">
          {selectedOrg ? (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={selectedOrg.logo_url || undefined} />
                      <AvatarFallback className="text-xl">
                        {selectedOrg.name?.charAt(0)?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle>{selectedOrg.name}</CardTitle>
                      <CardDescription>/{selectedOrg.slug}</CardDescription>
                    </div>
                  </div>
                  
                  {['owner', 'admin'].includes(getUserRole(selectedOrg.id)) && (
                    <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <UserPlus className="h-4 w-4 mr-2" />
                          Invite
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Invite Member</DialogTitle>
                          <DialogDescription>
                            Invite someone to join {selectedOrg.name}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label htmlFor="email">Email Address</Label>
                            <div className="relative">
                              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                id="email"
                                type="email"
                                placeholder="colleague@example.com"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                className="pl-9"
                              />
                            </div>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="role">Role</Label>
                            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'admin' | 'member')}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="member">Member</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={() => inviteMemberMutation.mutate()}
                            disabled={!inviteEmail || inviteMemberMutation.isPending}
                          >
                            {inviteMemberMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            Send Invite
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                
                {selectedOrg.description && (
                  <p className="text-muted-foreground mt-2">{selectedOrg.description}</p>
                )}
              </CardHeader>

              <Separator />

              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Members
                  </h3>
                </div>

                {membersLoading ? (
                  <div className="py-8 text-center">
                    <HourglassLoader size={64} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {members?.map((member) => (
                      <div 
                        key={member.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={member.profile?.avatar_url || undefined} />
                            <AvatarFallback>
                              {(member.profile?.full_name || member.profile?.creator_name || 'U').charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {member.profile?.full_name || member.profile?.creator_name || 'Unknown'}
                              {member.user_id === user?.id && (
                                <span className="text-muted-foreground ml-1">(you)</span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Joined {new Date(member.joined_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge variant={getRoleBadgeVariant(member.role) as any}>
                            {getRoleIcon(member.role)}
                            <span className="ml-1 capitalize">{member.role}</span>
                          </Badge>
                          
                          {getUserRole(selectedOrg.id) === 'owner' && member.role !== 'owner' && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => manageMemberMutation.mutate({
                                    action: 'change_role',
                                    targetUserId: member.user_id,
                                    newRole: member.role === 'admin' ? 'member' : 'admin'
                                  })}
                                >
                                  <ArrowUpDown className="h-4 w-4 mr-2" />
                                  {member.role === 'admin' ? 'Demote to Member' : 'Promote to Admin'}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setMemberToRemove(member)}
                                >
                                  <UserMinus className="h-4 w-4 mr-2" />
                                  Remove
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Select an organization to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Remove Member Confirmation */}
      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {memberToRemove?.profile?.full_name || 'this member'} from the organization? They will lose access to all organization resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => memberToRemove && manageMemberMutation.mutate({
                action: 'remove',
                targetUserId: memberToRemove.user_id
              })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
