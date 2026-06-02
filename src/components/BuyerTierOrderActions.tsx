import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Download, CheckCircle, AlertTriangle, Clock, ShieldAlert, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TierOrder {
  id: string;
  delivery_tier?: 'tier1' | 'tier2' | 'tier3' | string | null;
  payout_status?: string | null;
  status: string;
  price: number;
  auto_release_at?: string | null;
  buyer_confirmed_at?: string | null;
  seller_marked_delivered_at?: string | null;
  dispute_opened_at?: string | null;
  products?: { id: string; title: string } | null;
}

interface Props {
  order: TierOrder;
  onDownload?: () => void;
}

const TIER_LABEL: Record<string, string> = {
  tier1: 'Instant delivery',
  tier2: 'Protected delivery',
  tier3: 'Direct delivery',
};

export function BuyerTierOrderActions({ order, onDownload }: Props) {
  const tier = (order.delivery_tier ?? 'tier1') as 'tier1' | 'tier2' | 'tier3';
  const queryClient = useQueryClient();
  const [waiver, setWaiver] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const released = order.payout_status === 'released' || order.payout_status === 'auto_released';
  const disputed = order.payout_status === 'disputed';

  const confirm = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('confirm-receipt', {
        body: { orderId: order.id, euWaiverAccepted: tier === 'tier2' ? waiver : undefined },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Confirmed. Seller payout released.');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-history'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openDispute = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('open-dispute', {
        body: { orderId: order.id, reason: disputeReason },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Dispute opened. Admin notified.');
      setDisputeReason('');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-history'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>{TIER_LABEL[tier] ?? tier}</span>
          <Badge variant={released ? 'default' : disputed ? 'destructive' : 'secondary'}>
            {disputed ? 'Disputed' : released ? 'Payout released' : 'Payout held'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {order.auto_release_at && !released && !disputed && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Auto-releases {formatDistanceToNow(new Date(order.auto_release_at), { addSuffix: true })}
          </p>
        )}

        {/* TIER 1 */}
        {tier === 'tier1' && (
          <Button onClick={onDownload} className="w-full gap-2">
            <Download className="h-4 w-4" /> Download
          </Button>
        )}

        {/* TIER 2 — EU waiver + unlock */}
        {tier === 'tier2' && !released && !disputed && (
          <>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={waiver} onCheckedChange={(v) => setWaiver(!!v)} />
              <span>
                I want immediate access and waive my 14-day right of withdrawal
                (required for EU buyers to unlock instant digital delivery).
              </span>
            </label>
            <Button
              disabled={!waiver || confirm.isPending}
              onClick={() => confirm.mutate()}
              className="w-full gap-2"
            >
              {confirm.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Confirm & unlock download
            </Button>
          </>
        )}
        {tier === 'tier2' && released && (
          <Button onClick={onDownload} className="w-full gap-2">
            <Download className="h-4 w-4" /> Download
          </Button>
        )}

        {/* TIER 3 — direct delivery */}
        {tier === 'tier3' && !released && !disputed && (
          <>
            {!order.seller_marked_delivered_at ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" /> Waiting for seller to deliver…
              </p>
            ) : (
              <p className="text-sm text-foreground flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" /> Seller marked as delivered.
              </p>
            )}
            <div className="flex gap-2">
              <Button
                onClick={() => confirm.mutate()}
                disabled={confirm.isPending}
                className="flex-1 gap-2"
              >
                {confirm.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Confirm receipt
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <ShieldAlert className="h-4 w-4" /> Open dispute
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Open a dispute?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The seller's payout will be frozen and an admin will review your case.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Textarea
                    placeholder="Describe the issue (min 10 chars)"
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                  />
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => openDispute.mutate()}
                      disabled={disputeReason.trim().length < 10 || openDispute.isPending}
                    >
                      Open dispute
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
        {tier === 'tier3' && disputed && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" /> Dispute opened — awaiting admin resolution.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
