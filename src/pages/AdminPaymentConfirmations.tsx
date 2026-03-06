import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Check, X, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';

export default function AdminPaymentConfirmations() {
  const { user } = useAuth();
  const { hasRole: isAdmin, isLoading: roleLoading } = useHasRole('admin');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedConfirmation, setSelectedConfirmation] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const { data: confirmations, isLoading } = useQuery({
    queryKey: ['payment-confirmations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_confirmations')
        .select(`
          *,
          orders (
            id,
            buyer_id,
            product_id,
            price,
            payment_method,
            products (title, seller_id)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user && isAdmin,
  });

  const approveMutation = useMutation({
    mutationFn: async (confirmationId: string) => {
      const confirmation = confirmations?.find(c => c.id === confirmationId);
      if (!confirmation) throw new Error('Confirmation not found');

      // Update confirmation status
      const { error: confirmError } = await supabase
        .from('payment_confirmations')
        .update({
          status: 'approved',
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
          notes: reviewNotes,
        })
        .eq('id', confirmationId);

      if (confirmError) throw confirmError;

      // Update order status to paid
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'paid',
          payment_confirmed_by: user!.id,
          payment_confirmed_at: new Date().toISOString(),
        })
        .eq('id', confirmation.order_id);

      if (orderError) throw orderError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-confirmations'] });
      toast.success('Payment approved successfully');
      setSelectedConfirmation(null);
      setReviewNotes('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve payment');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (confirmationId: string) => {
      const { error } = await supabase
        .from('payment_confirmations')
        .update({
          status: 'rejected',
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
          notes: reviewNotes,
        })
        .eq('id', confirmationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-confirmations'] });
      toast.success('Payment rejected');
      setSelectedConfirmation(null);
      setReviewNotes('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject payment');
    },
  });

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You need admin access to view this page.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingConfirmations = confirmations?.filter(c => c.status === 'pending') || [];
  const reviewedConfirmations = confirmations?.filter(c => c.status !== 'pending') || [];

  return (
    <AppLayout>
      <div className="min-h-screen bg-background p-8">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Payment Confirmations</h1>
            <p className="text-muted-foreground">Review and approve buyer payment proofs</p>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* Pending Confirmations */}
              <div>
                <h2 className="text-2xl font-bold mb-4">
                  Pending Review ({pendingConfirmations.length})
                </h2>
                <div className="grid gap-4">
                  {pendingConfirmations.map((confirmation) => (
                    <Card key={confirmation.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">
                              Order #{confirmation.order_id.slice(0, 8)}
                            </CardTitle>
                            <CardDescription>
                              Product: {(confirmation.orders as any)?.products?.title}
                            </CardDescription>
                          </div>
                          <Badge variant="secondary">Pending</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Amount:</span>
                            <span className="ml-2 font-semibold">${(confirmation.orders as any)?.price}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Payment Method:</span>
                            <span className="ml-2 capitalize">{(confirmation.orders as any)?.payment_method?.replace('_', ' ')}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Submitted:</span>
                            <span className="ml-2">{new Date(confirmation.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {confirmation.notes && (
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-sm font-semibold mb-1">Buyer Notes:</p>
                            <p className="text-sm">{confirmation.notes}</p>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(confirmation.image_url, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            View Proof
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setSelectedConfirmation(confirmation)}
                          >
                            Review
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {pendingConfirmations.length === 0 && (
                    <Card>
                      <CardContent className="text-center py-12 text-muted-foreground">
                        No pending confirmations to review
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>

              {/* Reviewed Confirmations */}
              <div>
                <h2 className="text-2xl font-bold mb-4">Reviewed</h2>
                <div className="grid gap-4">
                  {reviewedConfirmations.slice(0, 10).map((confirmation) => (
                    <Card key={confirmation.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">
                              Order #{confirmation.order_id.slice(0, 8)}
                            </CardTitle>
                            <CardDescription>
                              {(confirmation.orders as any)?.products?.title} - ${(confirmation.orders as any)?.price}
                            </CardDescription>
                          </div>
                          <Badge variant={confirmation.status === 'approved' ? 'default' : 'destructive'}>
                            {confirmation.status}
                          </Badge>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Review Dialog */}
        <Dialog open={!!selectedConfirmation} onOpenChange={() => setSelectedConfirmation(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Review Payment Confirmation</DialogTitle>
            </DialogHeader>
            {selectedConfirmation && (
              <div className="space-y-4">
                <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                  <img
                    src={selectedConfirmation.image_url}
                    alt="Payment proof"
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Product:</span>
                    <span className="ml-2 font-semibold">
                      {(selectedConfirmation.orders as any)?.products?.title}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Amount:</span>
                    <span className="ml-2 font-semibold">${(selectedConfirmation.orders as any)?.price}</span>
                  </div>
                </div>

                {selectedConfirmation.notes && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-semibold mb-1">Buyer Notes:</p>
                    <p className="text-sm">{selectedConfirmation.notes}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-semibold mb-2 block">Review Notes (Optional)</label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add notes about this review..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => approveMutation.mutate(selectedConfirmation.id)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    className="flex-1"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Approve Payment
                  </Button>
                  <Button
                    onClick={() => rejectMutation.mutate(selectedConfirmation.id)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    variant="destructive"
                    className="flex-1"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
