import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useHasRole } from '@/hooks/useUserRole';
import { useSellerProducts } from '@/hooks/useAnalytics';
import { useAllProductsAnalytics } from '@/hooks/useProductAnalytics';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { SellerSidebar } from '@/components/SellerSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Loader2,
  Eye,
  ShoppingCart,
  Pencil,
  Trash2,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  PackageOpen,
  ExternalLink,
  Truck,
} from 'lucide-react';
import { db } from '@/lib/dkaiDb';
import { formatMoney, subscriptionLabel } from '@/lib/money';
import { toast } from 'sonner';

type Bucket = 'draft' | 'in_review' | 'approved_pending_publish' | 'published' | 'rejected' | 'deleted';

function reviewStatusOf(p: any): string {
  return String(p.review_status || p.approval_status || p.status || '').toLowerCase();
}

/**
 * Same condition the public marketplace query uses:
 * is_published === true AND review_status === 'approved'.
 */
export function isBuyable(p: any): boolean {
  return p?.is_published === true && reviewStatusOf(p) === 'approved';
}

function classifyProduct(p: any): Bucket {
  if (p.is_active === false || p.deleted_at) return 'deleted';
  const status = (p.status || '').toLowerCase();
  const review = reviewStatusOf(p);
  if (review === 'rejected') return 'rejected';
  if (status === 'draft' || review === 'draft') return 'draft';
  if (isBuyable(p)) return 'published';
  if (review === 'approved') return 'approved_pending_publish';
  return 'in_review';
}

function statusBadge(bucket: Bucket) {
  switch (bucket) {
    case 'draft':
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" /> Under review — not yet visible on the marketplace.
        </Badge>
      );
    case 'in_review':
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50">
          <Clock className="h-3 w-3 mr-1" /> Under review — not yet visible on the marketplace.
        </Badge>
      );
    case 'approved_pending_publish':
      return (
        <Badge variant="outline" className="border-blue-500 text-blue-700 bg-blue-50">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Approved — will be published soon.
        </Badge>
      );
    case 'published':
      return (
        <Badge variant="outline" className="border-green-600 text-green-700 bg-green-50">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Published
        </Badge>
      );
    case 'rejected':
      return (
        <Badge variant="outline" className="border-red-500 text-red-700 bg-red-50">
          <XCircle className="h-3 w-3 mr-1" /> Changes Requested
        </Badge>
      );
    case 'deleted':
      return (
        <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground bg-muted/40">
          <Trash2 className="h-3 w-3 mr-1" /> Deleted
        </Badge>
      );
  }
}

function deliveryLabel(p: any) {
  const mode = p.delivery_mode || p.delivery_tier;
  if (!mode) return '—';
  return String(mode).replace(/_/g, ' ');
}

export default function SellerProducts() {
  const { user } = useAuth();
  const { hasRole: isSeller, isLoading: roleLoading } = useHasRole('seller');
  const { hasRole: isAdmin } = useHasRole('admin');
  const navigate = useNavigate();

  const { data: products, isLoading, refetch } = useSellerProducts(user?.id);
  const { data: analytics } = useAllProductsAnalytics(user?.id);

  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as Bucket) || 'draft';
  const [tab, setTab] = useState<Bucket>(
    (['draft', 'in_review', 'approved_pending_publish', 'published', 'rejected', 'deleted'] as Bucket[]).includes(initialTab) ? initialTab : 'draft'
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  const grouped = useMemo(() => {
    const out: Record<Bucket, any[]> = { draft: [], in_review: [], approved_pending_publish: [], published: [], rejected: [], deleted: [] };
    (products ?? []).forEach((p: any) => out[classifyProduct(p)].push(p));
    return out;
  }, [products]);

  const analyticsById = useMemo(() => {
    const map = new Map<string, any>();
    (analytics ?? []).forEach((a: any) => map.set(a.product_id ?? a.id, a));
    return map;
  }, [analytics]);

  const handleDelete = async () => {
    if (!deletingId) return;
    // Soft delete: mark inactive
    const { error } = await db
      .from('dkai_products')
      .update({ is_active: false, deleted_at: new Date().toISOString(), is_published: false })
      .eq('id', deletingId);
    if (error) {
      toast.error(error.message || 'Failed to delete product');
    } else {
      toast.success('Product deleted');
      refetch();
    }
    setShowDelete(false);
    setDeletingId(null);
  };

  if (roleLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSeller && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Seller Access Required</CardTitle>
            <CardDescription>You need a seller account to access this area.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-2">
            <Button onClick={() => navigate('/seller-onboarding')} className="flex-1">Become a Seller</Button>
            <Button variant="outline" onClick={() => navigate('/')} className="flex-1">Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderCard = (p: any, bucket: Bucket) => {
    const a = analyticsById.get(p.id) || {};
    const views = a.views ?? p.views_count ?? 0;
    const sales = a.sales ?? p.sales_count ?? 0;
    const canDelete = bucket === 'draft' || bucket === 'rejected';

    return (
      <Card key={p.id} className="hover:shadow-md transition-shadow">
        <CardContent className="p-4 flex gap-4">
          <div className="w-24 h-24 rounded-md bg-muted flex-shrink-0 overflow-hidden">
            {p.image_url ? (
              <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <PackageOpen className="h-8 w-8" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold truncate">{p.title || 'Untitled draft'}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {statusBadge(bucket)}
                  {bucket !== 'draft' && bucket !== 'in_review' && (
                    <span className="text-sm text-muted-foreground">
                      {formatMoney(p.price ?? 0, p.currency)}
                      {subscriptionLabel(p) ? ` · ${subscriptionLabel(p)}` : ''}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Truck className="h-3 w-3" /> {deliveryLabel(p)}
                  </span>
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground space-y-1 hidden sm:block">
                <div className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {views} views</div>
                <div className="inline-flex items-center gap-1"><ShoppingCart className="h-3 w-3" /> {sales} sales</div>
              </div>
            </div>

            {bucket === 'in_review' && (
              <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                In inspection — will be published within 0–24h if approved.
              </p>
            )}
            {bucket === 'rejected' && (
              <p className="mt-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                <strong>Staff note:</strong> {p.admin_rejection_reason || 'No reason provided.'}
              </p>
            )}

            <div className="flex gap-2 mt-3 flex-wrap">
              {bucket === 'draft' && (
                <Button size="sm" onClick={() => navigate('/create-product')}>
                  <Pencil className="h-4 w-4 mr-1" /> Continue editing
                </Button>
              )}
              {bucket === 'rejected' && (
                <Button size="sm" onClick={() => navigate(`/edit-product/${p.id}`)}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit & resubmit
                </Button>
              )}
              {bucket === 'published' && (
                <>
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/product/${p.id}`}>
                      <ExternalLink className="h-4 w-4 mr-1" /> View
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/edit-product/${p.id}`)}>
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const { error } = await db
                        .from('dkai_products')
                        .update({ is_published: false })
                        .eq('id', p.id);
                      if (error) toast.error(error.message);
                      else {
                        toast.success('Product unpublished');
                        refetch();
                      }
                    }}
                  >
                    Unpublish
                  </Button>
                </>
              )}
              {bucket === 'in_review' && (
                <Button size="sm" variant="outline" onClick={() => navigate(`/edit-product/${p.id}`)}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
              )}
              {canDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    setDeletingId(p.id);
                    setShowDelete(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              )}
              {bucket === 'deleted' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const { error } = await db
                      .from('dkai_products')
                      .update({ is_active: true, deleted_at: null })
                      .eq('id', p.id);
                    if (error) toast.error(error.message);
                    else {
                      toast.success('Product restored');
                      refetch();
                    }
                  }}
                >
                  Restore
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };


  const renderBucket = (bucket: Bucket, emptyText: string) => {
    const list = grouped[bucket];
    if (isLoading) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      );
    }
    if (!list.length) {
      return (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">{emptyText}</CardContent>
        </Card>
      );
    }
    return <div className="space-y-3">{list.map((p) => renderCard(p, bucket))}</div>;
  };

  const counts = {
    draft: grouped.draft.length,
    in_review: grouped.in_review.length,
    published: grouped.published.length,
    rejected: grouped.rejected.length,
    deleted: grouped.deleted.length,
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <SellerSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-12 flex items-center border-b bg-card">
            <SidebarTrigger className="ml-2" />
            <h1 className="ml-3 text-sm font-semibold">Products</h1>
          </header>

          <main className="flex-1 p-6 max-w-6xl w-full mx-auto">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div>
                <h2 className="text-2xl font-bold">My Products</h2>
                <p className="text-sm text-muted-foreground">Manage your listings across every status.</p>
              </div>
              <Button onClick={() => navigate('/create-product')}>
                <Plus className="h-4 w-4 mr-1" /> Create product
              </Button>
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as Bucket)}>
              <TabsList className="grid grid-cols-2 md:grid-cols-5 mb-4">
                <TabsTrigger value="draft">Drafts ({counts.draft})</TabsTrigger>
                <TabsTrigger value="in_review">In Review ({counts.in_review})</TabsTrigger>
                <TabsTrigger value="published">Published ({counts.published})</TabsTrigger>
                <TabsTrigger value="rejected">Changes Requested ({counts.rejected})</TabsTrigger>
                <TabsTrigger value="deleted">Deleted ({counts.deleted})</TabsTrigger>
              </TabsList>

              <TabsContent value="draft">
                {renderBucket('draft', 'No drafts yet. Start a new product to save progress as you go.')}
              </TabsContent>
              <TabsContent value="in_review">
                {renderBucket('in_review', 'Nothing waiting for staff review right now.')}
              </TabsContent>
              <TabsContent value="published">
                {renderBucket('published', 'No live products yet.')}
              </TabsContent>
              <TabsContent value="rejected">
                {renderBucket('rejected', 'No rejected products. Nice work!')}
              </TabsContent>
              <TabsContent value="deleted">
                {renderBucket('deleted', 'Nothing in the trash. Deleted products can be restored here.')}
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move this product to Deleted?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be hidden from the marketplace immediately. You can restore it from the Deleted tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
