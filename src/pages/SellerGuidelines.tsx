import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Zap, Lock, HardDrive, ArrowLeft } from 'lucide-react';

const LAST_UPDATED = '19.8.2026';

const sections = [
  { id: 'selling', label: '1. Selling on DK AI Marketplace' },
  { id: 'providers', label: '2. Payment providers and selling without one' },
  { id: 'delivery', label: '3. How your product files are delivered' },
  { id: 'recommendation', label: '4. Our recommendation system' },
  { id: 'review', label: '5. Mandatory product review and demo video' },
  { id: 'data', label: '6. Where and how your data is stored' },
  { id: 'allowed', label: '7. What you may and may not sell' },
  { id: 'responsibilities', label: '8. Your responsibilities as a seller' },
  { id: 'legal', label: '9. Legal & jurisdiction' },
  { id: 'hosting-liability', label: '10. Hosting & liability' },
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
            Everything you need to know before and during selling on DK AI Marketplace: how files
            are delivered, where data is stored, what is legal, and how reviews work.
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
              DK AI Marketplace is operated from Switzerland. We connect AI builders, companies and
              individuals, with buyers worldwide. As a launch promo, sellers{' '}
              <strong>keep 100% of every sale: zero platform fees for the first 20 sales on the
              platform</strong> (platform-wide, first come first served). After that, a small
              platform fee (default 5%) applies only when you actually make a sale. Listing is
              always free. We do not guarantee any sales, revenue, or visibility; your results
              depend on your product, pricing, and presentation.
            </p>
          </section>

          {/* Section 2 */}
          <section id="providers">
            <h2 className="text-2xl font-semibold mb-4">
              2. Payment providers and selling without one
            </h2>
            <p>
              Payouts run through Stripe or PayPal. You connect your own account with at least one
              supported provider. You can create a seller account and submit products for review
              before connecting a provider: once approved, your product is visible to everyone on
              the marketplace, including visitors without an account, but it cannot be purchased
              until you connect Stripe or PayPal. Until then the listing shows that it is not yet
              available for purchase.
            </p>
          </section>

          {/* Section 3 */}
          <section id="delivery">
            <h2 className="text-2xl font-semibold mb-4">
              3. How your product files are delivered (3 delivery modes)
            </h2>
            <p className="mb-6">
              When you list a product, you choose how it is delivered. We recommend a mode based on
              your product's price, scarcity, and file size, but the final choice is always yours.
            </p>

            <div className="grid gap-4 not-prose">
              <Card className="p-5 border-l-4 border-l-primary">
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Mode 1: Instant Delivery (hosted by us)</h3>
                    <p className="text-sm text-muted-foreground">
                      Your file is stored on our infrastructure (encrypted, access-controlled) and
                      delivered to the buyer automatically the moment they pay. Best for
                      lower-priced, higher-volume, smaller products.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-5 border-l-4 border-l-primary">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      Mode 2: Protected Delivery (encrypted, released on confirmation)
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Your file is stored encrypted on our infrastructure and only unlocked for the
                      buyer after payment is confirmed. Adds a layer of protection for mid-value
                      products.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-5 border-l-4 border-l-primary">
                <div className="flex items-start gap-3">
                  <HardDrive className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      Mode 3: Direct Seller Delivery (you keep the file)
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Your file is <strong>never</strong> uploaded to our servers. You keep it. When
                      a buyer pays, the funds are held by the payment provider (Stripe or PayPal).
                      You then deliver the product directly to the buyer. Once the buyer confirms
                      receipt, you are paid. Best for high-value, rare, or very large products,
                      because what we never store, we can never lose or leak.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          {/* Section 4 */}
          <section id="recommendation">
            <h2 className="text-2xl font-semibold mb-4">4. Our recommendation system</h2>
            <p>
              For every product, we calculate a recommended delivery mode based on price (higher
              price, more protection), scarcity (fewer sales or limited editions, more protection),
              and file size (larger files, more protection). We show you the recommendation and the
              reason. You can always override it. If you choose a less protected mode than
              recommended, we show you a short warning so you understand the trade-off.
            </p>
          </section>

          {/* Section 5 */}
          <section id="review">
            <h2 className="text-2xl font-semibold mb-4">5. Mandatory product review and demo video</h2>
            <Card className="p-5 bg-primary/5 border-primary/20 not-prose mb-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-foreground leading-relaxed">
                  Every product, without exception, is reviewed by our team before it goes live.
                  Every product must include at least one demo video showing the product actually
                  running (a link or an uploaded file); a product cannot be approved without one.
                </p>
              </div>
            </Card>
            <p>
              For some products (higher-priced, large files, sensitive categories), review may
              require temporary access to the product or a representative sample. All such access is
              strictly confidential, logged, time-limited, and used only for the review. Submitting
              a product does not guarantee approval. Reviews typically complete within
              <strong> 48 hours</strong>. Demo videos and review material are stored by us,
              including in archived form after review, to document how a listing was assessed; keep
              your own copy (see section 10).
            </p>
          </section>

          {/* Section 6 */}
          <section id="data">
            <h2 className="text-2xl font-semibold mb-4">6. Where and how your data is stored</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Product files (for hosted delivery modes) are stored on Supabase infrastructure with
                EU data centers, encrypted at rest and in transit.
              </li>
              <li>
                Payments are processed by Stripe or PayPal; we never see or store your full bank or
                card details.
              </li>
              <li>
                If a product requires the buyer to hand over setup information such as an API key,
                that information is encrypted end to end and is accessible only to the seller of
                that product; it is not accessible to the platform operator.
              </li>
              <li>
                Personal and account data is processed in line with the Swiss revDSG and the EU
                GDPR.
              </li>
              <li>
                For Direct Seller Delivery, your product file is never uploaded to us at all.
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

          {/* Section 7 */}
          <section id="allowed">
            <h2 className="text-2xl font-semibold mb-4">7. What you may and may not sell</h2>
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

          {/* Section 8 */}
          <section id="responsibilities">
            <h2 className="text-2xl font-semibold mb-4">8. Your responsibilities as a seller</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Describe your product accurately and honestly.</li>
              <li>Only sell products you have the rights to.</li>
              <li>Deliver what you promise, on time.</li>
              <li>Respond to general buyer messages within 72 hours.</li>
              <li>
                Respond to refund requests and disputes within 48 hours; if you do not, the case may
                be decided in the buyer's favour.
              </li>
              <li>
                For Direct Seller Delivery, deliver promptly after being notified of a sale.
              </li>
              <li>Comply with applicable law, including your own tax obligations.</li>
              <li>Companies: ensure your company details are accurate.</li>
            </ul>
          </section>

          {/* Section 9 */}
          <section id="legal">
            <h2 className="text-2xl font-semibold mb-4">9. Legal &amp; jurisdiction</h2>
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

          {/* Section 10 */}
          <section id="hosting-liability">
            <h2 className="text-2xl font-semibold mb-4">10. Hosting &amp; liability <span className="text-sm font-normal text-muted-foreground">(subject to lawyer review)</span></h2>
            <p>
              Product files, demo videos, and data are stored on third-party infrastructure
              (Supabase). Keep your own master copies of everything you upload, including demo
              videos. To the maximum extent permitted by applicable law, DK AI Marketplace and Dari
              Kastrati are not liable for data loss, deletion, corruption, unauthorized access,
              hacking, or breaches of platform or third-party infrastructure, and pay no
              compensation for such events, except where they result from our intent or gross
              negligence. Sellers and buyers are responsible for their own backups and for rotating
              any shared credentials after setup.
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
