import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import hourglassGif from '@/assets/dkaim-hourglass-loader.gif.asset.json';

type SizeToken = 'sm' | 'md' | 'lg';

interface HourglassLoaderProps {
  /** px value or a size token. Default 'md' (32px). */
  size?: number | SizeToken;
  /** Retained for call-site compatibility; the official GIF is always rendered unchanged. */
  variant?: 'light' | 'dark' | 'auto';
  /** Show a text label under the loader (i18n key resolved automatically). */
  label?: string | boolean;
  /** Retained for call-site compatibility; the official GIF controls its own timing. */
  speed?: number;
  className?: string;
}

const SIZES: Record<SizeToken, number> = { sm: 20, md: 32, lg: 72 };

/**
 * Branded hourglass loader.
 *
 * Uses only the official, user-supplied DK AI Marketplace hourglass GIF.
 */
export function HourglassLoader({
  size = 'md',
  variant: _variant = 'auto',
  label,
  speed: _speed = 1,
  className,
}: HourglassLoaderProps) {
  const { t } = useTranslation();
  const px = typeof size === 'number' ? size : SIZES[size];
  const labelText =
    typeof label === 'string' && label.length > 0
      ? t(label, { defaultValue: label })
      : t('common.loading');
  const showLabel = label === true || (typeof label === 'string' && label.length > 0);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={labelText}
      className={cn(
        'dkai-hourglass inline-flex flex-col items-center justify-center gap-3',
        className,
      )}
    >
      <span
        className="relative inline-block shrink-0"
        style={{ width: px, height: px }}
      >
        <img
          src={hourglassGif.url}
          alt=""
          aria-hidden="true"
          width={px}
          height={px}
          decoding="async"
          className="absolute inset-0 h-full w-full object-contain"
        />
      </span>

      {showLabel && <span className="text-sm text-muted-foreground">{labelText}</span>}
    </div>
  );
}

export default HourglassLoader;
