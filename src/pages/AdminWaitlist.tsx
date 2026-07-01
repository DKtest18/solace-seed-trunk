import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { db } from '@/lib/dkaiDb';
import { supabase } from '@/integrations/supabase/client';
import { AdminRouteGuard } from '@/components/AdminRouteGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, CheckCircle2, XCircle, Search, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

type ProductRow = {
  id: string;
  title: string;
  price: number | null;
  category: string | null;
  seller_id: string;
  review_status: 'submitted' | 'in_review' | 'approved' | 'rejected' | 'changes_requested';
  submitted_at: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  is_published: boolean | null;
};

type TabKey = 'submitted' | 'approved' | 'rejected';

export default function AdminWaitlistPage() {
  return (
    <AdminRouteGuard>
      <AdminProductQueueContent />
    </AdminRouteGuard>
  );
}

function AdminProductQueueContent() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>('submitted');
  const [search, setSearch] = useState('');

  const [approveTarget, setApproveTarget] = useState<ProductRow | null>(null);
  const [declineTarget, setDeclineTarget] = useState<ProductRow | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin-product-queue', tab],
    queryFn: async () => {
      const statuses =
        tab === 'submitted' ? ['submitted', 'in_review']
        : tab === 'approved' ? ['approved']
        : ['rejected', 'changes_requested'];
      const { data, error } = await db
        .from('dkai_products')
        .select('id, title, price, category, seller_id, review_status, submitted_at, reviewed_at, review_notes, created_at, is_published')
        .in('review_status', statuses)
        .order('submitted_at', { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) {
        console.error('[AdminWaitlist] query error', error);
        throw error;
      }
      console.log('[AdminWaitlist] tab=', tab, 'statuses=', statuses, 'rows=', data?.length ?? 0);
      return (data || []) as ProductRow[];
    },
    refetchInterval: 30_000,
  });

  const { data: counts } = useQuery({
    queryKey: ['admin-product-queue-counts'],
    queryFn: async () => {
      const fetchCount = async (statuses: string[]) => {
        const { count } = await db
          .from('dkai_products')
          .select('id', { count: 'exact', head: true })
          .in('review_status', statuses);
        return count || 0;
      };
      const [submitted, approved, rejected] = await Promise.all([
        fetchCount(['submitted', 'in_review']),
        fetchCount(['approved']),
        fetchCount(['rejected', 'changes_requested']),
      ]);
      return { submitted, approved, rejected };
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.title || '').toLowerCase().includes(q));
  }, [rows, search]);

  const approveMutation = useMutation({
    mutationFn: async (product_id: string) => {
      const { data, error } = await supabase.functions.invoke('decide-product-review', {
        body: { product_id, action: 'approve' },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      toast.success('Product approved and published');
      setApproveTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin-product-queue'] });
      queryClient.invalidateQueries({ queryKey: ['admin-product-queue-counts'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to approve'),
  });

  const declineMutation = useMutation({
    mutationFn: async (args: { product_id: string; reason: string | null }) => {
      const { data, error } = await supabase.functions.invoke('decide-product-review', {
        body: { product_id: args.product_id, action: 'reject', notes: args.reason },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      toast.success('Product declined');
      setDeclineTarget(null);
      setDeclineReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-product-queue'] });
      queryClient.invalidateQueries({ queryKey: ['admin-product-queue-counts'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to decline'),
  });

  const fmtDate = (d: string | null) => {
    if (!d) return '—';
    try { return format(new Date(d), 'PP'); } catch { return d; }
  };
  const truncate = (s: string | null, n = 80) =>
    !s ? '—' : s.length <= n ? s : s.slice(0, n) + '…';

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-semibold text-gray-900">Product Approvals</h1>
        <p className="text-muted-foreground mt-2">
          Review submitted products. Approving a product publishes it to the marketplace immediately.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-4">
            <span>Products</span>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search title"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
            <TabsList>
              <TabsTrigger value="submitted">
                Pending {counts?.submitted != null && <Badge variant="secondary" className="ml-2">{counts.submitted}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved {counts?.approved != null && <Badge variant="secondary" className="ml-2">{counts.approved}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Declined {counts?.rejected != null && <Badge variant="secondary" className="ml-2">{counts.rejected}</Badge>}
              </TabsTrigger>
            </TabsList>

            {(['submitted', 'approved', 'rejected'] as const).map((status) => (
              <TabsContent key={status} value={status} className="mt-4">
                {isLoading ? (
                  <div className="py-16 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground">No {status === 'submitted' ? 'pending' : status} products.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>{status === 'submitted' ? 'Submitted' : status === 'approved' ? 'Approved' : 'Declined'}</TableHead>
                        {status === 'rejected' && <TableHead>Reason</TableHead>}
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.title}</TableCell>
                          <TableCell className="text-sm">{row.category || '—'}</TableCell>
                          <TableCell className="text-sm">{row.price != null ? `€${row.price}` : '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {fmtDate(status === 'submitted' ? row.submitted_at : row.reviewed_at)}
                          </TableCell>
                          {status === 'rejected' && (
                            <TableCell title={row.review_notes || ''} className="max-w-sm">
                              {truncate(row.review_notes)}
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button asChild size="sm" variant="outline">
                                <Link to={`/product/${row.id}`} target="_blank">
                                  <ExternalLink className="h-4 w-4 mr-1" /> View
                                </Link>
                              </Button>
                              {status === 'submitted' && (
                                <>
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                    onClick={() => setApproveTarget(row)}
                                  >
                                    <CheckCircle2 className="h-4 w-4 mr-1" /> Accept
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => setDeclineTarget(row)}
                                  >
                                    <XCircle className="h-4 w-4 mr-1" /> Decline
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve product?</DialogTitle>
            <DialogDescription>
              <strong>{approveTarget?.title}</strong> will go live on the marketplace immediately and the seller will be notified by email.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)}>Cancel</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={approveMutation.isPending}
              onClick={() => approveTarget && approveMutation.mutate(approveTarget.id)}
            >
              {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Accept &amp; Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!declineTarget}
        onOpenChange={(o) => { if (!o) { setDeclineTarget(null); setDeclineReason(''); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline product</DialogTitle>
            <DialogDescription>
              Optionally provide a reason. If included, it will be sent to the seller by email.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason (optional)"
            value={declineReason}
            maxLength={500}
            onChange={(e) => setDeclineReason(e.target.value)}
            rows={4}
          />
          <div className="text-xs text-muted-foreground text-right">{declineReason.length}/500</div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDeclineTarget(null); setDeclineReason(''); }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={declineMutation.isPending}
              onClick={() =>
                declineTarget &&
                declineMutation.mutate({
                  product_id: declineTarget.id,
                  reason: declineReason.trim() ? declineReason.trim() : null,
                })
              }
            >
              {declineMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
