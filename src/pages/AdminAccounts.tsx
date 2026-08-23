import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Search, Ban, Trash2, ArrowUpDown, ExternalLink } from 'lucide-react';
import { REVIEW_STATUS_GROUPS, REVIEW_STATUS_LABEL, normalizeReviewStatus } from '@/lib/reviewStatus';

interface AccountRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  username?: string | null;
  signed_up: string | null;
  last_sign_in: string | null;
  is_seller: boolean | null;
  banned_at: string | null;
  total_products: number | null;
  published_products: number | null;
}

type SortKey = 'signed_up' | 'total_products';

const MIN_REASON = 15;

export default function AdminAccounts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('signed_up');
  const [sortAsc, setSortAsc] = useState(false);
  const [selected, setSelected] = useState<AccountRow | null>(null);
  const [actionType, setActionType] = useState<'ban' | 'delete' | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const accountsQuery = useQuery({
    queryKey: ['admin-account-overview'],
    queryFn: async () => {
      const { data, error } = await db.rpc('dkai_admin_account_overview');
      if (error) throw error;
      return (data as AccountRow[]) ?? [];
    },
  });

  const historyQuery = useQuery({
    queryKey: ['admin-account-actions', selected?.user_id],
    enabled: !!selected?.user_id,
    queryFn: async () => {
      const { data, error } = await db
        .from('dkai_admin_account_actions')
        .select('id, action, reason, created_at, actor_id')
        .eq('target_user_id', selected!.user_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const productsQuery = useQuery({
    queryKey: ['admin-account-products', selected?.user_id],
    enabled: !!selected?.user_id,
    queryFn: async () => {
      const { data, error } = await db
        .from('dkai_products')
        .select('id, title, review_status')
        .eq('seller_id', selected!.user_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const accounts = accountsQuery.data ?? [];

  const summary = useMemo(
    () => ({
      accounts: accounts.length,
      sellers: accounts.filter((a) => a.is_seller).length,
      products: accounts.reduce((s, a) => s + (a.total_products ?? 0), 0),
      published: accounts.reduce((s, a) => s + (a.published_products ?? 0), 0),
    }),
    [accounts],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? accounts.filter((a) =>
          [a.display_name, a.username, a.email]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)),
        )
      : accounts;

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'signed_up') {
        cmp =
          new Date(a.signed_up ?? 0).getTime() - new Date(b.signed_up ?? 0).getTime();
      } else {
        cmp = (a.total_products ?? 0) - (b.total_products ?? 0);
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [accounts, search, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const submitAction = async () => {
    if (!selected || !actionType || reason.trim().length < MIN_REASON) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const { error: insError } = await db.from('dkai_admin_account_actions').insert({
        target_user_id: selected.user_id,
        actor_id: user?.id,
        action: actionType,
        reason: reason.trim(),
      });
      if (insError) throw insError;

      if (actionType === 'ban') {
        const { error: banError } = await db
          .from('dkai_profiles')
          .update({
            banned_at: new Date().toISOString(),
            ban_reason: reason.trim(),
            is_banned: true,
          })
          .eq('id', selected.user_id);
        if (banError) throw banError;
      } else {
        const { error: delError } = await db
          .from('dkai_profiles')
          .update({ is_deleted: true, deletion_reason: reason.trim() })
          .eq('id', selected.user_id);
        if (delError) throw delError;
      }

      setReason('');
      setActionType(null);
      queryClient.invalidateQueries({ queryKey: ['admin-account-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-account-actions', selected.user_id] });
    } catch (e: any) {
      setActionError(e?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  };

  // A product page only exists once it is live or under review. 'pending' was
  // checked here previously but nothing ever writes it.
  const canOpenProduct = (p: any) => {
    const status = normalizeReviewStatus(p.review_status);
    return (
      ([...REVIEW_STATUS_GROUPS.LIVE, ...REVIEW_STATUS_GROUPS.PENDING] as string[]).includes(status)
    );
  };

  return (
    <AppLayout>
      <div className="container mx-auto max-w-7xl px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Account analytics</h1>
          <p className="text-sm text-muted-foreground">
            Read-only overview of all accounts. No user data can be edited from this page.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total accounts', value: summary.accounts },
            { label: 'Total sellers', value: summary.sellers },
            { label: 'Total products', value: summary.products },
            { label: 'Published products', value: summary.published },
          ].map((c) => (
            <Card key={c.label}>
              <CardHeader className="pb-2">
                <CardDescription>{c.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {accountsQuery.error && (
          <Alert variant="destructive">
            <AlertDescription className="break-words">
              {(accountsQuery.error as any)?.message ?? String(accountsQuery.error)}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by display name, username or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            {accountsQuery.isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>
                        <button
                          className="inline-flex items-center gap-1"
                          onClick={() => toggleSort('signed_up')}
                        >
                          Signed up <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead>Last sign-in</TableHead>
                      <TableHead>
                        <button
                          className="inline-flex items-center gap-1"
                          onClick={() => toggleSort('total_products')}
                        >
                          Products <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </TableHead>
                      <TableHead>Published</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((a) => (
                      <TableRow key={a.user_id}>
                        <TableCell className="font-medium">
                          {a.display_name ?? a.username ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{a.email ?? '—'}</TableCell>
                        <TableCell className="text-sm">
                          {a.signed_up ? new Date(a.signed_up).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {a.last_sign_in ? new Date(a.last_sign_in).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell>{a.total_products ?? 0}</TableCell>
                        <TableCell>{a.published_products ?? 0}</TableCell>
                        <TableCell className="space-x-1">
                          {a.is_seller && <Badge variant="secondary">Seller</Badge>}
                          {a.banned_at && <Badge variant="destructive">Banned</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => setSelected(a)}>
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {visible.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          No accounts found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) {
            setSelected(null);
            setActionType(null);
            setReason('');
            setActionError(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.display_name ?? selected?.email ?? 'Account'}</DialogTitle>
            <DialogDescription>
              Read-only account record, product counts and moderation history.
            </DialogDescription>
          </DialogHeader>

          {actionError && (
            <Alert variant="destructive">
              <AlertDescription className="break-words">{actionError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Products ({selected?.total_products ?? 0} total, {selected?.published_products ?? 0}{' '}
                published)
              </h3>
              {productsQuery.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ul className="space-y-1 text-sm">
                  {(productsQuery.data ?? []).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{p.title}</span>
                      <span className="flex items-center gap-2">
                        <Badge variant="outline">{REVIEW_STATUS_LABEL[normalizeReviewStatus(p.review_status)]}</Badge>
                        {canOpenProduct(p) ? (
                          <Link
                            to={`/product/${p.id}`}
                            className="text-primary inline-flex items-center gap-1 hover:underline"
                          >
                            Open <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not openable</span>
                        )}
                      </span>
                    </li>
                  ))}
                  {(productsQuery.data ?? []).length === 0 && (
                    <li className="text-muted-foreground">No products.</li>
                  )}
                </ul>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Moderation actions</h3>
              <div className="flex gap-2">
                <Button
                  variant={actionType === 'ban' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActionType('ban')}
                >
                  <Ban className="h-4 w-4 mr-2" /> Ban account
                </Button>
                <Button
                  variant={actionType === 'delete' ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => setActionType('delete')}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete account
                </Button>
              </div>

              {actionType && (
                <div className="space-y-2">
                  <Label htmlFor="reason">
                    Reason (min. {MIN_REASON} characters) — {reason.trim().length}/{MIN_REASON}
                  </Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Document why this action is being taken."
                  />
                  <Button
                    variant={actionType === 'delete' ? 'destructive' : 'default'}
                    disabled={reason.trim().length < MIN_REASON || submitting}
                    onClick={submitAction}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Confirm {actionType}
                  </Button>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Action history</h3>
              {historyQuery.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ul className="space-y-2 text-sm">
                  {(historyQuery.data ?? []).map((h) => (
                    <li key={h.id} className="rounded border p-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">{h.action}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(h.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-muted-foreground break-words">{h.reason}</p>
                    </li>
                  ))}
                  {(historyQuery.data ?? []).length === 0 && (
                    <li className="text-muted-foreground">No actions recorded.</li>
                  )}
                </ul>
              )}
            </div>
          </div>

          <DialogFooter />
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
