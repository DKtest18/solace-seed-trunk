import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import hourglassGif from '@/assets/dkaim-hourglass-loader.gif.asset.json';

type Variant = 'light' | 'dark' | 'auto';
type SizeToken = 'sm' | 'md' | 'lg';

interface HourglassLoaderProps {
  /** px value or a size token. Default 'md' (32px). */
  size?: number | SizeToken;
  /** 'light' = navy body (for light surfaces), 'dark' = white body (for dark surfaces). */
  variant?: Variant;
  /** Show a text label under the loader (i18n key resolved automatically). */
  label?: string | boolean;
  /** Animation speed multiplier for the SVG fallback: 1 = default. */
  speed?: number;
  className?: string;
}

const SIZES: Record<SizeToken, number> = { sm: 20, md: 32, lg: 72 };

/**
 * Branded hourglass loader.
 *
 * Primary visual: the official DK AI Marketplace hourglass GIF (CDN-hosted, not
 * bundled). A CSS-animated inline SVG twin is rendered underneath as the
 * fallback and is the only thing shown when the GIF cannot load or when the
 * user prefers reduced motion.
 *
 * Body colour: --brand-primary, sand: --brand-accent. No other colours.
 */
export function HourglassLoader({
  size = 'md',
  variant = 'auto',
  label,
  speed = 1,
  className,
}: HourglassLoaderProps) {
  const { t } = useTranslation();
  const px = typeof size === 'number' ? size : SIZES[size];
  const labelText =
    typeof label === 'string' && label.length > 0
      ? t(label, { defaultValue: label })
      : t('common.loading');
  const showLabel = label === true || (typeof label === 'string' && label.length > 0);

  // One cycle = one downward run (1.3s) + pause (0.2s) + one 180° turn (1.2s).
  const cycle = 2.7 / Math.max(speed, 0.1);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={labelText}
      className={cn(
        'dkai-hourglass inline-flex flex-col items-center justify-center gap-3',
        variant === 'dark' && 'dkai-hourglass--dark',
        variant === 'light' && 'dkai-hourglass--light',
        className,
      )}
      style={{ ['--hg-cycle' as string]: `${cycle}s` }}
    >
      <span
        className="dkai-hourglass__frame relative inline-block"
        style={{ width: px, height: px }}
      >
        {/* CSS/SVG twin — fallback layer (also the reduced-motion visual) */}
        <svg
          viewBox="0 0 100 100"
          aria-hidden="true"
          focusable="false"
          className="dkai-hourglass__svg absolute inset-0 h-full w-full"
        >
          <defs>
            {/* Upper chamber interior */}
            <clipPath id="hg-top-chamber">
              <polygon points="32,27 68,27 50,46" />
            </clipPath>
            {/* Lower chamber interior */}
            <clipPath id="hg-bottom-chamber">
              <polygon points="50,54 68,73 32,73" />
            </clipPath>
          </defs>

          {/* Upper sand: surface sinks from the top edge down to the waist.
              Only visible during the first half of the run. */}
          <g clipPath="url(#hg-top-chamber)">
            <rect
              className="dkai-hourglass__sand-top"
              x="20"
              y="25"
              width="60"
              height="23"
            />
          </g>
          {/* Lower sand: grows downward from the waist to the bottom edge.
              Only visible during the second half of the run. */}
          <g clipPath="url(#hg-bottom-chamber)">
            <rect
              className="dkai-hourglass__sand-bottom"
              x="20"
              y="52"
              width="60"
              height="23"
            />
          </g>

          {/* Hourglass body: outer silhouette with both chambers cut out */}
          <path
            className="dkai-hourglass__body"
            fillRule="evenodd"
            d="M14 10 H86 L50 50 L86 90 H14 L50 50 Z M32 27 H68 L50 46 Z M50 54 L68 73 H32 Z"
          />
        </svg>

        {/* Brand GIF on top — hidden when reduced motion is preferred */}
        <img
          src={hourglassGif.url}
          alt=""
          aria-hidden="true"
          width={px}
          height={px}
          decoding="async"
          className="dkai-hourglass__gif absolute inset-0 h-full w-full object-contain"
        />
      </span>

      {showLabel && <span className="text-sm text-muted-foreground">{labelText}</span>}
    </div>
  );
}

export default HourglassLoader;
