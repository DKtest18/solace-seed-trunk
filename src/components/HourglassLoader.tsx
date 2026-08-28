import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

type Variant = 'light' | 'dark' | 'auto';
type SizeToken = 'sm' | 'md' | 'lg';

interface HourglassLoaderProps {
  /** px value or a size token. Default 'md' (32px). */
  size?: number | SizeToken;
  /** 'light' = navy body (for light surfaces), 'dark' = white body (for dark surfaces). */
  variant?: Variant;
  /** Show a text label under the loader (i18n key resolved automatically). */
  label?: string | boolean;
  /** Animation speed multiplier: 1 = default (1.1s sand + 0.45s flip). */
  speed?: number;
  className?: string;
}

const SIZES: Record<SizeToken, number> = { sm: 20, md: 32, lg: 72 };

/**
 * Branded hourglass loader — inline SVG + pure CSS animation (no JS ticking,
 * no raster asset). Sharp at any size, a few hundred bytes of markup.
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
    label === true || label === undefined || label === false
      ? t('common.loading')
      : t(label, { defaultValue: label });
  const showLabel = label === true || (typeof label === 'string' && label.length > 0);

  // One full cycle = sand run + flip, twice, so rotation returns to 0deg.
  const cycle = (1.1 + 0.45) * 2 / Math.max(speed, 0.1);

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
      <svg
        width={px}
        height={px}
        viewBox="0 0 100 100"
        aria-hidden="true"
        focusable="false"
        className="dkai-hourglass__svg"
      >
        <defs>
          {/* Upper chamber interior */}
          <clipPath id="hg-top-chamber">
            <polygon points="26,22 74,22 50,50" />
          </clipPath>
          {/* Lower chamber interior */}
          <clipPath id="hg-bottom-chamber">
            <polygon points="50,50 74,78 26,78" />
          </clipPath>
        </defs>

        {/* Sand — upper chamber drains top-down */}
        <g clipPath="url(#hg-top-chamber)">
          <rect
            className="dkai-hourglass__sand-top"
            x="20"
            y="22"
            width="60"
            height="28"
          />
        </g>
        {/* Sand — lower chamber fills bottom-up */}
        <g clipPath="url(#hg-bottom-chamber)">
          <rect
            className="dkai-hourglass__sand-bottom"
            x="20"
            y="50"
            width="60"
            height="28"
          />
        </g>

        {/* Hourglass body: outer silhouette with the two chambers cut out */}
        <path
          className="dkai-hourglass__body"
          fillRule="evenodd"
          d="M16 12 H84 L50 50 L84 88 H16 L50 50 Z M26 22 H74 L50 50 Z M50 50 L74 78 H26 Z"
        />
      </svg>

      {showLabel && (
        <span className="text-sm text-muted-foreground">{labelText}</span>
      )}
    </div>
  );
}

export default HourglassLoader;
