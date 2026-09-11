import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

type SizeToken = 'sm' | 'md' | 'lg';

interface HourglassLoaderProps {
  /** Visible artwork size in px, or a size token. Default 'md'. */
  size?: number | SizeToken;
  /** Retained for call-site compatibility; the official GIF is always rendered unchanged. */
  variant?: 'light' | 'dark' | 'auto';
  /** Show a text label under the loader (i18n key resolved automatically). */
  label?: string | boolean;
  /** Retained for call-site compatibility; the official GIF controls its own timing. */
  speed?: number;
  className?: string;
}

/** Visible hourglass height per token (px). `lg` is the full-page loader. */
const SIZES: Record<SizeToken, number> = { sm: 18, md: 40, lg: 140 };

/**
 * The supplied GIF is a 240x240 canvas whose artwork occupies 198x198,
 * so the image element is rendered slightly larger than the requested
 * visible size to compensate for the built-in whitespace.
 */
const CANVAS_RATIO = 240 / 198;

const LOADER_GIF = '/dkaim-loader-hourglass.gif';

/**
 * Branded hourglass loader — uses only the official DK AI Marketplace loader GIF.
 */
export function HourglassLoader({
  size = 'md',
  variant: _variant = 'auto',
  label,
  speed: _speed = 1,
  className,
}: HourglassLoaderProps) {
  const { t } = useTranslation();
  const visible = typeof size === 'number' ? size : SIZES[size];
  const px = Math.round(visible * CANVAS_RATIO);
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
        'dkai-hourglass inline-flex flex-col items-center justify-center gap-2',
        className,
      )}
    >
      <img
        src={LOADER_GIF}
        alt=""
        aria-hidden="true"
        width={px}
        height={px}
        decoding="async"
        className="block max-w-full object-contain"
        style={{ width: px, height: px }}
      />

      {showLabel && <span className="text-sm text-muted-foreground">{labelText}</span>}
      {!showLabel && <span className="sr-only">{labelText}</span>}
    </div>
  );
}

export default HourglassLoader;
