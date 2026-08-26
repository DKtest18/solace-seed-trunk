import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { db } from '@/lib/dkaiDb';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, FileSearch } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DemoVideoReviewPanel, hasDemoVideo } from '@/components/admin/DemoVideoReviewPanel';
import { AdminProductFileAccess } from '@/components/admin/AdminProductFileAccess';
import { AdminProductSubmissionDialog } from '@/components/admin/AdminProductSubmissionDialog';
import { formatMoney } from '@/lib/money';
import { ProductTimestamps, hoursWaiting } from '@/components/seller/ProductTimestamps';

import { format } from 'date-fns';

import {
  REVIEW_STATUS,
  REVIEW_STATUS_GROUPS,
  REVIEW_STATUS_LABEL as STATUS_LABEL,
  REVIEW_STATUS_VARIANT as STATUS_VARIANT,
  normalizeReviewStatus,
} from '@/lib/reviewStatus';

type QueueTab = 'pending' | 'draft' | 'needs_changes' | 'approved' | 'delisted' | 'all';

// Tab -> canonical review_status values. All values come from REVIEW_STATUS, so a
// tab can never filter on a status nothing writes.
const STATUS_GROUPS: Record<Exclude<QueueTab, 'all'>, string[]> = {
  pending: [...REVIEW_STATUS_GROUPS.PENDING],
  draft: [...REVIEW_STATUS_GROUPS.DRAFT],
  needs_changes: [...REVIEW_STATUS_GROUPS.NEEDS_SELLER_ACTION],
  approved: [...REVIEW_STATUS_GROUPS.LIVE],
  delisted: [...REVIEW_STATUS_GROUPS.DELISTED],
};

// Select everything so the queue never breaks when a column is missing
// (legacy schemas may not have is_active / demo_video_* etc.).
const PRODUCT_COLUMNS = '*';

function licenseTiers(p: any): string {
  const tiers: string[] = ['Standard'];
  if (p.license_commercial_enabled) tiers.push('Commercial');
  if (p.license_agency_enabled) tiers.push('Agency');
  if (p.license_exclusive_enabled) tiers.push('Exclusive');
  return tiers.join(' · ');
}

export default function AdminProductReview() {
  const [tab, setTab] = useState<QueueTab>('pending');
  const qc = useQueryClient();

  const { data: products, isLoading, error } = useQuery({
    queryKey: ['admin-product-review', tab],
    queryFn: async () => {
      // "all" shows every product ever created, including legacy rows whose
      // review_status was never set (NULL) — so admins can audit what is live.
      let q = db.from('dkai_products').select(PRODUCT_COLUMNS);
      if (tab !== 'all') q = q.in('review_status', STATUS_GROUPS[tab]);
      const { data, error } = await q
        .order('submitted_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30_000,
  });

  const sellerIds = useMemo(
    () => Array.from(new Set((products ?? []).map((p: any) => p.seller_id).filter(Boolean))),
    [products]
  );

  const { data: sellers } = useQuery({
    queryKey: ['admin-product-review-sellers', sellerIds],
    enabled: sellerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await db
        .from('dkai_profiles')
        .select('id, full_name, creator_name, username, email')
        .in('id', sellerIds);
      if (error) throw error;
      const map: Record<string, any> = {};
      (data || []).forEach((s: any) => (map[s.id] = s));
      return map;
    },
  });

  const [rejectProduct, setRejectProduct] = useState<any>(null);
  const [submissionProduct, setSubmissionProduct] = useState<any>(null);
  const [note, setNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);


  // Optimistically drop a product from the current list, then refetch to confirm.
  const dropFromList = (productId: string) => {
    qc.setQueryData(['admin-product-review', tab], (old: any) =>
      Array.isArray(old) ? old.filter((p: any) => p.id !== productId) : old
    );
  };

  const approve = async (p: any) => {
    setBusyId(p.id);
    try {
      const { error } = await db
        .from('dkai_products')
        .update({ review_status: REVIEW_STATUS.APPROVED })
        .eq('id', p.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      dropFromList(p.id);
      toast.success(`Approved “${p.title}”.`);
    } finally {
      setBusyId(null);
      qc.invalidateQueries({ queryKey: ['admin-product-review'] });
    }
  };

  const reject = async () => {
    const p = rejectProduct;
    if (!p) return;
    const text = note.trim();
    if (text.split(/\s+/).filter(Boolean).length < 3 || text.length < 10) {
      toast.error('Please write at least a few words explaining what needs to change.');
      return;
    }
    setBusyId(p.id);
    try {
      const { error } = await db
        .from('dkai_products')
        .update({ review_status: REVIEW_STATUS.CHANGES_REQUESTED, admin_review_note: text })
        .eq('id', p.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      dropFromList(p.id);
      toast.success(`Sent back to the seller with your note (changes requested).`);
      setRejectProduct(null);
      setNote('');
    } finally {
      setBusyId(null);
      qc.invalidateQueries({ queryKey: ['admin-product-review'] });
    }
  };

  return (
    <div className="min-h-screen bg-background py-10 px-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-display font-semibold mb-2">Product Review Queue</h1>
        <p className="text-muted-foreground mb-6">
          Every product is reviewed before going live. Approve it, or send it back to the seller with
          a note describing the changes you need.
        </p>

        <Tabs value={tab} onValueChange={(v) => setTab(v as QueueTab)}>
          <TabsList>
            <TabsTrigger value="pending">Pending review</TabsTrigger>
            <TabsTrigger value="needs_changes">Changes requested</TabsTrigger>
            <TabsTrigger value="draft">Drafts</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="delisted">Delisted</TabsTrigger>
            <TabsTrigger value="all">All products</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-6 space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertDescription>{(error as any)?.message || 'Failed to load products.'}</AlertDescription>
              </Alert>
            ) : !products || products.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  No products in this status.
                </CardContent>
              </Card>
            ) : (
              products.map((p: any) => {
                const seller = sellers?.[p.seller_id];
                const sellerName =
                  seller?.full_name || seller?.creator_name || seller?.username || 'Unknown seller';
                const status = normalizeReviewStatus(p.review_status);
                const waiting = hoursWaiting(p);
                const overdue =
                  (REVIEW_STATUS_GROUPS.PENDING as readonly string[]).includes(status) &&
                  waiting != null &&
                  waiting > 48;
                return (
                  <Card key={p.id} className={overdue ? 'border-destructive border-2' : undefined}>
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                            {p.title || 'Untitled product'}
                            <Badge variant={STATUS_VARIANT[normalizeReviewStatus(p.review_status)] || 'secondary'}>
                              {STATUS_LABEL[normalizeReviewStatus(p.review_status)]}
                            </Badge>
                            <Badge variant={p.is_published ? 'outline' : 'secondary'}>
                              {p.is_published ? 'Live on marketplace' : 'Not live'}
                            </Badge>
                            {p.is_active === false && <Badge variant="destructive">Deleted</Badge>}
                            {overdue && (
                              <Badge variant="destructive">
                                Waiting {Math.floor(waiting!)}h — over 48h
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {sellerName}
                            {seller?.email ? ` · ${seller.email}` : ''}
                          </CardDescription>
                          <ProductTimestamps
                            product={p}
                            kinds={['submitted', 'approved', 'published', 'delisted']}
                          />

                          <CardDescription className="mt-1">
                            {formatMoney(p.price ?? 0, p.currency)} · Licenses: {licenseTiers(p)}
                            {p.category ? ` · ${p.category}` : ''}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="secondary" size="sm" onClick={() => setSubmissionProduct(p)}>
                            <FileSearch className="w-4 h-4 mr-1" /> View full submission (11 steps)
                          </Button>
                          <Button asChild variant="outline" size="sm">
                            <Link to={`/product/${p.id}`} target="_blank">
                              <Eye className="w-4 h-4 mr-1" /> Preview
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {p.description && (
                        <p className="text-sm text-foreground line-clamp-3 whitespace-pre-wrap">
                          {p.description}
                        </p>
                      )}
                      <DemoVideoReviewPanel
                        demoVideoUrl={p.demo_video_url}
                        demoVideoPaths={(p as any).demo_video_paths}
                        demoVideoStoragePath={p.demo_video_storage_path}
                      />
                      <AdminProductFileAccess productId={p.id} mode="review" />
                      {p.admin_review_note && (
                        <Alert>
                          <AlertDescription className="text-sm">
                            <strong>Previous note:</strong> {p.admin_review_note}
                          </AlertDescription>
                        </Alert>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        {normalizeReviewStatus(p.review_status) !== REVIEW_STATUS.APPROVED && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button
                                    size="sm"
                                    disabled={!hasDemoVideo(p) || busyId === p.id}
                                    onClick={() => approve(p)}
                                  >
                                    {busyId === p.id && (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Approve
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              {!hasDemoVideo(p) && (
                                <TooltipContent>No demo video submitted</TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {normalizeReviewStatus(p.review_status) !== REVIEW_STATUS.CHANGES_REQUESTED && (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={busyId === p.id}
                            onClick={() => {
                              setRejectProduct(p);
                              setNote('');
                            }}
                          >
                            Reject (send back as draft)
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>

      {submissionProduct && (
        <AdminProductSubmissionDialog
          product={submissionProduct}
          open={!!submissionProduct}
          onOpenChange={(o) => !o && setSubmissionProduct(null)}
        />
      )}



      <Dialog
        open={!!rejectProduct}
        onOpenChange={(o) => {
          if (!o) {
            setRejectProduct(null);
            setNote('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request changes</DialogTitle>
            <DialogDescription>
              The product goes back to the seller as a draft with your note. Nothing is deleted.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Note for the seller (required)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="Explain what needs to change before this can be approved."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectProduct(null)} disabled={!!busyId}>
              Cancel
            </Button>
            <Button onClick={reject} disabled={!!busyId}>
              {!!busyId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send back to seller
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
