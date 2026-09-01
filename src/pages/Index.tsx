import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ShoppingBag,
  Search,
  CreditCard,
  Download,
  Shield,
  ShieldCheck,
  BadgeCheck,
  Wallet,
  ArrowRight,
  MessageSquareText,
  LayoutTemplate,
  Database,
  Bot,
  Zap,
  Workflow,
} from 'lucide-react';
import { db } from '@/lib/dkaiDb';
import { formatMoney } from '@/lib/money';
import './index-home.css';
import { REVIEW_STATUS } from '@/lib/reviewStatus';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CompanyLogoWall } from '@/components/home/CompanyLogoWall';

// Decorative marquee categories — icon only, name kept as aria-label + tooltip.
const CATEGORIES = [
  { key: 'aiAgents', icon: Bot },
  { key: 'automations', icon: Zap },
  { key: 'workflows', icon: Workflow },
  { key: 'prompts', icon: MessageSquareText },
  { key: 'templates', icon: LayoutTemplate },
  { key: 'datasets', icon: Database },
] as const;

// One marquee half repeats the set enough times to exceed the widest viewport
// (6 icons x 4 = 24 chips ≈ 2400px), so no gap can ever appear mid-loop.
const REPEATS_PER_HALF = 4;
const HALF = Array.from({ length: REPEATS_PER_HALF }, () => CATEGORIES).flat();

type HomeProduct = {
  id: string;
  title: string;
  price: number;
  currency?: string;
  image_url?: string;
  seller_verified?: boolean;
};

function useHomeProducts() {
  return useQuery({
    queryKey: ['home-hero-products'],
    queryFn: async () => {
      const { data, error } = await db
        .from('dkai_products')
        .select('id,title,price,currency,image_url')
        .eq('review_status', REVIEW_STATUS.APPROVED)
        .eq('exclusive_locked', false)
        .order('trending_score', { ascending: false, nullsFirst: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as HomeProduct[];
    },
  });
}

function ProductGlassCard({ product, className = '' }: { product?: HomeProduct; className?: string }) {
  const { t } = useTranslation();
  if (!product) {
    return (
      <div className={`home-glass p-4 w-56 ${className}`}>
        <div className="aspect-[4/3] rounded-lg bg-[var(--n-surface-strong)] mb-3 flex items-center justify-center text-xs text-[var(--text-dim)]">
          {t('landing.comingSoon')}
        </div>
        <div className="h-3 w-3/4 rounded bg-[var(--n-surface-strong)] mb-2" />
        <div className="h-3 w-1/3 rounded bg-[var(--n-surface-strong)]" />
      </div>
    );
  }
  return (
    <Link
      to={`/product/${product.id}`}
      className={`home-glass p-4 w-56 block group transition-transform hover:-translate-y-1 ${className}`}
    >
      <div className="aspect-[4/3] rounded-lg bg-[var(--n-surface-strong)] overflow-hidden mb-3">
        {product.image_url ? (
          <img src={product.image_url} alt={product.title} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-[var(--text-dim)]">DK AI</div>
        )}
      </div>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm font-medium text-[var(--brand-primary)] line-clamp-1">{product.title}</span>
        <BadgeCheck className="h-4 w-4 text-[var(--brand-accent)] shrink-0" aria-label={t('landing.verified')} />
      </div>
      <div className="text-sm text-[var(--text-muted)]">{formatMoney(product.price, product.currency)}</div>
    </Link>
  );
}

/**
 * Marquee half. `decorative` copies are aria-hidden so screen readers only
 * announce the category set once.
 */
function MarqueeHalf({ decorative, t }: { decorative: boolean; t: (k: string) => string }) {
  return (
    <div className="home-marquee-group" aria-hidden={decorative || undefined}>
      {HALF.map((c, i) => {
        const label = t(`landing.categories.${c.key}`);
        return (
          <Tooltip key={`${decorative ? 'b' : 'a'}-${i}`}>
            <TooltipTrigger asChild>
              <span role="img" aria-label={label} title={label} className="home-cat-chip">
                <c.icon className="h-8 w-8" strokeWidth={1.75} aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * OPTION 2 (NOT APPLIED — preview variant): icon + text label under each chip.
 * To compare, swap <MarqueeHalf .../> for <MarqueeHalfWithLabels .../> below.
 *
 * function MarqueeHalfWithLabels({ decorative, t }: { decorative: boolean; t: (k: string) => string }) {
 *   return (
 *     <div className="home-marquee-group" aria-hidden={decorative || undefined}>
 *       {HALF.map((c, i) => {
 *         const label = t(`landing.categories.${c.key}`);
 *         return (
 *           <span key={i} className="flex flex-col items-center gap-2 w-24" aria-label={label} role="img">
 *             <span className="home-cat-chip"><c.icon className="h-8 w-8" strokeWidth={1.75} aria-hidden /></span>
 *             <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">{label}</span>
 *           </span>
 *         );
 *       })}
 *     </div>
 *   );
 * }
 * ==========================================================================*/

export default function Index() {
  const { t } = useTranslation();
  const { data: products } = useHomeProducts();
  const list = products ?? [];
  const slots: (HomeProduct | undefined)[] = Array.from({ length: 5 }, (_, i) => list[i]);
  const floatClasses = ['home-float', 'home-float home-float-2', 'home-float home-float-3', 'home-float home-float-4', 'home-float home-float-5'];

  const steps = [
    { icon: Search, title: t('landing.steps.findTitle'), text: t('landing.steps.findText') },
    { icon: CreditCard, title: t('landing.steps.buyTitle'), text: t('landing.steps.buyText') },
    { icon: Download, title: t('landing.steps.getTitle'), text: t('landing.steps.getText') },
  ];

  const trust = [
    { icon: Shield, title: t('landing.trust.buyerProtectionTitle'), text: t('landing.trust.buyerProtectionText') },
    { icon: ShieldCheck, title: t('landing.trust.reviewedTitle'), text: t('landing.trust.reviewedText') },
    { icon: BadgeCheck, title: t('landing.trust.verifiedSellersTitle'), text: t('landing.trust.verifiedSellersText') },
    { icon: Wallet, title: t('landing.trust.payoutsTitle'), text: t('landing.trust.payoutsText') },
  ];

  return (
    <div className="home-dark min-h-screen">
      {/* Background layers */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="home-stars" />
        <div className="home-grid" />
      </div>

      {/* HERO */}
      <section className="relative max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div aria-hidden className="home-blob" />
        <div className="relative">
          <h1 className="home-headline text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05] mb-6">
            {t('landing.heroTitle')}
          </h1>
          <p className="text-base sm:text-lg text-[var(--text-muted)] max-w-2xl mx-auto mb-10">
            {t('landing.heroSubtitle')}
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              to="/marketplace"
              className="home-cta-primary inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-transform hover:scale-[1.02]"
            >
              <ShoppingBag className="h-4 w-4" />
              {t('landing.browseMarketplace')}
            </Link>
            <Link
              to="/seller-onboarding"
              className="home-cta-secondary inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-colors"
            >
              {t('landing.becomeSeller')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* FLOATING PRODUCT BAND */}
        <div
          className="relative mt-20 flex justify-center items-end gap-4 overflow-x-auto sm:overflow-visible pb-4 snap-x"
          style={{ minHeight: 260 }}
        >
          {slots.map((p, i) => (
            <div key={i} className={`snap-center ${floatClasses[i]}`}>
              <ProductGlassCard product={p} />
            </div>
          ))}
        </div>
      </section>

      {/* MARQUEE — icon chips (decorative, non-interactive, neutral greys) */}
      <section className="relative py-12 border-y border-[var(--hair)]">
        <TooltipProvider delayDuration={150}>
          <div className="home-marquee">
            <div className="home-marquee-track">
              <MarqueeHalf decorative={false} t={t} />
              <MarqueeHalf decorative t={t} />
            </div>
          </div>
        </TooltipProvider>
      </section>

      {/* COMPANY LOGO WALL — consented company logos only */}
      <CompanyLogoWall />

      {/* HOW IT WORKS */}
      <section className="relative max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-3">{t('landing.howItWorks')}</h2>
          <p className="text-[var(--text-muted)]">{t('landing.howItWorksSubtitle')}</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <div key={i} className="home-glass p-8">
              <div className="h-10 w-10 rounded-lg bg-[var(--n-surface-strong)] border border-[var(--hair)] flex items-center justify-center mb-5">
                <s.icon className="h-5 w-5 text-[var(--brand-accent)]" />
              </div>
              <div className="text-xs text-[var(--text-dim)] mb-2">{t('landing.step')} {i + 1}</div>
              <h3 className="text-lg font-medium text-[var(--brand-primary)] mb-2">{s.title}</h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TRUST */}
      <section className="relative max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-3">{t('landing.whyTitle')}</h2>
          <p className="text-[var(--text-muted)]">{t('landing.whySubtitle')}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {trust.map((tr, i) => (
            <div key={i} className="home-glass p-6">
              <tr.icon className="h-6 w-6 text-[var(--brand-accent)] mb-4" />
              <h3 className="text-base font-medium text-[var(--brand-primary)] mb-2">{tr.title}</h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">{tr.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SELLER CTA STRIP */}
      <section className="relative max-w-6xl mx-auto px-6 py-20">
        <div className="home-cta-border p-10 md:p-14 text-center">
          <h2 className="home-headline text-3xl md:text-4xl font-semibold tracking-tight mb-4">
            {t('landing.ctaTitle')}
          </h2>
          <p className="text-[var(--text-muted)] max-w-xl mx-auto mb-8">{t('landing.ctaText')}</p>
          <Link
            to="/seller-onboarding"
            className="home-cta-primary inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-transform hover:scale-[1.02]"
          >
            {t('landing.becomeSeller')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
