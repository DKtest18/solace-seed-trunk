import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShoppingBag, Search, CreditCard, Download, Shield, ShieldCheck, BadgeCheck, Wallet, ArrowRight } from 'lucide-react';
import { db } from '@/lib/dkaiDb';
import { formatMoney } from '@/lib/money';
import './index-home.css';

const CATEGORIES = ['AI Agents', 'Automations', 'Workflows', 'Prompts', 'Templates', 'Datasets'];

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
        .eq('is_published', true)
        .eq('review_status', 'approved')
        .eq('exclusive_locked', false)
        .order('trending_score', { ascending: false, nullsFirst: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as HomeProduct[];
    },
  });
}

function ProductGlassCard({ product, className = '' }: { product?: HomeProduct; className?: string }) {
  if (!product) {
    return (
      <div className={`home-glass p-4 w-56 ${className}`}>
        <div className="aspect-[4/3] rounded-lg bg-white/5 mb-3 flex items-center justify-center text-xs text-[#94A3B8]">
          Coming soon
        </div>
        <div className="h-3 w-3/4 rounded bg-white/10 mb-2" />
        <div className="h-3 w-1/3 rounded bg-white/10" />
      </div>
    );
  }
  return (
    <Link
      to={`/product/${product.id}`}
      className={`home-glass p-4 w-56 block group transition-transform hover:-translate-y-1 ${className}`}
    >
      <div className="aspect-[4/3] rounded-lg bg-white/5 overflow-hidden mb-3">
        {product.image_url ? (
          <img src={product.image_url} alt={product.title} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-[#94A3B8]">DK AI</div>
        )}
      </div>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm font-medium text-[#F1F5F9] line-clamp-1">{product.title}</span>
        <BadgeCheck className="h-4 w-4 text-[#22C55E] shrink-0" aria-label="Verified" />
      </div>
      <div className="text-sm text-[#94A3B8]">{formatMoney(product.price, product.currency)}</div>
    </Link>
  );
}

export default function Index() {
  const { data: products } = useHomeProducts();
  const list = products ?? [];
  const slots: (HomeProduct | undefined)[] = Array.from({ length: 5 }, (_, i) => list[i]);
  const floatClasses = ['home-float', 'home-float home-float-2', 'home-float home-float-3', 'home-float home-float-4', 'home-float home-float-5'];

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
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[#94A3B8] mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" /> Live · Swiss Quality · AI-First
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05] mb-6">
            <span className="home-headline-grad">The Marketplace for Ready-Made AI Automations</span>
          </h1>
          <p className="text-base sm:text-lg text-[#94A3B8] max-w-2xl mx-auto mb-10">
            Verified sellers. Reviewed AI agents, workflows and prompts. Buy in minutes — no account needed.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              to="/marketplace"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-white shadow-lg shadow-[#2563EB]/30 transition-transform hover:scale-[1.02]"
              style={{ background: '#2563EB' }}
            >
              <ShoppingBag className="h-4 w-4" />
              Browse Marketplace
            </Link>
            <Link
              to="/seller-onboarding"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-[#F1F5F9] border border-white/15 bg-white/5 hover:bg-white/10 transition-colors"
            >
              Become a Seller
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

      {/* MARQUEE */}
      <section className="relative py-10 border-y border-white/10 bg-[#0A0E1A]/80">
        <div className="home-marquee">
          <div className="home-marquee-track">
            {[...CATEGORIES, ...CATEGORIES, ...CATEGORIES, ...CATEGORIES].map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-[#F1F5F9]/90"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-3">How it works</h2>
          <p className="text-[#94A3B8]">Three steps to your AI solution.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Search, title: 'Find it', text: 'Browse reviewed AI agents, workflows and prompts from real builders.' },
            { icon: CreditCard, title: 'Buy it (no account needed)', text: 'Secure Stripe checkout — no sign-up required, no hidden fees. PayPal coming soon.' },
            { icon: Download, title: 'Get it instantly', text: 'Downloads, access details and setup delivered right after payment.' },
          ].map((s, i) => (
            <div key={i} className="home-glass p-8">
              <div className="h-10 w-10 rounded-lg bg-[#2563EB]/15 border border-[#2563EB]/30 flex items-center justify-center mb-5">
                <s.icon className="h-5 w-5 text-[#60A5FA]" />
              </div>
              <div className="text-xs text-[#94A3B8] mb-2">Step {i + 1}</div>
              <h3 className="text-lg font-medium text-[#F1F5F9] mb-2">{s.title}</h3>
              <p className="text-sm text-[#94A3B8] leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TRUST */}
      <section className="relative max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-3">Why DK AI Marketplace</h2>
          <p className="text-[#94A3B8]">Trust isn't a feature list — it's the standard.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Shield, title: 'Buyer Protection', text: 'support-reviewed refunds if a product is not delivered or is materially not as described. Requests within 14 days of purchase.' },
            { icon: ShieldCheck, title: 'Admin-Reviewed Products', text: 'Every product is manually reviewed before it goes live.' },
            { icon: BadgeCheck, title: 'Verified Sellers', text: 'Identity verified for every seller. Products go live only after review.' },
            { icon: Wallet, title: 'Direct Payouts', text: "Payments flow straight to the seller's connected Stripe account — no detours. PayPal payouts coming soon." },
          ].map((t, i) => (
            <div key={i} className="home-glass p-6">
              <t.icon className="h-6 w-6 text-[#60A5FA] mb-4" />
              <h3 className="text-base font-medium text-[#F1F5F9] mb-2">{t.title}</h3>
              <p className="text-sm text-[#94A3B8] leading-relaxed">{t.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SELLER CTA STRIP */}
      <section className="relative max-w-6xl mx-auto px-6 py-20">
        <div className="home-cta-border p-10 md:p-14 text-center">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
            <span className="home-headline-grad">Sell your AI products</span>
          </h2>
          <p className="text-[#94A3B8] max-w-xl mx-auto mb-8">
            Become a verified seller and reach a buy-ready community — with direct Stripe payouts (PayPal coming soon) and a fair fee structure.
          </p>
          <Link
            to="/seller-onboarding"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-white shadow-lg shadow-[#2563EB]/30 transition-transform hover:scale-[1.02]"
            style={{ background: '#2563EB' }}
          >
            Become a Seller
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
