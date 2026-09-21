import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { db } from '@/lib/dkaiDb';

/**
 * Seller control for the public preview of a product that is awaiting review.
 * Consent is stored separately from review status — switching it on never
 * approves the product and never marks payouts ready.
 */
export function PublicPreviewToggle({
  productId,
  enabled,
  demoVideoAllowed,
  onChanged,
}: {
  productId: string;
  enabled: boolean;
  demoVideoAllowed?: boolean;
  onChanged?: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const setConsent = async (next: boolean) => {
    setBusy(true);
    try {
      const { error } = await db.rpc('dkai_set_public_preview_consent', {
        p_product_id: productId,
        p_enabled: next,
        p_demo_video: next ? !!demoVideoAllowed : false,
        p_source: next ? 'seller_confirmation_existing_submission' : 'seller_withdrawal',
      });
      if (error) throw error;
      toast.success(next ? t('preview.previewEnabled') : t('preview.previewWithdrawn'));
      queryClient.invalidateQueries({ queryKey: ['public-previews'] });
      queryClient.invalidateQueries({ queryKey: ['public-preview', productId] });
      onChanged?.();
    } catch (e: any) {
      toast.error(e.message || 'Could not update the public preview.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={enabled ? 'outline' : 'secondary'} className="gap-1">
          {enabled ? <Eye className="h-3 w-3" aria-hidden="true" /> : <EyeOff className="h-3 w-3" aria-hidden="true" />}
          {enabled ? t('preview.previewLive') : t('preview.previewOff')}
        </Badge>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setConsent(!enabled)}>
          {busy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          {enabled ? t('preview.withdrawPreview') : t('preview.enablePreview')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {enabled ? t('preview.previewHint') : t('preview.consentPublicFields')}
      </p>
    </div>
  );
}
