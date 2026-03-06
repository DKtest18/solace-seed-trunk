import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, UserPlus, Mail } from 'lucide-react';

interface InviteParticipantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  userRole: 'seller_owner' | 'buyer_owner' | string;
  onInviteSent?: () => void;
}

export function InviteParticipantDialog({
  open,
  onOpenChange,
  meetingId,
  userRole,
  onInviteSent
}: InviteParticipantDialogProps) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [role, setRole] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Determine allowed roles based on user's role
  const getAllowedRoles = () => {
    if (userRole === 'seller_owner') {
      return [{ value: 'seller_team', label: 'Seller Team Member' }];
    }
    if (userRole === 'buyer_owner') {
      return [{ value: 'buyer_team', label: 'Buyer Team Member' }];
    }
    return [];
  };

  const allowedRoles = getAllowedRoles();

  // Set default role
  useState(() => {
    if (allowedRoles.length === 1) {
      setRole(allowedRoles[0].value);
    }
  });

  const handleInvite = async () => {
    if (!email) {
      toast.error('Please enter an email address');
      return;
    }

    if (!role) {
      toast.error('Please select a role');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('invite-meeting-participant', {
        body: {
          meeting_id: meetingId,
          invitee_email: email,
          participant_role: role,
          message: message || null
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success(`Invitation sent to ${email}`);
      
      // Reset form
      setEmail('');
      setMessage('');
      
      // Close dialog
      onOpenChange(false);
      
      // Callback
      onInviteSent?.();
    } catch (err: any) {
      console.error('Invite error:', err);
      toast.error(err.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const canInvite = userRole === 'seller_owner' || userRole === 'buyer_owner';

  if (!canInvite) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cannot Invite Participants</DialogTitle>
            <DialogDescription>
              Only meeting owners can invite additional participants.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Participant
          </DialogTitle>
          <DialogDescription>
            Invite a team member to join this meeting. They will receive an email invitation.
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={setRole} disabled={loading || allowedRoles.length === 1}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {allowedRoles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {userRole === 'seller_owner' 
                ? 'As the seller, you can only invite seller team members'
                : 'As the buyer, you can only invite buyer team members'}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="message">Message (optional)</Label>
            <Textarea
              id="message"
              placeholder="Add a personal note to the invitation..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              disabled={loading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={loading || !email || !role}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Send Invitation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
