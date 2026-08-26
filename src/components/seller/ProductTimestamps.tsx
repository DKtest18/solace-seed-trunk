import { useTranslation } from 'react-i18next';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';

/**
 * DISPLAY ONLY.
 * Renders the lifecycle timestamps that the DB trigger maintains on
 * dkai_products (submitted_at, approved_at, published_at, delisted_at,
 * updated_at). Missing values render nothing — never an empty field.
 */
export type ProductTimestampKind =
  | 'submitted'
  | 'approved'
  | 'published'
  | 'delisted'
  | 'updated';

const LABELS: Record<ProductTimestampKind, { de: string; en: string }> = {
  submitted: { de: 'Eingereicht am', en: 'Submitted on' },
  approved: { de: 'Freigegeben am', en: 'Approved on' },
  published: { de: 'Auf dem Marktplatz seit', en: 'On the marketplace since' },
  delisted: { de: 'Entfernt am', en: 'Removed on' },
  updated: { de: 'Zuletzt bearbeitet am', en: 'Last edited on' },
};

const COLUMNS: Record<ProductTimestampKind, string> = {
  submitted: 'submitted_at',
  approved: 'approved_at',
  published: 'published_at',
  delisted: 'delisted_at',
  updated: 'updated_at',
};

export function productTimestamp(product: any, kind: ProductTimestampKind): string | null {
  const raw = product?.[COLUMNS[kind]];
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : raw;
}

export function ProductTimestamps({
  product,
  kinds,
  className,
}: {
  product: any;
  kinds: ProductTimestampKind[];
  className?: string;
}) {
  const { i18n } = useTranslation();
  const { formatDateTime, formatRelativeTime } = useLocaleFormat();
  const lang = i18n.language === 'de' ? 'de' : 'en';

  const rows = kinds
    .map((kind) => ({ kind, value: productTimestamp(product, kind) }))
    .filter((r) => r.value) as { kind: ProductTimestampKind; value: string }[];

  if (!rows.length) return null;

  return (
    <div className={`mt-1 space-y-0.5 text-xs text-muted-foreground ${className ?? ''}`}>
      {rows.map(({ kind, value }) => (
        <div key={kind}>
          {LABELS[kind][lang]} {formatDateTime(value)}
          <span className="opacity-70"> · {formatRelativeTime(value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Hours a product has been waiting since it was submitted (null when unknown). */
export function hoursWaiting(product: any): number | null {
  const raw = productTimestamp(product, 'submitted') ?? product?.created_at;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 3_600_000;
}
