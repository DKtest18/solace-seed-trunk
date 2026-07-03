import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/dkaiDb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useHasRole } from '@/hooks/useUserRole';
import { Loader2, Shield, Ban, Trash2, RotateCcw } from 'lucide-react';

const PAGE_SIZE = 25;

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string | null;
  seller_type: string | null;
  is_banned: boolean | null;
  ban_expires_at: string | null;
  ban_reason: string | null;
  is_deleted: boolean | null;
  can_reregister: boolean | null;
  deletion_reason: string | null;
  product_count: number;
};

export default function AdminUsers() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Server-side role check — the previous hardcoded email comparison could be
  // trivially bypassed client-side. Every admin edge function must ALSO
  // re-verify the super_admin role server-side; this hook is UI-only.
  const { hasRole: isSuperAdmin, isLoading: roleLoading } = useHasRole('super_admin');

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [banOpen, setBanOpen] = useState(false);
  const [target, setTarget] = useState<UserRow | null>(null);

  const [delReason, setDelReason] = useState('');
  const [allowReregister, setAllowReregister] = useState(false);

  const [banReason, setBanReason] = useState('');
  const [banType, setBanType] = useState<'permanent' | 'timed'>('permanent');
  const [banUntil, setBanUntil] = useState('');

  useEffect(() => {
    if (!authLoading && !roleLoading && !isSuperAdmin) navigate('/');
  }, [authLoading, roleLoading, isSuperAdmin, navigate]);


  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-list-users', {
        body: {
          page,
          page_size: PAGE_SIZE,
          search: search.trim() || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setUsers(data?.users || []);
      setTotal(data?.total || 0);
    } catch (e: any) {
      toast({ title: 'Failed to load users', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (isSuperAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, page]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    load();
  };

  const invoke = async (fn: string, body: any) => {
    const { data, error } = await supabase.functions.invoke(fn, { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handleDelete = async () => {
    if (!target) return;
    setActionLoading(true);
    try {
      await invoke('delete-user', {
        user_id: target.id,
        reason: delReason || null,
        allow_reregister: allowReregister,
      });
      toast({ title: 'Account deleted', description: target.email || '' });
      setDeleteOpen(false);
      setDelReason('');
      setAllowReregister(false);
      load();
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleBan = async () => {
    if (!target) return;
    if (banType === 'timed' && !banUntil) {
      toast({ title: 'Pick an end date', variant: 'destructive' });
      return;
    }
    setActionLoading(true);
    try {
      await invoke('ban-user', {
        user_id: target.id,
        reason: banReason || null,
        ban_expires_at: banType === 'permanent' ? null : new Date(banUntil).toISOString(),
      });
      toast({ title: 'User banned' });
      setBanOpen(false);
      setBanReason('');
      setBanUntil('');
      setBanType('permanent');
      load();
    } catch (e: any) {
      toast({ title: 'Ban failed', description: e.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnban = async (u: UserRow) => {
    setActionLoading(true);
    try {
      await invoke('unban-user', { user_id: u.id });
      toast({ title: 'User unbanned' });
      load();
    } catch (e: any) {
      toast({ title: 'Unban failed', description: e.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const status = (u: UserRow) => {
    if (u.is_deleted) return <Badge variant="destructive">Deleted{u.can_reregister ? ' (re-register OK)' : ''}</Badge>;
    if (u.is_banned) {
      const expired = u.ban_expires_at && new Date(u.ban_expires_at) < new Date();
      if (expired) return <Badge variant="secondary">Ban expired</Badge>;
      return <Badge variant="destructive">Banned{u.ban_expires_at ? ` until ${new Date(u.ban_expires_at).toLocaleDateString()}` : ''}</Badge>;
    }
    return <Badge variant="secondary">Active</Badge>;
  };

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>;
  }
  if (!isSuperAdmin) return null;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-display font-semibold text-gray-900">User Management</h1>
      </div>

      <form onSubmit={onSearchSubmit} className="flex gap-2 mb-4">
        <Input
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        <Button type="submit" variant="outline">Search</Button>
      </form>

      <div className="border rounded-lg bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Seller</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Products</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="animate-spin inline" /></TableCell></TableRow>
            ) : users.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No users found</TableCell></TableRow>
            ) : users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="text-gray-900">{u.email}</TableCell>
                <TableCell className="text-gray-900">{u.full_name || '—'}</TableCell>
                <TableCell className="text-gray-700">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</TableCell>
                
                <TableCell className="text-gray-700">{u.seller_type || '—'}</TableCell>
                <TableCell>{status(u)}</TableCell>
                <TableCell className="text-gray-700">{u.product_count}</TableCell>
                <TableCell className="text-right space-x-2">
                  {u.is_banned && !u.is_deleted && (
                    <Button size="sm" variant="outline" onClick={() => handleUnban(u)} disabled={actionLoading}>
                      <RotateCcw className="w-3 h-3 mr-1" />Unban
                    </Button>
                  )}
                  {!u.is_deleted && !u.is_banned && (
                    <Button size="sm" variant="outline" onClick={() => { setTarget(u); setBanOpen(true); }}>
                      <Ban className="w-3 h-3 mr-1" />Ban
                    </Button>
                  )}
                  {!u.is_deleted && (
                    <Button size="sm" variant="destructive" onClick={() => { setTarget(u); setDeleteOpen(true); }}>
                      <Trash2 className="w-3 h-3 mr-1" />Delete
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-muted-foreground">{total} users · Page {page + 1} of {totalPages}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>
              {target?.email} — sign-in will be blocked. All data is preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-900">Reason (optional)</label>
              <Textarea value={delReason} onChange={(e) => setDelReason(e.target.value)} rows={3} />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-900">
              <Checkbox checked={allowReregister} onCheckedChange={(v) => setAllowReregister(!!v)} />
              Allow this user to sign up again with the same data
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={actionLoading}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban Dialog */}
      <Dialog open={banOpen} onOpenChange={setBanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban account</DialogTitle>
            <DialogDescription>{target?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-900">Ban type</label>
              <Select value={banType} onValueChange={(v: any) => setBanType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="permanent">Permanent</SelectItem>
                  <SelectItem value="timed">Until a date</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {banType === 'timed' && (
              <div>
                <label className="text-sm font-medium text-gray-900">Ban until</label>
                <Input type="datetime-local" value={banUntil} onChange={(e) => setBanUntil(e.target.value)} />
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-900">Reason (optional)</label>
              <Textarea value={banReason} onChange={(e) => setBanReason(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanOpen(false)} disabled={actionLoading}>Cancel</Button>
            <Button variant="destructive" onClick={handleBan} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ban user'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
