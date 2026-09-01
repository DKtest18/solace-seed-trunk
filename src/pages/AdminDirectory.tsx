import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '@/lib/dkaiDb';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { HourglassLoader } from '@/components/HourglassLoader';
import { FoundingSellerBadge } from '@/components/FoundingSellerBadge';
import { Building2, Search, ShieldCheck, Users } from 'lucide-react';

const PAGE_SIZE = 25;
const FOUNDING_SLOTS = 5;
const FOUNDING_FREE_SALES = 4;

type DirectoryRow = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  country: string | null;
  is_founding_seller: boolean | null;
  platform_fee_percent: number | null;
  settled_sales: number | null;
  product_count: number | null;
  is_seller: boolean | null;
  seller_kind: string | null;
  company_legal_name: string | null;
  total_count: number | null;
};

type CompanyRow = {
  user_id: string;
  company_legal_name: string | null;
  company_legal_form: string | null;
  company_registration_country: string | null;
  company_registration_number: string | null;
  company_address: string | null;
  company_representative_name: string | null;
  company_contact_email: string | null;
  company_logo_path: string | null;
  company_logo_public: boolean | null;
  seller_type_updated_at: string | null;
  is_founding_seller: boolean | null;
  settled_sales: number | null;
};

function logoUrl(path?: string | null) {
  if (!path) return null;
  return supabase.storage.from('company-logos').getPublicUrl(path).data.publicUrl;
}

function money(value: unknown) {
  const n = Number(value ?? 0);
  return `CHF ${n.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AdminDirectory() {
  const { toast } = useToast();

  const [tab, setTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DirectoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companyDetail, setCompanyDetail] = useState<CompanyRow | null>(null);

  const [stats, setStats] = useState<Record<string, any> | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const foundingCount = useMemo(
    () => rows.filter((r) => r.is_founding_seller).length,
    [rows],
  );

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await db.rpc('dkai_admin_user_directory', {
        _search: search || null,
        _limit: PAGE_SIZE,
        _offset: page * PAGE_SIZE,
      });
      if (error) throw error;
      const list = (data ?? []) as DirectoryRow[];
      setRows(list);
      setTotal(Number(list[0]?.total_count ?? 0));
    } catch (e: any) {
      toast({
        title: 'Could not load users',
        description: e?.message ?? 'Admin access required.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
    setCompaniesLoading(true);
    try {
      const { data, error } = await db.rpc('dkai_admin_companies');
      if (error) throw error;
      setCompanies((data ?? []) as CompanyRow[]);
    } catch (e: any) {
      toast({ title: 'Could not load companies', description: e?.message, variant: 'destructive' });
    } finally {
      setCompaniesLoading(false);
    }
  };

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const { data, error } = await db.rpc('dkai_admin_platform_analytics');
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setStats(data as Record<string, any>);
    } catch (e: any) {
      toast({ title: 'Could not load analytics', description: e?.message, variant: 'destructive' });
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  useEffect(() => {
    if (tab === 'companies' && !companies.length) loadCompanies();
    if (tab === 'analytics' && !stats) loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const toggleFounding = async (row: DirectoryRow, next: boolean) => {
    setBusyId(row.id);
    try {
      const { data, error } = await db.rpc('dkai_admin_set_founding_seller', {
        _user_id: row.id,
        _is_founding: next,
      });
      if (error) throw error;
      const res = data as any;
      if (!res?.ok) {
        toast({
          title: res?.error === 'founding_limit_reached'
            ? `Founding limit reached (${FOUNDING_SLOTS} accounts)`
            : 'Change rejected',
          description: res?.error === 'founding_limit_reached'
            ? 'Remove founding status from another seller first.'
            : String(res?.error ?? 'Unknown error'),
          variant: 'destructive',
        });
        return;
      }
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, is_founding_seller: next } : r)),
      );
      toast({
        title: next ? 'Marked as founding seller' : 'Founding status removed',
        description: next
          ? `0% platform fee on their first ${FOUNDING_FREE_SALES} completed sales.`
          : undefined,
      });
    } catch (e: any) {
      toast({ title: 'Update failed', description: e?.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Admin Directory
          </h1>
          <p className="text-sm text-muted-foreground">
            Users, companies and platform analytics. Buyer credentials are never shown here.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/admin/user-moderation">User moderation (bans / deletion)</Link>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-2" />Users</TabsTrigger>
          <TabsTrigger value="companies"><Building2 className="h-4 w-4 mr-2" />Companies</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* USERS */}
        <TabsContent value="users" className="space-y-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(0);
              setSearch(searchInput.trim());
            }}
          >
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search email, name, username or company"
              maxLength={120}
            />
            <Button type="submit" variant="secondary">
              <Search className="h-4 w-4" />
            </Button>
          </form>

          <p className="text-xs text-muted-foreground">
            Founding sellers: {foundingCount} shown on this page · limit {FOUNDING_SLOTS} accounts
            platform-wide · each gets 0% fee on their own first {FOUNDING_FREE_SALES} completed sales.
          </p>

          {loading ? (
            <div className="flex justify-center py-16"><HourglassLoader size={128} /></div>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Products</TableHead>
                      <TableHead className="text-right">Settled sales</TableHead>
                      <TableHead className="text-right">Fee</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Founding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium flex items-center gap-2">
                            {r.full_name || r.username || '—'}
                            {r.is_founding_seller && <FoundingSellerBadge />}
                          </div>
                          <div className="text-xs text-muted-foreground">{r.email}</div>
                        </TableCell>
                        <TableCell>
                          {r.is_seller ? (
                            <Badge variant="secondary">
                              {r.seller_kind === 'company' ? 'Company' : 'Private seller'}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Buyer</Badge>
                          )}
                          {r.company_legal_name && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {r.company_legal_name}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{r.product_count ?? 0}</TableCell>
                        <TableCell className="text-right">{r.settled_sales ?? 0}</TableCell>
                        <TableCell className="text-right">
                          {r.is_founding_seller && (r.settled_sales ?? 0) < FOUNDING_FREE_SALES
                            ? '0%'
                            : `${Number(r.platform_fee_percent ?? 5)}%`}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={!!r.is_founding_seller}
                            disabled={busyId === r.id}
                            onCheckedChange={(v) => toggleFounding(r, v)}
                            aria-label="Toggle founding seller"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {!rows.length && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No users found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {total} users · page {page + 1} / {pages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* COMPANIES */}
        <TabsContent value="companies" className="space-y-4">
          {companiesLoading ? (
            <div className="flex justify-center py-16"><HourglassLoader size={128} /></div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {companies.map((c) => (
                <Card key={c.user_id} className="cursor-pointer" onClick={() => setCompanyDetail(c)}>
                  <CardHeader className="flex-row items-center gap-3 space-y-0">
                    {logoUrl(c.company_logo_path) ? (
                      <img
                        src={logoUrl(c.company_logo_path)!}
                        alt={`${c.company_legal_name ?? 'Company'} logo`}
                        className="h-10 w-10 rounded object-contain bg-muted"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">
                        {c.company_legal_name || '—'}
                      </CardTitle>
                      <CardDescription className="truncate">
                        {c.company_legal_form} · {c.company_registration_country}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground space-y-1">
                    <div>Reg. no: {c.company_registration_number || '—'}</div>
                    <div>Settled sales: {c.settled_sales ?? 0}</div>
                    <div className="flex gap-2 pt-1">
                      {c.is_founding_seller && <FoundingSellerBadge />}
                      {c.company_logo_public ? (
                        <Badge variant="secondary">Logo public</Badge>
                      ) : (
                        <Badge variant="outline">Logo private</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {!companies.length && (
                <p className="text-muted-foreground text-sm">No companies registered yet.</p>
              )}
            </div>
          )}
        </TabsContent>

        {/* ANALYTICS */}
        <TabsContent value="analytics" className="space-y-4">
          {statsLoading || !stats ? (
            <div className="flex justify-center py-16"><HourglassLoader size={128} /></div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['Users', stats.users_total],
                  ['New users (30d)', stats.users_last_30d],
                  ['Sellers', stats.sellers_total],
                  ['Companies', stats.companies_total],
                  ['Founding sellers', `${stats.founding_sellers} / ${FOUNDING_SLOTS}`],
                  ['Products live', stats.products_live],
                  ['Products pending review', stats.products_pending],
                  ['Orders settled', stats.orders_settled],
                  ['GMV (paid+)', money(stats.gmv)],
                  ['GMV last 30d', money(stats.gmv_last_30d)],
                  ['Platform fees', money(stats.platform_fees)],
                  ['Orders total', stats.orders_total],
                ].map(([label, value]) => (
                  <Card key={String(label)}>
                    <CardHeader className="pb-2">
                      <CardDescription>{label}</CardDescription>
                      <CardTitle className="text-2xl">{String(value ?? 0)}</CardTitle>
                    </CardHeader>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Last 12 months</CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">GMV</TableHead>
                        <TableHead className="text-right">Platform fees</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {((stats.revenue_by_month ?? []) as any[]).map((m) => (
                        <TableRow key={m.month}>
                          <TableCell>{m.month}</TableCell>
                          <TableCell className="text-right">{m.orders}</TableCell>
                          <TableCell className="text-right">{money(m.gmv)}</TableCell>
                          <TableCell className="text-right">{money(m.fees)}</TableCell>
                        </TableRow>
                      ))}
                      {!((stats.revenue_by_month ?? []) as any[]).length && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                            No paid orders yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!companyDetail} onOpenChange={(o) => !o && setCompanyDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{companyDetail?.company_legal_name || 'Company'}</DialogTitle>
            <DialogDescription>
              Self-declared company details. Nothing here is verified against a registry.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Legal form:</span> {companyDetail?.company_legal_form || '—'}</div>
            <div><span className="text-muted-foreground">Country:</span> {companyDetail?.company_registration_country || '—'}</div>
            <div><span className="text-muted-foreground">Registration no:</span> {companyDetail?.company_registration_number || '—'}</div>
            <div><span className="text-muted-foreground">Address:</span> {companyDetail?.company_address || '—'}</div>
            <div><span className="text-muted-foreground">Representative:</span> {companyDetail?.company_representative_name || '—'}</div>
            <div><span className="text-muted-foreground">Contact:</span> {companyDetail?.company_contact_email || '—'}</div>
            <div><span className="text-muted-foreground">Updated:</span> {companyDetail?.seller_type_updated_at ? new Date(companyDetail.seller_type_updated_at).toLocaleString() : '—'}</div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
