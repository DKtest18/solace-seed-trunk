import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { db } from '@/lib/dkaiDb';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
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
import { Loader2, Eye, ShieldAlert, ExternalLink } from 'lucide-react';

type ReviewStatus = 'submitted' | 'in_review' | 'approved' | 'rejected' | 'changes_requested';

const STATUS_LABEL: Record<ReviewStatus, string> = {
  submitted: 'Submitted',
  in_review: 'In Review',
  approved: 'Approved',
  rejected: 'Rejected',
  changes_requested: 'Changes Requested',
};
const STATUS_VARIANT: Record<ReviewStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  submitted: 'default',
  in_review: 'secondary',
  approved: 'outline',
  rejected: 'destructive',
  changes_requested: 'secondary',
};

export default function AdminProductReview() {
  const [tab, setTab] = useState<ReviewStatus>('submitted');
  const qc = useQueryClient();

  const { data: products, isLoading } = useQuery({
    queryKey: ['admin-product-review', tab],
    queryFn: async () => {
      const { data, error } = await db
        .from('dkai_products')
        .select(
          'id, title, price, delivery_tier, file_size_bytes, category, description, seller_id, ' +
            'review_status, requires_access_review, submitted_at, review_notes, reviewed_at'
        )
        .eq('review_status', tab)
        .order('submitted_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30_000,
  });

  const [actionProductId, setActionProductId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'start' | 'approve' | 'request_changes' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Access logging dialog
  const [accessProductId, setAccessProductId] = useState<string | null>(null);
  const [accessReason, setAccessReason] = useState('');
  const [accessExpiresMinutes, setAccessExpiresMinutes] = useState(60);
  const [accessSignedUrl, setAccessSignedUrl] = useState<string | null>(null);
  const [loggingAccess, setLoggingAccess] = useState(false);

  const runAction = async () => {
    if (!actionProductId || !actionType) return;
    if ((actionType === 'request_changes' || actionType === 'reject') && notes.trim().length < 10) {
      toast.error('Please provide notes (at least 10 characters).');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('decide-product-review', {
        body: { product_id: actionProductId, action: actionType, notes: notes.trim() || null },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Product ${actionType.replace('_', ' ')}d.`);
      setActionProductId(null);
      setActionType(null);
      setNotes('');
      qc.invalidateQueries({ queryKey: ['admin-product-review'] });
    } catch (e: any) {
      toast.error(e.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const logAccess = async () => {
    if (!accessProductId || accessReason.trim().length < 10) {
      toast.error('Reason must be at least 10 characters.');
      return;
    }
    setLoggingAccess(true);
    try {
      const { data, error } = await supabase.functions.invoke('log-product-review-access', {
        body: {
          product_id: accessProductId,
          access_reason: accessReason.trim(),
          expires_in_minutes: accessExpiresMinutes,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAccessSignedUrl((data as any)?.signed_url ?? null);
      toast.success('Access logged. Seller has been notified.');
    } catch (e: any) {
      toast.error(e.message || 'Failed to log access');
    } finally {
      setLoggingAccess(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-10 px-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-display font-semibold mb-2">Product Review Queue</h1>
        <p className="text-muted-foreground mb-6">
          Every product is reviewed before going live. Approve, request changes, or reject submissions.
          For higher-risk products, log time-limited access before viewing samples.
        </p>

        <Tabs value={tab} onValueChange={(v) => setTab(v as ReviewStatus)}>
          <TabsList>
            <TabsTrigger value="submitted">Submitted</TabsTrigger>
            <TabsTrigger value="in_review">In Review</TabsTrigger>
            <TabsTrigger value="changes_requested">Changes Requested</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-6 space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !products || products.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  No products in this status.
                </CardContent>
              </Card>
            ) : (
              products.map((p: any) => (
                <Card key={p.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                          {p.title}
                          <Badge variant={STATUS_VARIANT[p.review_status as ReviewStatus]}>
                            {STATUS_LABEL[p.review_status as ReviewStatus]}
                          </Badge>
                          {p.requires_access_review && (
                            <Badge variant="destructive" className="gap-1">
                              <ShieldAlert className="w-3 h-3" /> Access review
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          CHF {Number(p.price).toLocaleString('de-CH')} · {p.delivery_tier || 'tier1'} ·{' '}
                          {p.file_size_bytes ? `${(p.file_size_bytes / 1048576).toFixed(1)} MB` : 'no file'}
                          {p.category ? ` · ${p.category}` : ''}
                        </CardDescription>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/product/${p.id}`} target="_blank">
                          <Eye className="w-4 h-4 mr-1" /> Preview
                        </Link>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-foreground line-clamp-3 whitespace-pre-wrap">
                      {p.description}
                    </p>
                    {p.review_notes && (
                      <Alert>
                        <AlertDescription className="text-sm">
                          <strong>Previous notes:</strong> {p.review_notes}
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      {p.review_status === 'submitted' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setActionProductId(p.id);
                            setActionType('start');
                            setNotes('');
                          }}
                        >
                          Start review
                        </Button>
                      )}
                      {['submitted', 'in_review', 'changes_requested'].includes(p.review_status) && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => {
                              setActionProductId(p.id);
                              setActionType('approve');
                              setNotes('');
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setActionProductId(p.id);
                              setActionType('request_changes');
                              setNotes('');
                            }}
                          >
                            Request changes
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setActionProductId(p.id);
                              setActionType('reject');
                              setNotes('');
                            }}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {p.requires_access_review && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-auto"
                          onClick={() => {
                            setAccessProductId(p.id);
                            setAccessReason('');
                            setAccessSignedUrl(null);
                          }}
                        >
                          <ShieldAlert className="w-4 h-4 mr-1" />
                          Log access
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Action dialog */}
      <Dialog
        open={!!actionType}
        onOpenChange={(o) => {
          if (!o) {
            setActionType(null);
            setActionProductId(null);
            setNotes('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'start' && 'Start review'}
              {actionType === 'approve' && 'Approve product'}
              {actionType === 'request_changes' && 'Request changes'}
              {actionType === 'reject' && 'Reject product'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve' && 'The product will become visible on the marketplace.'}
              {(actionType === 'request_changes' || actionType === 'reject') &&
                'Notes are required and will be emailed to the seller.'}
              {actionType === 'start' && 'Moves the product into the In Review queue.'}
            </DialogDescription>
          </DialogHeader>
          {(actionType === 'request_changes' || actionType === 'reject' || actionType === 'approve') && (
            <div>
              <Label>
                {actionType === 'approve' ? 'Approval note (optional)' : 'Notes (required)'}
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder={
                  actionType === 'approve'
                    ? 'Optional approval comment for internal log…'
                    : 'Explain what needs to change or why the product was rejected.'
                }
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={runAction} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Access log dialog */}
      <Dialog
        open={!!accessProductId}
        onOpenChange={(o) => {
          if (!o) {
            setAccessProductId(null);
            setAccessReason('');
            setAccessSignedUrl(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log time-limited access</DialogTitle>
            <DialogDescription>
              Required before viewing sample/file for this product. All access is logged, time-limited,
              and the seller is notified for transparency.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Reason (min 10 chars)</Label>
              <Textarea
                value={accessReason}
                onChange={(e) => setAccessReason(e.target.value)}
                rows={3}
                placeholder="e.g. Verify product matches the listing description and complies with content policy."
              />
            </div>
            <div>
              <Label>Expires in (minutes)</Label>
              <Input
                type="number"
                min={5}
                max={1440}
                value={accessExpiresMinutes}
                onChange={(e) => setAccessExpiresMinutes(Math.max(5, Number(e.target.value) || 60))}
              />
            </div>
            {accessSignedUrl && (
              <Alert>
                <AlertDescription>
                  <a
                    href={accessSignedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Open sample <ExternalLink className="w-3 h-3" />
                  </a>
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAccessProductId(null);
                setAccessSignedUrl(null);
              }}
              disabled={loggingAccess}
            >
              Close
            </Button>
            <Button onClick={logAccess} disabled={loggingAccess}>
              {loggingAccess && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
