import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, CheckCircle2, XCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

type WaitlistRow = {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  reason_for_joining: string | null;
  status: 'pending' | 'approved' | 'declined';
  reviewed_by: string | null;
  reviewed_at: string | null;
  declined_reason: string | null;
  created_at: string;
};

const PAGE_SIZE = 50;

export default function AdminWaitlistPage() {
  return (
    <AdminRouteGuard>
      <AdminWaitlistContent />
    </AdminRouteGuard>
  );
}

function AdminWaitlistContent() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'approved' | 'declined'>('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const [approveTarget, setApproveTarget] = useState<WaitlistRow | null>(null);
  const [declineTarget, setDeclineTarget] = useState<WaitlistRow | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin-waitlist', tab, page],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await db
        .from('dkai_waitlist')
        .select('*')
        .eq('status', tab)
        .order('created_at', { ascending: false })
        .range(from, to);
      if (error) throw error;
      return (data || []) as WaitlistRow[];
    },
  });

  const { data: verification = {} } = useQuery({
    queryKey: ['admin-waitlist-verification', rows.map((r) => r.user_id).join(',')],
    enabled: rows.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-waitlist-verification', {
        body: { user_ids: rows.map((r) => r.user_id) },
      });
      if (error) throw error;
      return (data?.verification || {}) as Record<string, { email_confirmed_at: string | null }>;
    },
  });

  const { data: counts } = useQuery({
    queryKey: ['admin-waitlist-counts'],
    queryFn: async () => {
      const fetchCount = async (status: string) => {
        const { count } = await db
          .from('dkai_waitlist')
          .select('id', { count: 'exact', head: true })
          .eq('status', status);
        return count || 0;
      };
      const [pending, approved, declined] = await Promise.all([
        fetchCount('pending'),
        fetchCount('approved'),
        fetchCount('declined'),
      ]);
      return { pending, approved, declined };
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.email || '').toLowerCase().includes(q) ||
        (r.full_name || '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  const approveMutation = useMutation({
    mutationFn: async (waitlist_id: string) => {
      const { data, error } = await supabase.functions.invoke('approve-waitlist-applicant', {
        body: { waitlist_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success('Applicant approved');
      setApproveTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin-waitlist'] });
      queryClient.invalidateQueries({ queryKey: ['admin-waitlist-counts'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to approve'),
  });

  const declineMutation = useMutation({
    mutationFn: async (args: { waitlist_id: string; reason: string }) => {
      const { data, error } = await supabase.functions.invoke('decline-waitlist-applicant', {
        body: args,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success('Applicant declined');
      setDeclineTarget(null);
      setDeclineReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-waitlist'] });
      queryClient.invalidateQueries({ queryKey: ['admin-waitlist-counts'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to decline'),
  });

  const initials = (name: string | null, email: string) =>
    (name || email || '?')
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();

  const fmtDate = (d: string) => {
    try {
      return format(new Date(d), 'PP');
    } catch {
      return d;
    }
  };

  const truncate = (s: string | null, n = 80) =>
    !s ? '—' : s.length <= n ? s : s.slice(0, n) + '…';

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-semibold text-gray-900">Waitlist</h1>
        <p className="text-muted mt-2">
          Review and approve applicants who signed up during pre-launch.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-4">
            <span>Applicants</span>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <Input
                placeholder="Search name or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => { setTab(v as any); setPage(0); }}>
            <TabsList>
              <TabsTrigger value="pending">
                Pending {counts?.pending != null && <Badge variant="secondary" className="ml-2">{counts.pending}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved {counts?.approved != null && <Badge variant="secondary" className="ml-2">{counts.approved}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="declined">
                Declined {counts?.declined != null && <Badge variant="secondary" className="ml-2">{counts.declined}</Badge>}
              </TabsTrigger>
            </TabsList>

            {(['pending', 'approved', 'declined'] as const).map((status) => (
              <TabsContent key={status} value={status} className="mt-4">
                {isLoading ? (
                  <div className="py-16 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-16 text-center text-muted">No {status} applicants.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Verified</TableHead>
                        <TableHead>Joined</TableHead>
                        {status === 'pending' && <TableHead>Reason</TableHead>}
                        {status === 'approved' && <TableHead>Approved</TableHead>}
                        {status === 'declined' && <TableHead>Decline reason</TableHead>}
                        {status === 'pending' && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <div className="h-8 w-8 rounded-full bg-primary-soft text-primary flex items-center justify-center text-xs font-semibold">
                              {initials(row.full_name, row.email)}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{row.full_name || '—'}</TableCell>
                          <TableCell className="text-sm">{row.email}</TableCell>
                          <TableCell>
                            {verification[row.user_id]?.email_confirmed_at ? (
                              <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-700 border-amber-300">
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted">{fmtDate(row.created_at)}</TableCell>
                          {status === 'pending' && (
                            <TableCell title={row.reason_for_joining || ''} className="max-w-sm">
                              {truncate(row.reason_for_joining)}
                            </TableCell>
                          )}
                          {status === 'approved' && (
                            <TableCell className="text-sm text-muted">
                              {row.reviewed_at ? fmtDate(row.reviewed_at) : '—'}
                            </TableCell>
                          )}
                          {status === 'declined' && (
                            <TableCell title={row.declined_reason || ''} className="max-w-sm">
                              {truncate(row.declined_reason)}
                            </TableCell>
                          )}
                          {status === 'pending' && (
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  onClick={() => setApproveTarget(row)}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setDeclineTarget(row)}
                                >
                                  <XCircle className="h-4 w-4 mr-1" /> Decline
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-muted">
                    Page {page + 1}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={rows.length < PAGE_SIZE}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Approve confirm dialog */}
      <Dialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve applicant?</DialogTitle>
            <DialogDescription>
              {approveTarget?.full_name || approveTarget?.email} will get full
              access immediately and receive an email.
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
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline dialog */}
      <Dialog
        open={!!declineTarget}
        onOpenChange={(o) => { if (!o) { setDeclineTarget(null); setDeclineReason(''); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline applicant</DialogTitle>
            <DialogDescription>
              Please provide a reason. It will be shared with the applicant by email.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for declining"
            value={declineReason}
            maxLength={500}
            onChange={(e) => setDeclineReason(e.target.value)}
            rows={4}
          />
          <div className="text-xs text-muted text-right">{declineReason.length}/500</div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDeclineTarget(null); setDeclineReason(''); }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={declineMutation.isPending || declineReason.trim().length < 3}
              onClick={() =>
                declineTarget &&
                declineMutation.mutate({ waitlist_id: declineTarget.id, reason: declineReason.trim() })
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
