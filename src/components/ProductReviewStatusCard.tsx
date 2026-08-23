import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, AlertTriangle, Clock, FileUp } from 'lucide-react';

import {
  REVIEW_STATUS,
  REVIEW_STATUS_LABEL,
  REVIEW_STATUS_VARIANT,
  normalizeReviewStatus,
  type ReviewStatusValue,
} from '@/lib/reviewStatus';

export type ReviewStatus = ReviewStatusValue;

interface Props {
  productId: string;
  reviewStatus: ReviewStatus;
  requiresAccessReview: boolean;
  reviewNotes: string | null;
  deliveryTier?: string | null;
  onSubmitted: () => void;
}

const canSubmitStatuses: string[] = [
  REVIEW_STATUS.DRAFT,
  REVIEW_STATUS.CHANGES_REQUESTED,
  REVIEW_STATUS.REJECTED,
];

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
  const status = normalizeReviewStatus(reviewStatus);
  const canSubmit = canSubmitStatuses.includes(status);

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



  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium">Review status:</span>
        <Badge variant={REVIEW_STATUS_VARIANT[status]}>{REVIEW_STATUS_LABEL[status]}</Badge>
        {requiresAccessReview && (
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="w-3 h-3" /> Access review may be required
          </Badge>
        )}
      </div>

      {status === REVIEW_STATUS.APPROVED && (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Live on the marketplace</AlertTitle>
          <AlertDescription>Your product is visible to all buyers.</AlertDescription>
        </Alert>
      )}

      {(status === REVIEW_STATUS.SUBMITTED || status === REVIEW_STATUS.IN_REVIEW) && (
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

      {(status === REVIEW_STATUS.CHANGES_REQUESTED || status === REVIEW_STATUS.REJECTED) && reviewNotes && (
        <Alert variant={status === REVIEW_STATUS.REJECTED ? 'destructive' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {status === REVIEW_STATUS.REJECTED ? 'Rejected' : 'Changes requested'}
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
            {status === REVIEW_STATUS.DRAFT ? 'Submit for review' : 'Resubmit for review'}
          </Button>
        </div>
      )}
    </div>
  );
}
