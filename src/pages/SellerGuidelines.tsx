import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Zap, Lock, HardDrive, ArrowLeft } from 'lucide-react';

const LAST_UPDATED = 'June 2, 2026';

const sections = [
  { id: 'selling', label: '1. Selling on DK AI Marketplace' },
  { id: 'delivery', label: '2. How your product files are delivered' },
  { id: 'recommendation', label: '3. Our recommendation system' },
  { id: 'review', label: '4. Mandatory product review' },
  { id: 'data', label: '5. Where and how your data is stored' },
  { id: 'allowed', label: '6. What you may and may not sell' },
  { id: 'responsibilities', label: '7. Your responsibilities as a seller' },
  { id: 'legal', label: '8. Legal & jurisdiction' },
];

export default function SellerGuidelines() {
  return (
    <div className="min-h-screen bg-background py-12 px-6">
      <article className="max-w-3xl mx-auto">
        <Button variant="ghost" asChild className="mb-4">
          <Link to="/"><ArrowLeft className="w-4 h-4 mr-2" />Back</Link>
        </Button>
        <header className="mb-10">
          <p className="text-sm font-medium text-primary mb-2">For Sellers</p>
          <h1 className="text-4xl font-display font-semibold text-foreground mb-3">
            Seller Guidelines
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            Everything you need to know before and during selling on DK AI Marketplace —
            how files are delivered, where data is stored, what is legal, and how reviews work.
          </p>
        </header>

        {/* Table of contents */}
        <Card className="p-5 mb-10 bg-muted/30 border-border">
          <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">
            Contents
          </h2>
          <ol className="space-y-1.5">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </Card>

        <div className="prose prose-base max-w-none text-foreground space-y-12 leading-relaxed">
          {/* Section 1 */}
          <section id="selling">
            <h2 className="text-2xl font-semibold mb-4">1. Selling on DK AI Marketplace</h2>
            <p>
              DK AI Marketplace is operated from Switzerland. We connect AI builders —
              companies and individuals — with buyers worldwide.
              As a launch promo, sellers <strong>keep 100% of every sale — zero platform fees
              for the first 20 sales on the platform</strong>. After that, a small platform
              fee (default 5%) applies only when you actually make a sale. Listing is always free.
            </p>
          </section>

          {/* Section 2 */}
          <section id="delivery">
            <h2 className="text-2xl font-semibold mb-4">
              2. How your product files are delivered (3 delivery modes)
            </h2>
            <p className="mb-6">
              When you list a product, you choose how it is delivered. We recommend a mode
              based on your product's price, scarcity, and file size, but the final choice
              is always yours.
            </p>

            <div className="grid gap-4 not-prose">
              <Card className="p-5 border-l-4 border-l-primary">
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Mode 1 — Instant Delivery (hosted by us)</h3>
                    <p className="text-sm text-muted-foreground">
                      Your file is stored securely on our servers (encrypted, access-controlled)
                      and delivered to the buyer automatically the moment they pay. Best for
                      lower-priced, higher-volume, smaller products. Most convenient.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-5 border-l-4 border-l-primary">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      Mode 2 — Protected Delivery (encrypted, released on confirmation)
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Your file is stored encrypted on our servers and only unlocked for the
                      buyer after payment is confirmed. Adds a layer of protection for
                      mid-value products.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-5 border-l-4 border-l-primary">
                <div className="flex items-start gap-3">
                  <HardDrive className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      Mode 3 — Direct Seller Delivery (you keep the file, we hold the money)
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Your file is <strong>never</strong> uploaded to our servers. You keep
                      it. When a buyer pays, their money is held securely by our payment
                      provider (Stripe). You then deliver the product directly to the buyer.
                      Once the buyer confirms they received it, you get paid. Best for
                      high-value, rare, or very large products where you want maximum
                      protection of your intellectual property — because what we never store,
                      we can never lose or leak.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          {/* Section 3 */}
          <section id="recommendation">
            <h2 className="text-2xl font-semibold mb-4">3. Our recommendation system</h2>
            <p className="mb-3">
              For every product, we calculate a recommended delivery mode based on three factors:
            </p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li><strong>Price:</strong> higher price = more protection recommended</li>
              <li><strong>Scarcity:</strong> fewer total sales / limited editions = more protection recommended</li>
              <li><strong>File size:</strong> larger files = more protection recommended</li>
            </ul>
            <p className="mt-4">
              We show you the recommendation and the reason. You can always override it. If
              you choose a less protected mode than recommended, we'll show you a short
              warning so you understand the trade-off.
            </p>
          </section>

          {/* Section 4 */}
          <section id="review">
            <h2 className="text-2xl font-semibold mb-4">4. Mandatory product review before publishing</h2>
            <Card className="p-5 bg-primary/5 border-primary/20 not-prose mb-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-foreground leading-relaxed">
                  Every product — without exception — is reviewed by our team before it goes
                  live. This protects buyers and keeps the marketplace trustworthy.
                </p>
              </div>
            </Card>
            <p>
              For some products (for example, higher-priced products, large files, or
              products in sensitive categories), our review may require temporary access to
              the product or a representative sample to verify it is what it claims to be
              and complies with our content policy. All such access is strictly
              confidential, logged, time-limited, and used only for the review. Submitting
              a product does not guarantee approval. Reviews typically complete within
              <strong> 48 hours</strong>.
            </p>
          </section>

          {/* Section 5 */}
          <section id="data">
            <h2 className="text-2xl font-semibold mb-4">5. Where and how your data is stored</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Product files (for hosted delivery modes) are stored on Supabase
                infrastructure with EU data centers, encrypted at rest and in transit.
              </li>
              <li>
                Payments are processed by Stripe; we never see or store your full bank or
                card details.
              </li>
              <li>
                Personal and account data is processed in line with the Swiss Federal Act on
                Data Protection (revDSG) and the EU GDPR.
              </li>
              <li>
                For Direct Seller Delivery (Mode 3), your product file is never uploaded to
                us at all — it stays with you.
              </li>
              <li>
                You can request export or deletion of your data at any time (see our{' '}
                <Link to="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
                ).
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section id="allowed">
            <h2 className="text-2xl font-semibold mb-4">6. What you may and may not sell</h2>
            <p>
              See our{' '}
              <Link to="/content-policy" className="text-primary hover:underline">
                Content Policy
              </Link>{' '}
              for the full list. In short: no illegal content, no malware, no infringing
              intellectual property, no prohibited categories. AI products must be described
              transparently in line with the EU AI Act.
            </p>
          </section>

          {/* Section 7 */}
          <section id="responsibilities">
            <h2 className="text-2xl font-semibold mb-4">7. Your responsibilities as a seller</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Describe your product accurately and honestly.</li>
              <li>Only sell products you have the rights to.</li>
              <li>Deliver what you promise, on time.</li>
              <li>
                For Direct Seller Delivery, deliver promptly after being notified of a sale,
                and respond to buyers within 72 hours.
              </li>
              <li>Comply with applicable law, including your own tax obligations.</li>
              <li>Companies: ensure your company details are accurate.</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section id="legal">
            <h2 className="text-2xl font-semibold mb-4">8. Legal & jurisdiction</h2>
            <p>
              DK AI Marketplace operates under Swiss law. These guidelines complement our{' '}
              <Link to="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/content-policy" className="text-primary hover:underline">
                Content Policy
              </Link>
              . For full legal terms, see{' '}
              <Link to="/terms" className="text-primary hover:underline">
                /terms
              </Link>
              .
            </p>
          </section>
        </div>

        <footer className="mt-16 pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </footer>
      </article>
    </div>
  );
}
