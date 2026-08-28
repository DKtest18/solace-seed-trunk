import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, CheckCircle, XCircle, Shield, FileText, Download } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { HourglassLoader } from '@/components/HourglassLoader';

const REASON_LABEL: Record<string, string> = {
  not_delivered: 'Product not delivered',
  not_as_described: 'Product not as described',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  under_review: 'secondary',
  approved: 'default',
  rejected: 'destructive',
  refunded: 'default',
  failed: 'destructive',
};

export default function AdminRefundRequests() {
  const { user } = useAuth();
  const { hasRole: isAdmin, isLoading: roleLoading } = useHasRole('admin');
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<any | null>(null);
  const [notes, setNotes] = useState('');

  const { data: requests, isLoading } = useQuery({
    queryKey: ['admin-refund-requests'],
    queryFn: async () => {
      const { data, error } = await db
        .from('dkai_refund_requests')
        .select(`
          *,
          dkai_products(id, title),
          dkai_orders(id, price, currency, created_at, stripe_payment_intent_id)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user && isAdmin,
  });

  const decide = useMutation({
    mutationFn: async ({ id, decision, notes }: { id: string; decision: 'approve' | 'reject'; notes: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-decide-refund-request', {
        body: { refundRequestId: id, decision, adminNotes: notes },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.decision === 'approve' ? 'Refund approved and issued via Stripe' : 'Refund request rejected');
      queryClient.invalidateQueries({ queryKey: ['admin-refund-requests'] });
      setSelected(null);
      setNotes('');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to decide refund request'),
  });

  const evidenceUrl = async (path: string) => {
    const { data } = await supabase.storage.from('refund-evidence').createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
    else toast.error('Could not open evidence');
  };

  if (roleLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <HourglassLoader size={64} />
        </div>
      </AppLayout>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  const pending = requests?.filter((r) => r.status === 'pending' || r.status === 'under_review') ?? [];
  const decided = requests?.filter((r) => !['pending', 'under_review'].includes(r.status)) ?? [];

  const renderTable = (rows: any[], emptyLabel: string) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Submitted</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Buyer email</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                {emptyLabel}
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-xs">{format(new Date(r.created_at), 'PP p')}</TableCell>
              <TableCell className="max-w-[240px] truncate">
                {r.dkai_products?.title ?? '—'}
              </TableCell>
              <TableCell className="text-xs">{r.buyer_email}</TableCell>
              <TableCell>
                <Badge variant="outline">{REASON_LABEL[r.reason] ?? r.reason}</Badge>
              </TableCell>
              <TableCell>
                {r.dkai_orders?.price?.toFixed(2)} {(r.dkai_orders?.currency ?? 'USD').toUpperCase()}
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[r.status] ?? 'secondary'}>{r.status}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" onClick={() => { setSelected(r); setNotes(r.admin_notes ?? ''); }}>
                  Review
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">Refund requests</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pending review ({pending.length})</CardTitle>
            <CardDescription>
              Approve to issue a Stripe refund from the seller&apos;s balance. Reject with notes if the claim is not valid.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <HourglassLoader size={48} />
            ) : (
              renderTable(pending, 'No pending refund requests.')
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Decided ({decided.length})</CardTitle>
          </CardHeader>
          <CardContent>{renderTable(decided, 'No decided refund requests yet.')}</CardContent>
        </Card>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>Refund request</DialogTitle>
                <DialogDescription>
                  {selected.dkai_products?.title} — {selected.buyer_email}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Reason</p>
                    <p className="font-medium">{REASON_LABEL[selected.reason]}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Status</p>
                    <Badge variant={STATUS_VARIANT[selected.status]}>{selected.status}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Order date</p>
                    <p>{selected.dkai_orders?.created_at ? format(new Date(selected.dkai_orders.created_at), 'PPP') : '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Amount</p>
                    <p>
                      {selected.dkai_orders?.price?.toFixed(2)}{' '}
                      {(selected.dkai_orders?.currency ?? 'USD').toUpperCase()}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-muted-foreground text-xs mb-1">Buyer description</p>
                  <div className="p-3 border rounded bg-muted/30 text-sm whitespace-pre-wrap">
                    {selected.description}
                  </div>
                </div>

                {selected.evidence_paths?.length > 0 && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Evidence</p>
                    <div className="space-y-1">
                      {selected.evidence_paths.map((p: string) => (
                        <Button
                          key={p}
                          variant="outline"
                          size="sm"
                          onClick={() => evidenceUrl(p)}
                          className="w-full justify-start"
                        >
                          <FileText className="h-3 w-3 mr-2" />
                          <span className="truncate flex-1 text-left">{p.split('/').pop()}</span>
                          <Download className="h-3 w-3 ml-2" />
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="admin-notes">Admin notes (visible internally; included in buyer email)</Label>
                  <Textarea
                    id="admin-notes"
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Confirmed seller did not deliver within 24h — refund approved."
                  />
                </div>

                {selected.stripe_refund_id && (
                  <div className="text-xs text-muted-foreground">
                    Stripe refund id: <code>{selected.stripe_refund_id}</code>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                {['pending', 'under_review'].includes(selected.status) && (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => decide.mutate({ id: selected.id, decision: 'reject', notes })}
                      disabled={decide.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                    <Button
                      onClick={() => decide.mutate({ id: selected.id, decision: 'approve', notes })}
                      disabled={decide.isPending}
                    >
                      {decide.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-1" />
                      )}
                      Approve &amp; issue refund
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
