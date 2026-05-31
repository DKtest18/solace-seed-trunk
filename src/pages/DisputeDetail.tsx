import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import { useHasRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  ArrowLeft, 
  MessageSquare, 
  Send, 
  Shield, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { AdminProductFileAccess } from '@/components/admin/AdminProductFileAccess';
import { useTranslation } from 'react-i18next';

export default function DisputeDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasRole: isAdmin } = useHasRole('admin');
  const { t } = useTranslation();
  
  const [newMessage, setNewMessage] = useState('');
  const [sellerResponse, setSellerResponse] = useState('');
  const [authorizeRefund, setAuthorizeRefund] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [refundBuyer, setRefundBuyer] = useState(false);
  const [penalizeSeller, setPenalizeSeller] = useState(false);
  const [penaltyAmount, setPenaltyAmount] = useState('');

  // Fetch dispute details
  const { data: dispute, isLoading } = useQuery({
    queryKey: ['dispute', id],
    queryFn: async () => {
      const { data, error } = await db
        .from('dkai_disputes')
        .select(`
          *,
          products:dkai_products (id, title, price)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      // Fetch buyer and seller profiles separately
      const [buyerRes, sellerRes] = await Promise.all([
        db.from('dkai_profiles').select('id, full_name, creator_name, avatar_url, username').eq('id', data.buyer_id).single(),
        db.from('dkai_profiles').select('id, full_name, creator_name, avatar_url, username').eq('id', data.seller_id).single()
      ]);
      
      return { ...data, buyer: buyerRes.data, seller: sellerRes.data };
    },
    enabled: !!id && !!user,
  });

  // Fetch dispute messages
  const { data: messages } = useQuery({
    queryKey: ['dispute-messages', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dispute_messages')
        .select(`
          *,
          sender:profiles!dispute_messages_sender_id_fkey (id, full_name, creator_name, avatar_url)
        `)
        .eq('dispute_id', id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!newMessage.trim()) throw new Error('Message cannot be empty');

      const { error } = await supabase
        .from('dispute_messages')
        .insert({
          dispute_id: id,
          sender_id: user?.id,
          message: newMessage.trim(),
          is_admin_message: isAdmin
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispute-messages', id] });
      setNewMessage('');
      toast.success('Message sent');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  // Seller respond mutation
  const sellerRespond = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('seller-respond-dispute', {
        body: {
          disputeId: id,
          response: sellerResponse,
          authorizeRefund
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispute', id] });
      queryClient.invalidateQueries({ queryKey: ['dispute-messages', id] });
      toast.success(authorizeRefund ? 'Refund authorized' : 'Response submitted');
      setSellerResponse('');
      setAuthorizeRefund(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  // Admin resolve mutation
  const resolveDispute = useMutation({
    mutationFn: async (resolution: string) => {
      const { data, error } = await supabase.functions.invoke('resolve-dispute', {
        body: {
          disputeId: id,
          resolution,
          resolutionNotes,
          refundBuyer,
          penalizeSeller,
          penaltyAmount: parseFloat(penaltyAmount) || 0
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispute', id] });
      toast.success('Dispute resolved');
      navigate('/admin/disputes');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const isSeller = user?.id === dispute?.seller_id;
  const isBuyer = user?.id === dispute?.buyer_id;
  const canRespond = isSeller && !dispute?.seller_responded_at && dispute?.status === 'open';
  const canResolve = isAdmin && !['resolved', 'closed'].includes(dispute?.status || '');

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle }> = {
      open: { variant: 'default', icon: AlertTriangle },
      in_progress: { variant: 'secondary', icon: Clock },
      seller_authorized_refund: { variant: 'outline', icon: RefreshCw },
      resolved: { variant: 'outline', icon: CheckCircle },
      closed: { variant: 'outline', icon: XCircle }
    };

    const config = statusConfig[status] || statusConfig.open;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status.replace(/_/g, ' ').toUpperCase()}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!dispute) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8 px-4">
          <p className="text-muted-foreground">Dispute not found</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Dispute Header */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      {dispute.subject}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Product: {dispute.products?.title}
                    </CardDescription>
                  </div>
                  {getStatusBadge(dispute.status)}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{dispute.description}</p>
                
                {dispute.seller_response && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <h4 className="font-semibold text-sm mb-2">Seller Response</h4>
                    <p className="text-sm">{dispute.seller_response}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Responded {dispute.seller_responded_at && formatDistanceToNow(new Date(dispute.seller_responded_at))} ago
                    </p>
                  </div>
                )}

                {dispute.resolution_notes && (
                  <div className="mt-4 p-4 bg-primary/10 rounded-lg">
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Resolution
                    </h4>
                    <p className="text-sm">{dispute.resolution_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Messages Thread */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Discussion</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {messages?.map((msg: any) => (
                      <div 
                        key={msg.id} 
                        className={`flex gap-3 ${msg.sender_id === user?.id ? 'flex-row-reverse' : ''}`}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={msg.sender?.avatar_url} />
                          <AvatarFallback>
                            {(msg.sender?.creator_name || msg.sender?.full_name || 'U')[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`flex-1 max-w-[80%] ${msg.sender_id === user?.id ? 'text-right' : ''}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">
                              {msg.sender?.creator_name || msg.sender?.full_name}
                            </span>
                            {msg.is_admin_message && (
                              <Badge variant="secondary" className="text-xs">Admin</Badge>
                            )}
                          </div>
                          <div className={`p-3 rounded-lg ${
                            msg.sender_id === user?.id 
                              ? 'bg-primary text-primary-foreground' 
                              : msg.is_admin_message 
                                ? 'bg-accent border border-border'
                                : 'bg-muted'
                          }`}>
                            <p className="text-sm">{msg.message}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <Separator className="my-4" />

                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    rows={2}
                  />
                  <Button 
                    onClick={() => sendMessage.mutate()}
                    disabled={sendMessage.isPending || !newMessage.trim()}
                  >
                    {sendMessage.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Dispute Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p>{format(new Date(dispute.created_at), 'MMM d, yyyy h:mm a')}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Buyer</Label>
                  <p>{dispute.buyer?.creator_name || dispute.buyer?.full_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Seller</Label>
                  <p>{dispute.seller?.creator_name || dispute.seller?.full_name}</p>
                </div>
                {dispute.seller_response_deadline && (
                  <div>
                    <Label className="text-muted-foreground">Response Deadline</Label>
                    <p className={new Date(dispute.seller_response_deadline) < new Date() ? 'text-destructive' : ''}>
                      {format(new Date(dispute.seller_response_deadline), 'MMM d, yyyy')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Seller Response Form */}
            {canRespond && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Respond to Dispute</CardTitle>
                  <CardDescription>
                    You have until {dispute.seller_response_deadline 
                      ? format(new Date(dispute.seller_response_deadline), 'MMM d') 
                      : '7 days'} to respond
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Your response..."
                    value={sellerResponse}
                    onChange={(e) => setSellerResponse(e.target.value)}
                    rows={4}
                  />
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="authorizeRefund"
                      checked={authorizeRefund}
                      onCheckedChange={(checked) => setAuthorizeRefund(checked as boolean)}
                    />
                    <Label htmlFor="authorizeRefund" className="text-sm">
                      Authorize refund to buyer
                    </Label>
                  </div>
                  <Button 
                    className="w-full"
                    onClick={() => sellerRespond.mutate()}
                    disabled={sellerRespond.isPending || !sellerResponse.trim()}
                  >
                    {sellerRespond.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {authorizeRefund ? 'Authorize Refund' : 'Submit Response'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Admin Resolution Form */}
            {canResolve && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Admin Resolution
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Resolution notes..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    rows={3}
                  />
                  
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="refundBuyer"
                        checked={refundBuyer}
                        onCheckedChange={(checked) => setRefundBuyer(checked as boolean)}
                      />
                      <Label htmlFor="refundBuyer" className="text-sm">
                        Refund buyer
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="penalizeSeller"
                        checked={penalizeSeller}
                        onCheckedChange={(checked) => setPenalizeSeller(checked as boolean)}
                      />
                      <Label htmlFor="penalizeSeller" className="text-sm">
                        Penalize seller
                      </Label>
                    </div>
                    
                    {penalizeSeller && (
                      <div>
                        <Label htmlFor="penaltyAmount" className="text-sm">Penalty Amount ($)</Label>
                        <Input
                          id="penaltyAmount"
                          type="number"
                          step="0.01"
                          value={penaltyAmount}
                          onChange={(e) => setPenaltyAmount(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      className="flex-1"
                      onClick={() => resolveDispute.mutate('resolved')}
                      disabled={resolveDispute.isPending || !resolutionNotes.trim()}
                    >
                      {resolveDispute.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Resolve
                    </Button>
                    <Button 
                      variant="outline"
                      className="flex-1"
                      onClick={() => resolveDispute.mutate('closed')}
                      disabled={resolveDispute.isPending}
                    >
                      Close
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
