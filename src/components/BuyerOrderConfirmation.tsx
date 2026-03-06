import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import { CheckCircle, Clock, Loader2, AlertTriangle, Package, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

interface Order {
  id: string;
  status: string;
  escrow_status: string;
  price: number;
  buyer_confirmed_at: string | null;
  auto_confirm_deadline: string | null;
  refund_deadline: string | null;
  products: { title: string };
}

interface BuyerOrderConfirmationProps {
  order: Order;
  onConfirmed?: () => void;
}

export function BuyerOrderConfirmation({ order, onConfirmed }: BuyerOrderConfirmationProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const confirmReceipt = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('buyer-confirm-receipt', {
        body: { orderId: order.id }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(t('orders.confirmSuccess') || 'Order confirmed! Seller will receive funds after 24h refund window.');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-history'] });
      setShowConfirmDialog(false);
      onConfirmed?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || t('orders.confirmError') || 'Failed to confirm order');
    }
  });

  // Already confirmed
  if (order.buyer_confirmed_at) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-green-600">
                {t('orders.confirmed') || 'Confirmed'}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('orders.confirmedOn') || 'Confirmed on'} {format(new Date(order.buyer_confirmed_at), 'MMM dd, yyyy HH:mm')}
              </p>
              {order.refund_deadline && new Date(order.refund_deadline) > new Date() && (
                <p className="text-sm text-yellow-600 mt-1">
                  <Clock className="h-3 w-3 inline mr-1" />
                  {t('orders.refundWindow') || 'Refund window'}: {formatDistanceToNow(new Date(order.refund_deadline))}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Escrow not held (waiting for payment)
  if (order.escrow_status !== 'held' && order.escrow_status !== 'delivered') {
    return (
      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-600">
                {t('orders.awaitingPayment') || 'Awaiting Payment'}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('orders.paymentPending') || 'Confirmation available after payment is received'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Can confirm
  return (
    <Card className="border-blue-500/30 bg-blue-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Package className="h-5 w-5 text-blue-600" />
          {t('orders.confirmReceipt') || 'Confirm Receipt'}
        </CardTitle>
        <CardDescription>
          {t('orders.confirmDescription') || 'Did you receive your product? Confirming will start a 24h refund window.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {order.auto_confirm_deadline && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                {t('orders.autoConfirm') || 'Auto-confirm in'}: {formatDistanceToNow(new Date(order.auto_confirm_deadline))}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span>
              {t('orders.sellerPayout') || 'Seller will receive payout after confirmation + 24h refund window'}
            </span>
          </div>

          <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <AlertDialogTrigger asChild>
              <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700">
                <CheckCircle className="h-4 w-4" />
                {t('orders.confirmReceiptButton') || 'I Received My Product'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('orders.confirmTitle') || 'Confirm Receipt?'}</AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p>
                    {t('orders.confirmWarning') || 'By confirming, you acknowledge that you have received'}:
                  </p>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="font-medium">{order.products?.title}</p>
                    <p className="text-sm text-muted-foreground">${order.price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-yellow-500/10 rounded-lg text-yellow-600">
                    <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">
                      {t('orders.refundWindowWarning') || 'You will have 24 hours to request a refund after confirmation. After that, funds will be released to the seller.'}
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel') || 'Cancel'}</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => confirmReceipt.mutate()}
                  disabled={confirmReceipt.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {confirmReceipt.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  {t('orders.confirmButton') || 'Confirm Receipt'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
