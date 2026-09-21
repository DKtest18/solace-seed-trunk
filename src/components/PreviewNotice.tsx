import { useTranslation } from 'react-i18next';
import { Clock, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * Shared labels for products that are publicly previewed while awaiting review.
 * Text-first (never colour-only) and fully translated.
 */
export function UnderReviewBadge({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className={`gap-1 border-amber-500 text-amber-700 dark:text-amber-400 ${className ?? ''}`}>
      <Clock className="h-3 w-3" aria-hidden="true" />
      {t('preview.badge')}
    </Badge>
  );
}

export function PreviewUnavailableLine({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <p className={`text-xs text-muted-foreground ${className ?? ''}`}>{t('preview.notAvailable')}</p>
  );
}

export function PreviewDetailNotice() {
  const { t } = useTranslation();
  return (
    <Alert>
      <Info className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>{t('preview.badge')}</AlertTitle>
      <AlertDescription>{t('preview.detailNotice')}</AlertDescription>
    </Alert>
  );
}
