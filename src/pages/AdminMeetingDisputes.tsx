import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AdminRouteGuard } from '@/components/AdminRouteGuard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Calendar, 
  FileText,
  DollarSign,
  MessageSquare,
  History,
  Shield
} from 'lucide-react';

// dk_meetings2 doesn't have dispute fields, so this page will show empty for now
interface DKMeetingDispute {
  meeting_id: string;
  meeting_cod: string;
  buyer_name: string;
  seller_name: string;
  start_time: string;
  title: string;
  status: string;
  description: string;
  created_at: string;
}

export default function AdminMeetingDisputes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDispute, setSelectedDispute] = useState<DKMeetingDispute | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionAction, setResolutionAction] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);

  // dk_meetings2 doesn't have dispute_status field, return empty for now
  const { data: disputedMeetings, isLoading } = useQuery({
    queryKey: ['admin-meeting-disputes'],
    queryFn: async () => {
      // dk_meetings2 doesn't support disputes yet
      return [] as DKMeetingDispute[];
    }
  });

  // Resolve dispute
  const resolveMutation = useMutation({
    mutationFn: async ({ 
      meetingId, 
      resolution, 
      notes 
    }: { 
      meetingId: string; 
      resolution: string; 
      notes: string;
    }) => {
      const newStatus = resolution === 'refund' ? 'resolved' : resolution;
      const paymentStatus = resolution === 'refund' ? 'refunded' : undefined;

      const updateData: any = {
        dispute_status: newStatus,
        admin_resolution_notes: notes
      };

      if (paymentStatus) {
        updateData.payment_status = paymentStatus;
      }

      const { error } = await supabase
        .from('dk_meetings')
        .update(updateData)
        .eq('id', meetingId);

      if (error) throw error;

      // Log resolution
      await supabase.rpc('append_dk_meeting_audit', {
        p_meeting_id: meetingId,
        p_event: 'dispute_resolved',
        p_actor_id: user?.id,
        p_details: { resolution, notes }
      });
    },
    onSuccess: () => {
      toast.success('Dispute resolved');
      setDialogOpen(false);
      setSelectedDispute(null);
      setResolutionNotes('');
      setResolutionAction('');
      queryClient.invalidateQueries({ queryKey: ['admin-meeting-disputes'] });
    },
    onError: (error: any) => {
      toast.error('Failed to resolve dispute', { description: error.message });
    }
  });

  const getDisputeStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; icon: any }> = {
      none: { variant: 'outline', label: 'No Dispute', icon: CheckCircle },
      opened: { variant: 'destructive', label: 'Open', icon: AlertTriangle },
      in_review: { variant: 'secondary', label: 'In Review', icon: Clock },
      resolved: { variant: 'default', label: 'Resolved', icon: CheckCircle },
      rejected: { variant: 'outline', label: 'Rejected', icon: XCircle }
    };
    const config = variants[status] || variants.none;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // dk_meetings2 doesn't have dispute_status, so these will always be empty
  const openDisputes: DKMeetingDispute[] = [];
  const inReviewDisputes: DKMeetingDispute[] = [];
  const resolvedDisputes: DKMeetingDispute[] = [];

  return (
    <AdminRouteGuard>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Meeting Disputes</h1>
              <p className="text-muted-foreground">Review and resolve DK AI Meeting disputes</p>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="destructive" className="text-lg px-4 py-2">
                {openDisputes.length} Open
              </Badge>
              <Badge variant="secondary" className="text-lg px-4 py-2">
                {inReviewDisputes.length} In Review
              </Badge>
            </div>
          </div>

          <Tabs defaultValue="open">
            <TabsList className="mb-6">
              <TabsTrigger value="open" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Open ({openDisputes.length})
              </TabsTrigger>
              <TabsTrigger value="review" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                In Review ({inReviewDisputes.length})
              </TabsTrigger>
              <TabsTrigger value="resolved" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Resolved ({resolvedDisputes.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="open">
              <Card>
                <CardContent className="py-12 text-center">
                  <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No disputes</h3>
                  <p className="text-muted-foreground">Dispute functionality not yet available for dk_meetings2.</p>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="review">
              <Card>
                <CardContent className="py-12 text-center">
                  <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No disputes</h3>
                  <p className="text-muted-foreground">No in-review disputes at this time.</p>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="resolved">
              <Card>
                <CardContent className="py-12 text-center">
                  <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No disputes</h3>
                  <p className="text-muted-foreground">No resolved disputes at this time.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AdminRouteGuard>
  );
}
