import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, AlertTriangle, Clock, FileUp } from 'lucide-react';

export type ReviewStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'changes_requested';

interface Props {
  productId: string;
  reviewStatus: ReviewStatus;
  requiresAccessReview: boolean;
  reviewNotes: string | null;
  deliveryTier?: string | null;
  onSubmitted: () => void;
}

const STATUS_META: Record<ReviewStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'outline' },
  submitted: { label: 'Submitted', variant: 'default' },
  in_review: { label: 'In Review', variant: 'secondary' },
  approved: { label: 'Approved — Live', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  changes_requested: { label: 'Changes Requested', variant: 'secondary' },
};

export function ProductReviewStatusCard({
  productId,
  reviewStatus,
  requiresAccessReview,
  reviewNotes,
  deliveryTier,
  onSubmitted,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [sampleFile, setSampleFile] = useState<File | null>(null);

  const needsSample = deliveryTier === 'tier3';
  const canSubmit = ['draft', 'changes_requested', 'rejected'].includes(reviewStatus);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let samplePath: string | null = null;
      if (needsSample) {
        if (!sampleFile) {
          toast.error('A confidential sample is required for Direct Seller Delivery products.');
          setSubmitting(false);
          return;
        }
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) throw new Error('Not authenticated');
        const ext = sampleFile.name.split('.').pop();
        samplePath = `${u.user.id}/${productId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('product-review-samples')
          .upload(samplePath, sampleFile, { upsert: false });
        if (upErr) throw upErr;
      }

      const { data, error } = await supabase.functions.invoke('submit-product-for-review', {
        body: { product_id: productId, sample_file_path: samplePath },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Submitted for review. We\'ll email you when there\'s a decision.');
      onSubmitted();
    } catch (e: any) {
      toast.error(e.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const meta = STATUS_META[reviewStatus];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium">Review status:</span>
        <Badge variant={meta.variant}>{meta.label}</Badge>
        {requiresAccessReview && (
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="w-3 h-3" /> Access review may be required
          </Badge>
        )}
      </div>

      {reviewStatus === 'approved' && (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Live on the marketplace</AlertTitle>
          <AlertDescription>Your product is visible to all buyers.</AlertDescription>
        </Alert>
      )}

      {(reviewStatus === 'submitted' || reviewStatus === 'in_review') && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>Under review</AlertTitle>
          <AlertDescription>
            Every product is reviewed before going live, usually within 48 hours. For higher-value or
            sensitive products we may request a confidential sample or temporary access — strictly
            confidential and time-limited.
          </AlertDescription>
        </Alert>
      )}

      {(reviewStatus === 'changes_requested' || reviewStatus === 'rejected') && reviewNotes && (
        <Alert variant={reviewStatus === 'rejected' ? 'destructive' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {reviewStatus === 'rejected' ? 'Rejected' : 'Changes requested'}
          </AlertTitle>
          <AlertDescription className="whitespace-pre-wrap">{reviewNotes}</AlertDescription>
        </Alert>
      )}

      {canSubmit && (
        <div className="space-y-3 border-t pt-4">
          {needsSample && (
            <div>
              <Label htmlFor="review-sample">Confidential review sample (required for Direct delivery)</Label>
              <p className="text-xs text-muted-foreground mb-2">
                A representative sample or demo so reviewers can verify the product. Stored in a private,
                review-only location and deleted after the decision.
              </p>
              <Input
                id="review-sample"
                type="file"
                onChange={(e) => setSampleFile(e.target.files?.[0] ?? null)}
              />
            </div>
          )}
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileUp className="mr-2 h-4 w-4" />
            )}
            {reviewStatus === 'draft' ? 'Submit for review' : 'Resubmit for review'}
          </Button>
        </div>
      )}
    </div>
  );
}
