import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check, ArrowRight } from 'lucide-react';

const URL = 'https://dkaimarketplace.com/blog/top-ai-agent-marketplaces';
const TITLE = 'Top AI Agent Marketplaces to Buy & Sell AI Tools (2026)';
const DESC =
  'Compare the top AI agent marketplaces in 2026 — features, fees, payouts, and who each platform is best for. Includes DK AI Marketplace and the main alternatives.';

const marketplaces = [
  {
    name: 'DK AI Marketplace',
    focus: 'AI agents, automations, prompts, and custom AI work',
    fee: '0% platform fee on the first 20 platform sales, then a low flat fee',
    payouts: 'Direct payouts via Stripe Connect (Express) — funds go straight to the seller',
    bestFor: 'Independent AI builders and small studios shipping agents, automations, and prompt packs',
    highlight: true,
  },
  {
    name: 'Generic prompt marketplaces',
    focus: 'Text prompts for image and chat models',
    fee: '~20% platform commission',
    payouts: 'Held by the platform, paid on a schedule',
    bestFor: 'Prompt engineers selling one-shot prompt files',
  },
  {
    name: 'Model hubs / API marketplaces',
    focus: 'Hosted models and inference endpoints',
    fee: 'Usage-based revenue share',
    payouts: 'Platform-managed, tied to API usage',
    bestFor: 'ML researchers publishing models rather than end-user tools',
  },
  {
    name: 'General digital-goods platforms',
    focus: 'Any digital download (ebooks, templates, code, AI files)',
    fee: '~10% + payment fees',
    payouts: 'Platform wallet with scheduled withdrawal',
    bestFor: 'Sellers who want one storefront across many product types',
  },
];

export default function BlogTopAiAgentMarketplaces() {
  useEffect(() => {
    document.title = TITLE;

    const setMeta = (selector: string, attr: string, value: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement('meta');
        const [k, v] = selector.replace('meta[', '').replace(']', '').split('=');
        el.setAttribute(k, v.replace(/"/g, ''));
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };

    setMeta('meta[name="description"]', 'content', DESC);
    setMeta('meta[property="og:title"]', 'content', TITLE);
    setMeta('meta[property="og:description"]', 'content', DESC);
    setMeta('meta[property="og:url"]', 'content', URL);
    setMeta('meta[property="og:type"]', 'content', 'article');
    setMeta('meta[name="twitter:title"]', 'content', TITLE);
    setMeta('meta[name="twitter:description"]', 'content', DESC);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', URL);

    const upsertLd = (id: string, data: unknown) => {
      let s = document.getElementById(id) as HTMLScriptElement | null;
      if (!s) {
        s = document.createElement('script');
        s.type = 'application/ld+json';
        s.id = id;
        document.head.appendChild(s);
      }
      s.textContent = JSON.stringify(data);
    };

    upsertLd('ld-article', {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: TITLE,
      description: DESC,
      url: URL,
      author: { '@type': 'Organization', name: 'DK AI Marketplace' },
      publisher: {
        '@type': 'Organization',
        name: 'DK AI Marketplace',
        logo: { '@type': 'ImageObject', url: 'https://dkaimarketplace.com/logo.png' },
      },
      datePublished: '2026-07-09',
      dateModified: '2026-07-09',
      mainEntityOfPage: URL,
    });

    upsertLd('ld-breadcrumbs', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://dkaimarketplace.com/' },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://dkaimarketplace.com/blog' },
        { '@type': 'ListItem', position: 3, name: TITLE, item: URL },
      ],
    });

    upsertLd('ld-faq', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is an AI agent marketplace?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'An AI agent marketplace is an online platform where builders publish AI agents, automations, and prompts, and buyers purchase them for immediate use in their own workflows.',
          },
        },
        {
          '@type': 'Question',
          name: 'What fees do AI agent marketplaces charge?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Most platforms charge 10-20% commission plus payment processing. DK AI Marketplace charges 0% platform fee on a seller\u2019s first 20 platform sales, then a low flat fee, with Stripe processing fees paid by the seller.',
          },
        },
        {
          '@type': 'Question',
          name: 'How do payouts work on DK AI Marketplace?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Payouts run through Stripe Connect using direct charges, so buyer payments land in the seller\u2019s own Stripe account on their normal Stripe payout schedule.',
          },
        },
      ],
    });

    return () => {
      document.getElementById('ld-article')?.remove();
      document.getElementById('ld-breadcrumbs')?.remove();
      document.getElementById('ld-faq')?.remove();
    };
  }, []);

  return (
    <AppLayout>
      <article className="max-w-3xl mx-auto px-6 py-12">
        <nav className="text-sm text-muted-foreground mb-6" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2">/</span>
          <span>Blog</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">Top AI Agent Marketplaces</span>
        </nav>

        <h1 className="text-4xl md:text-5xl font-display font-semibold tracking-tight mb-4">
          Top AI Agent Marketplaces to Buy &amp; Sell AI Tools (2026)
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          A practical comparison of where AI builders sell agents, automations, and prompts today —
          and where buyers actually find high-quality tools worth paying for.
        </p>

        <section className="prose prose-slate max-w-none mb-10">
          <h2>What is an AI agent marketplace?</h2>
          <p>
            An <strong>AI agent marketplace</strong> is a platform where independent builders publish
            AI agents, automations, prompt packs, and custom AI work, and buyers purchase them
            directly. Unlike generic app stores, these marketplaces are built around AI-native
            products: things you configure with an API key, drop into an automation, or run as a
            standalone agent.
          </p>
          <p>
            The category has grown fast: search demand for "ai agent marketplace" now sits around
            880 monthly searches with low competition, and adjacent terms like "buy ai agents" and
            "sell ai prompts" show the same trend. If you're a builder, this is a real distribution
            channel. If you're a buyer, it's usually cheaper and faster than commissioning custom
            work.
          </p>

          <h2>How to choose the right marketplace</h2>
          <ul>
            <li><strong>Fees.</strong> Platform commission plus payment processing.</li>
            <li><strong>Payouts.</strong> Direct to your bank via Stripe, or held in a platform wallet.</li>
            <li><strong>Product fit.</strong> Agents and automations, prompts only, or generic digital goods.</li>
            <li><strong>Audience.</strong> Who's actually browsing and buying on the platform.</li>
            <li><strong>Trust.</strong> Refunds, dispute handling, and seller verification.</li>
          </ul>
        </section>

        <h2 className="text-2xl font-semibold mb-4">Comparison at a glance</h2>
        <div className="grid gap-4 mb-10">
          {marketplaces.map((m) => (
            <Card key={m.name} className={m.highlight ? 'border-primary border-2' : ''}>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-semibold">{m.name}</h3>
                  {m.highlight && (
                    <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                      Our platform
                    </span>
                  )}
                </div>
                <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Focus</dt>
                    <dd>{m.focus}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Fees</dt>
                    <dd>{m.fee}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Payouts</dt>
                    <dd>{m.payouts}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Best for</dt>
                    <dd>{m.bestFor}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>

        <section className="prose prose-slate max-w-none mb-10">
          <h2>Why builders pick DK AI Marketplace</h2>
          <ul>
            <li><Check className="inline w-4 h-4 text-primary mr-1" />0% platform fee on the first 20 platform sales — you keep everything except Stripe's processing cut.</li>
            <li><Check className="inline w-4 h-4 text-primary mr-1" />Stripe Connect direct charges — payouts land in <em>your</em> Stripe account, on your normal payout schedule.</li>
            <li><Check className="inline w-4 h-4 text-primary mr-1" />Sell agents, automations, prompts, and custom AI work from a single seller dashboard.</li>
            <li><Check className="inline w-4 h-4 text-primary mr-1" />Guest checkout for buyers — no forced signup between them and your product.</li>
            <li><Check className="inline w-4 h-4 text-primary mr-1" />Verified seller badges and a clear refund policy so buyers trust the store.</li>
          </ul>

          <h2>Why buyers use it</h2>
          <p>
            Buyers get one place to browse working AI agents and automations, with real ratings,
            transparent pricing (one-time, subscription, or usage-based), and Stripe-backed
            checkout. Every purchase is downloadable or usable immediately, and a 14-day refund
            policy applies where the product doesn't match its description.
          </p>

          <h2>FAQ</h2>
          <h3>What is an AI agent marketplace?</h3>
          <p>A platform where builders publish AI agents, automations, and prompts, and buyers purchase them for immediate use in their own workflows.</p>
          <h3>What fees do AI agent marketplaces charge?</h3>
          <p>Most charge 10–20% commission plus payment processing. DK AI Marketplace charges 0% on your first 20 platform sales, then a low flat fee, with Stripe's processing fees paid by the seller.</p>
          <h3>How do payouts work on DK AI Marketplace?</h3>
          <p>Through Stripe Connect direct charges — payments land in your own Stripe account on your normal Stripe payout schedule.</p>
        </section>

        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/marketplace">
              Browse the marketplace <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/signup">Start selling</Link>
          </Button>
        </div>
      </article>
    </AppLayout>
  );
}
