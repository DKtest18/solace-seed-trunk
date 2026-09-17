import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dkaiDb';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, TrendingUp, ShoppingCart, Clock, ShieldAlert } from 'lucide-react';
import { HourglassLoader } from '@/components/HourglassLoader';
import { formatMoney } from '@/lib/money';

const PAID = ['paid', 'completed', 'delivered', 'released', 'payment_confirmed', 'refunded', 'disputed'];

type PayoutRow = {
  order_id: string;
  seller_id: string;
  product_id: string | null;
  currency: string | null;
  gross_amount_minor: number | null;
  commission_rate: number | null;
  commission_amount_minor: number | null;
  processing_fee_minor: number | null;
  processing_fee_bearer: string | null;
  seller_entitlement_minor: number | null;
  refunded_amount_minor: number | null;
  reversed_amount_minor: number | null;
  seller_debt_minor: number | null;
  charge_mode: string | null;
  transfer_state: string | null;
  paid_at: string | null;
  transfer_eligible_at: string | null;
  transfer_completed_at: string | null;
  founding_benefit_applied: boolean | null;
  status: string | null;
};

function minorToMajor(value: number | null | undefined, currency: string | null | undefined) {
  const minor = Number(value ?? 0);
  const zeroDecimal = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf']);
  return zeroDecimal.has(String(currency ?? '').toLowerCase()) ? minor : minor / 100;
}

function money(row: PayoutRow, value: number | null | undefined) {
  return formatMoney(minorToMajor(value, row.currency), row.currency || 'chf');
}

function transferLabel(row: PayoutRow) {
  const state = row.transfer_state || 'not_applicable';
  if (row.charge_mode !== 'separate') return 'Legacy payment';
  if (state === 'completed') return row.transfer_completed_at ? `Transferred ${new Date(row.transfer_completed_at).toLocaleDateString()}` : 'Transferred';
  if (state === 'blocked') return 'Blocked — refund, dispute, or account action required';
  if (state === 'failed') return 'Retry scheduled';
  if (state === 'in_progress') return 'Transfer processing';
  if (row.transfer_eligible_at) return `Eligible for transfer after ${new Date(row.transfer_eligible_at).toLocaleDateString()}`;
  return 'Waiting for verified payment';
}

function statusVariant(state: string | null | undefined): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (state === 'completed') return 'default';
  if (state === 'blocked' || state === 'failed') return 'destructive';
  if (state === 'in_progress') return 'secondary';
  return 'outline';
}

export default function SellerEarnings() {
  const { user } = useAuth();
  const { hasRole: isSeller, isLoading: roleLoading } = useHasRole('seller');
  const { hasRole: isAdmin } = useHasRole('admin');

  const { data, isLoading } = useQuery({
    queryKey: ['seller-payout-overview', user?.id],
    queryFn: async () => {
      if (!user) return { rows: [], products: [] as any[] };
      const { data: rows, error } = await db
        .from('dkai_seller_payout_overview')
        .select('*')
        .eq('seller_id', user.id)
        .in('status', PAID)
        .order('paid_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      const productIds = Array.from(new Set((rows ?? []).map((r: any) => r.product_id).filter(Boolean)));
      const { data: products } = productIds.length
        ? await db.from('dkai_products').select('id,title').in('id', productIds)
        : { data: [] };
      return { rows: (rows ?? []) as PayoutRow[], products: products ?? [] };
    },
    enabled: !!user && (isSeller || isAdmin),
  });

  if (roleLoading || isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><HourglassLoader size={96} /></div>;
  }

  if (!isSeller && !isAdmin) return <Navigate to="/" replace />;

  const rows = data?.rows ?? [];
  const products = data?.products ?? [];
  const productTitle = (id: string | null) => products.find((p: any) => p.id === id)?.title || 'Unknown product';
  const totals = rows.reduce((acc, row) => {
    acc.gross += minorToMajor(row.gross_amount_minor, row.currency);
    acc.commission += minorToMajor(row.commission_amount_minor, row.currency);
    acc.fees += minorToMajor(row.processing_fee_minor, row.currency);
    acc.entitlement += minorToMajor(row.seller_entitlement_minor, row.currency);
    acc.debt += minorToMajor(row.seller_debt_minor, row.currency);
    if (row.transfer_state === 'completed') acc.transferred += minorToMajor(row.seller_entitlement_minor, row.currency);
    if (row.transfer_state !== 'completed') acc.held += minorToMajor(row.seller_entitlement_minor, row.currency);
    return acc;
  }, { gross: 0, commission: 0, fees: 0, entitlement: 0, transferred: 0, held: 0, debt: 0 });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-8 h-8 text-primary" />
            <h1 className="text-4xl font-bold">Seller Earnings</h1>
          </div>
          <p className="text-muted-foreground">
            Track sales, platform commission, actual Stripe fees, refunds and transfer status.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Seller Entitlement</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-primary">{formatMoney(totals.entitlement, 'chf')}</div><p className="text-xs text-muted-foreground mt-1">After commission, actual Stripe fees and refunds</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Held / Pending</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatMoney(totals.held, 'chf')}</div><p className="text-xs text-muted-foreground mt-1">Eligible only after the hold and checks</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Transferred</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatMoney(totals.transferred, 'chf')}</div><p className="text-xs text-muted-foreground mt-1">Released to Stripe account</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Platform Commission</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatMoney(totals.commission, 'chf')}</div><p className="text-xs text-muted-foreground mt-1">5% unless founding benefit applied</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Seller Recovery</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatMoney(totals.debt, 'chf')}</div><p className="text-xs text-muted-foreground mt-1">Outstanding reversals or dispute recovery</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Transaction History</CardTitle>
            <CardDescription>Amounts use Stripe's actual processing fee once the payment record is available.</CardDescription>
          </CardHeader>
          <CardContent>
            {rows.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Sale</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Stripe fees</TableHead>
                    <TableHead>Refunded</TableHead>
                    <TableHead>Seller entitlement</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.order_id}>
                      <TableCell>{row.paid_at ? new Date(row.paid_at).toLocaleDateString() : 'Pending'}</TableCell>
                      <TableCell>{productTitle(row.product_id)}</TableCell>
                      <TableCell>{money(row, row.gross_amount_minor)}</TableCell>
                      <TableCell>{money(row, row.commission_amount_minor)}{row.founding_benefit_applied ? <Badge variant="outline" className="ml-2">Founding</Badge> : null}</TableCell>
                      <TableCell>{row.processing_fee_minor == null ? 'Pending' : money(row, row.processing_fee_minor)}</TableCell>
                      <TableCell>{money(row, row.refunded_amount_minor)}</TableCell>
                      <TableCell className="font-medium">{money(row, row.seller_entitlement_minor)}</TableCell>
                      <TableCell><Badge variant={statusVariant(row.transfer_state)}>{transferLabel(row)}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-10 text-center text-muted-foreground">
                <ShoppingCart className="h-8 w-8 mx-auto mb-3" />
                No completed sales yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Transfer timing</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>New Stripe card payments become eligible for seller transfer after seven days, only if the payment has succeeded, Stripe funds are available, and the seller account can receive transfers.</p>
            <p>This is not escrow and it does not promise bank arrival within seven days.</p>
            <p className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Refunds, partial refunds, disputes, account restrictions, or unavailable Stripe balance can block or reduce a transfer.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
