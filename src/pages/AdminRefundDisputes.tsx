import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Shield, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { AppLayout } from '@/components/AppLayout';

export default function AdminRefundDisputes() {
  const { user } = useAuth();
  const { hasRole: isAdmin, isLoading: roleLoading } = useHasRole('admin');
  const queryClient = useQueryClient();

  // Fetch refund disputes
  const { data: disputes, isLoading } = useQuery({
    queryKey: ['admin-refund-disputes'],
    queryFn: async () => {
      const { data, error } = await db
        .from('dkai_disputes')
        .select(`
          *,
          dkai_products (
            id,
            title
          ),
          buyer:dkai_profiles!disputes_buyer_id_fkey (
            id,
            full_name,
            creator_name,
            username
          ),
          seller:dkai_profiles!disputes_seller_id_fkey (
            id,
            full_name,
            creator_name,
            username
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user && isAdmin,
  });

  // Approve refund mutation
  const approveRefund = useMutation({
    mutationFn: async ({ disputeId, orderId }: { disputeId: string; orderId: string }) => {
      // Update dispute status
      const { error: disputeError } = await db
        .from('dkai_disputes')
        .update({
          status: 'resolved',
          resolved_by: user?.id,
          resolved_at: new Date().toISOString(),
          resolution_notes: 'Refund approved by admin'
        })
        .eq('id', disputeId);

      if (disputeError) throw disputeError;

      // Get order details for refund
      const { data: order, error: orderError } = await db
        .from('dkai_orders')
        .select('held_amount, buyer_id, dkai_products(seller_id)')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      // Process refund using RPC or direct balance updates
      // Refund to buyer's balance
      const { error: buyerBalanceError } = await db.rpc('update_user_balance', {
        _user_id: order.buyer_id,
        _amount: order.held_amount,
        _balance_type: 'available',
        _operation: 'credit',
        _description: `Refund for order ${orderId}`,
        _source_type: 'refund',
        _source_id: disputeId
      });

      if (buyerBalanceError) throw buyerBalanceError;

      // Update order status
      const { error: orderUpdateError } = await db
        .from('dkai_orders')
        .update({
          status: 'refunded',
          escrow_status: 'refunded'
        })
        .eq('id', orderId);

      if (orderUpdateError) throw orderUpdateError;

      // Create refund transaction
      const { error: refundError } = await db
        .from('dkai_escrow_transactions')
        .insert({
          order_id: orderId,
          amount: order.held_amount,
          type: 'refund',
          performed_by: user?.id,
          metadata: { dispute_id: disputeId, approved_by: user?.id }
        });

      if (refundError) throw refundError;

      // Notify buyer
      await db.from('dkai_in_app_notifications').insert({
        user_id: order.buyer_id,
        title: 'Refund Approved',
        message: `Your refund request has been approved. $${order.held_amount} has been credited to your balance.`,
        type: 'payment',
        reference_id: orderId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-refund-disputes'] });
      toast.success('Refund approved and processed');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve refund');
    }
  });

  // Deny refund mutation
  const denyRefund = useMutation({
    mutationFn: async ({ disputeId, orderId, reason }: { disputeId: string; orderId: string; reason: string }) => {
      // Update dispute status
      const { error: disputeError } = await db
        .from('dkai_disputes')
        .update({
          status: 'closed',
          resolved_by: user?.id,
          resolved_at: new Date().toISOString(),
          resolution_notes: reason
        })
        .eq('id', disputeId);

      if (disputeError) throw disputeError;

      // Get order to notify buyer
      const { data: order } = await db
        .from('dkai_orders')
        .select('buyer_id, dkai_products(seller_id)')
        .eq('id', orderId)
        .single();

      if (order) {
        // Notify buyer
        await supabase.from('in_app_notifications').insert({
          user_id: order.buyer_id,
          title: 'Refund Request Denied',
          message: `Your refund request was reviewed and denied. Reason: ${reason}`,
          type: 'dispute',
          reference_id: orderId
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-refund-disputes'] });
      toast.success('Refund request denied');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to deny refund');
    }
  });

  if (roleLoading || !user) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center gap-2 mb-8">
          <Shield className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Refund Dispute Resolution</h1>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !disputes || disputes.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Pending Disputes</h3>
              <p className="text-muted-foreground">All refund requests have been resolved</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Pending Refund Requests</CardTitle>
              <CardDescription>Review and approve/deny buyer refund requests</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Seller</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {disputes.map((dispute: any) => (
                    <TableRow key={dispute.id}>
                      <TableCell>{format(new Date(dispute.created_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="font-medium">{dispute.products?.title}</TableCell>
                      <TableCell>
                        {dispute.buyer?.creator_name || dispute.buyer?.full_name || dispute.buyer?.username}
                      </TableCell>
                      <TableCell>
                        {dispute.seller?.creator_name || dispute.seller?.full_name || dispute.seller?.username}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{dispute.description}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="default" size="sm">
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Approve Refund</DialogTitle>
                                <DialogDescription>
                                  Are you sure you want to approve this refund? The buyer will receive a full refund.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label>Product</Label>
                                  <p className="text-sm text-muted-foreground">{dispute.products?.title}</p>
                                </div>
                                <div>
                                  <Label>Reason</Label>
                                  <p className="text-sm text-muted-foreground">{dispute.description}</p>
                                </div>
                                <Button
                                  className="w-full"
                                  onClick={() => approveRefund.mutate({
                                    disputeId: dispute.id,
                                    orderId: dispute.purchase_id
                                  })}
                                  disabled={approveRefund.isPending}
                                >
                                  {approveRefund.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                  Confirm Approval
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <XCircle className="h-4 w-4 mr-1" />
                                Deny
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Deny Refund</DialogTitle>
                                <DialogDescription>
                                  Provide a reason for denying this refund request
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="deny-reason">Reason for Denial</Label>
                                  <Textarea
                                    id="deny-reason"
                                    placeholder="Explain why this refund is being denied..."
                                    rows={4}
                                  />
                                </div>
                                <Button
                                  variant="destructive"
                                  className="w-full"
                                  onClick={() => {
                                    const reason = (document.getElementById('deny-reason') as HTMLTextAreaElement)?.value;
                                    if (reason) {
                                      denyRefund.mutate({
                                        disputeId: dispute.id,
                                        orderId: dispute.purchase_id,
                                        reason
                                      });
                                    }
                                  }}
                                  disabled={denyRefund.isPending}
                                >
                                  {denyRefund.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                  Confirm Denial
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}