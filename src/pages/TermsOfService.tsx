import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Link } from "react-router-dom";

const LAST_UPDATED = "19.8.2026";

const sections = [
  { id: "scope", title: "1. Scope" },
  { id: "definitions", title: "2. Definitions" },
  { id: "eligibility", title: "3. Eligibility" },
  { id: "account", title: "4. Account Registration" },
  { id: "role", title: "5. Our Role" },
  { id: "seller-obligations", title: "6. Seller Obligations" },
  { id: "buyer-obligations", title: "7. Buyer Obligations" },
  { id: "payments", title: "8. Payments" },
  { id: "platform-fee", title: "9. Platform Fee" },
  { id: "custom-orders", title: "10. Custom Commission Orders" },
  { id: "refunds", title: "11. Refunds" },
  { id: "disputes", title: "12. Disputes" },
  { id: "ip", title: "13. Intellectual Property" },
  { id: "prohibited", title: "14. Prohibited Content" },
  { id: "moderation", title: "15. Content Moderation" },
  { id: "liability", title: "16. Limitation of Liability" },
  { id: "indemnification", title: "17. Indemnification" },
  { id: "changes", title: "18. Changes to the Terms" },
  { id: "termination", title: "19. Termination" },
  { id: "governing-law", title: "20. Governing Law" },
  { id: "jurisdiction", title: "21. Jurisdiction" },
  { id: "severability", title: "22. Severability" },
  { id: "odr", title: "23. Online Dispute Resolution" },
  { id: "contact", title: "24. Contact" },
];

export default function TermsOfService() {
  const [tocOpen, setTocOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto py-12 px-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link to="/"><ArrowLeft className="w-4 h-4 mr-2" />Back</Link>
        </Button>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-8">
          <article className="max-w-3xl">
            <h1 className="font-display text-4xl font-semibold mb-2">Terms of Service</h1>
            <p className="text-sm text-muted-foreground mb-2">Last updated: {LAST_UPDATED}</p>
            <p className="text-sm text-muted-foreground mb-6">Reading time: ~15 minutes</p>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="mb-6 print:hidden"
            >
              <Printer className="h-4 w-4 mr-2" /> Print this page
            </Button>

            <div className="bg-primary/10 border border-primary/30 p-6 mb-8 rounded-lg">
              <p className="text-base leading-relaxed text-foreground">
                <strong>Quick summary:</strong> These are the rules for using DK AI Marketplace. By
                signing up you agree to them. Launch promo: 0% platform fee for the first 20 sales
                on the platform. After that, a small platform fee (default 5%) applies. Payments are
                processed by Stripe or PayPal and go directly to the seller's connected payment
                account; the provider's standard processing fees apply and are borne by the seller.
                Swiss law applies, and we are a marketplace (not a party to your transactions). Full
                details below.
              </p>
            </div>

            <div className="lg:hidden mb-8 print:hidden">
              <button
                onClick={() => setTocOpen(!tocOpen)}
                className="w-full text-left px-4 py-2 border border-border rounded-md font-medium"
              >
                {tocOpen ? "Hide" : "Show"} Table of Contents
              </button>
              {tocOpen && (
                <ul className="mt-2 space-y-1 text-sm bg-muted/50 p-4 rounded-md">
                  {sections.map((s) => (
                    <li key={s.id}>
                      <a href={`#${s.id}`} className="text-primary hover:underline">
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <section id="scope">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">1. Scope</h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                These Terms of Service govern the use of DK AI Marketplace (&quot;Platform&quot;),
                operated by Dari Kastrati, Udligenswilerstrasse 15, 6043 Adligenswil, Switzerland
                (&quot;Operator&quot;, &quot;we&quot;). By registering you accept these terms.
              </p>
            </section>

            <section id="definitions">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">2. Definitions</h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li><strong>&quot;Platform&quot;</strong> = dkaimarketplace.com including all services</li>
                <li><strong>&quot;User&quot;</strong> = any natural or legal person with an account</li>
                <li><strong>&quot;Buyer&quot;</strong> = a person who purchases products, with or without an account (guest checkout)</li>
                <li><strong>&quot;Seller&quot;</strong> = user who offers products</li>
                <li><strong>&quot;Product&quot;</strong> = digital AI products, agents, templates, workflows</li>
                <li><strong>&quot;Service&quot;</strong> = custom commission orders, expert calls</li>
                <li><strong>&quot;Transaction&quot;</strong> = a completed purchase</li>
              </ul>
            </section>

            <section id="eligibility">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">3. Eligibility</h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Minimum age: 18 years, or the applicable local minimum age</li>
                <li>Truthful information at registration</li>
                <li>Only one account per person</li>
              </ul>
            </section>

            <section id="account">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">4. Account Registration</h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>E-mail address and secure password; two-factor authentication is available and recommended</li>
                <li>You are responsible for your credentials and for all activity under your account</li>
                <li>Notify us immediately if you suspect misuse</li>
                <li>We may refuse or close accounts</li>
              </ul>
            </section>

            <section id="role">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">5. Our Role</h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                We are a <strong>marketplace</strong>. We are NOT a party to purchases between users.
              </p>
              <p className="text-base leading-relaxed text-foreground mb-2 font-semibold">We provide:</p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>The platform itself</li>
                <li>Payment processing via our providers: Stripe Connect (direct charges to the seller's account) and PayPal</li>
                <li>A dispute-handling system</li>
                <li>Content moderation and pre-publication product review</li>
              </ul>
              <p className="text-base leading-relaxed text-foreground mb-2 font-semibold">We do NOT provide:</p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Any quality guarantee for offered products</li>
                <li>Liability for seller-supplied content</li>
                <li>Any uptime or availability guarantee</li>
                <li>Any guarantee of sales, revenue, traffic, or visibility for sellers</li>
              </ul>
            </section>

            <section id="seller-obligations">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">6. Seller Obligations</h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>
                  Connect your own payment account with at least one supported provider (Stripe or
                  PayPal) to receive payouts. You may submit products for review before connecting a
                  provider; approved products are then publicly visible but cannot be purchased until
                  a provider is connected
                </li>
                <li>Describe products truthfully and include the required demo video with every product</li>
                <li>Deliver within the promised timeframe</li>
                <li>Respond to messages within 72 hours; respond to refund requests and disputes within 48 hours (see section 11)</li>
                <li>Only offer products for which you hold the necessary rights</li>
                <li>Comply with all legal requirements (taxes, etc.)</li>
                <li>Comply with EU AI Act transparency for AI products</li>
                <li>Accept the Seller Agreement and Seller Rules before publishing</li>
              </ul>
            </section>

            <section id="buyer-obligations">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">7. Buyer Obligations</h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Provide truthful information</li>
                <li>Check product suitability yourself before purchase</li>
                <li>Pay in full and on time</li>
                <li>Communicate custom order specifications clearly</li>
                <li>
                  Where a product requires setup credentials, provide them through the platform's
                  encrypted handover, and rotate them after setup
                </li>
              </ul>
            </section>

            <section id="payments">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">8. Payments</h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>All payments run through our payment providers, Stripe or PayPal</li>
                <li>We do not store card details or full bank details</li>
                <li>Payments are captured at checkout (custom orders: upon acceptance)</li>
                <li>Payments go directly to the seller's connected payment account (Stripe direct charges, or PayPal); we do not hold seller funds</li>
                <li>The provider's standard processing fees apply and are borne by the seller</li>
              </ul>
            </section>

            <section id="platform-fee">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">9. Platform Fee</h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Launch promo: 0% platform fee for the first 20 sales on the platform, platform-wide, first come first served; sellers keep 100% (minus payment processing fees)</li>
                <li>Afterwards: platform fee (default 5%) per transaction, announced at least 30 days before it takes effect</li>
                <li>Payment processing fees always apply separately and are borne by the seller</li>
              </ul>
            </section>

            <section id="custom-orders">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">10. Custom Commission Orders</h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Buyer describes requirements and proposes a price</li>
                <li>Seller accepts or declines within 7 days</li>
                <li>On acceptance: payment is captured</li>
                <li>Seller delivers per the agreement</li>
                <li>Buyer confirms or opens a dispute</li>
                <li>Payout after confirmation or lapse of the review period</li>
              </ul>
            </section>

            <section id="refunds">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">11. Refunds</h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Because digital products are delivered immediately, buyers consent at checkout to
                immediate delivery and acknowledge that the statutory right of withdrawal lapses once
                download or access begins (Art. 16 lit. m EU Directive 2011/83/EU, where applicable).
              </p>
              <p className="text-base leading-relaxed text-foreground mb-2 font-semibold">Refunds are granted only through DK AI Marketplace support review, for:</p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Product not delivered within the promised delivery time</li>
                <li>Product materially not as described in the listing</li>
              </ul>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Refund requests must be filed within 14 days of purchase. The seller must respond
                within 48 hours; otherwise the case is decided in the buyer&apos;s favour. Approved
                refunds are for the full purchase price, funded from the seller&apos;s provider
                balance, and issued via the original payment method (Stripe or PayPal), typically
                within 24-72 hours of approval. Refunds under this section are the sole remedy
                available through the platform; section 16 applies otherwise. Mandatory consumer
                rights remain unaffected.
              </p>
            </section>

            <section id="disputes">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">12. Disputes</h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Disputes are first handled between buyer and seller</li>
                <li>If unresolved: the platform's dispute team decides</li>
                <li>Decisions are binding for the payout on the platform</li>
                <li>Recourse to ordinary courts remains reserved</li>
              </ul>
            </section>

            <section id="ip">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">13. Intellectual Property</h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>You keep all rights to your content</li>
                <li>You grant us a non-exclusive licence to display, market, and deliver it on the platform</li>
                <li>You warrant that you hold all necessary rights</li>
                <li>Infringement leads to account suspension and damages</li>
                <li>
                  Demo videos and review material you submit are stored by us, including in archived
                  form after review, to document how a listing was assessed; keep your own copies
                </li>
              </ul>
            </section>

            <section id="prohibited">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">14. Prohibited Content</h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Illegal products or services</li>
                <li>AI products without transparency (EU AI Act violations)</li>
                <li>Malware, viruses, malicious code</li>
                <li>Copyright infringements</li>
                <li>Hate speech, discrimination, harassment</li>
                <li>Pornography, glorification of violence</li>
                <li>Third-party personal data without consent</li>
                <li>Spam, bulk messaging</li>
              </ul>
            </section>

            <section id="moderation">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">15. Content Moderation</h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Every product is reviewed before publication; we may approve, request changes, or decline</li>
                <li>We may remove content without prior notice</li>
                <li>We may suspend accounts for violations; suspensions and deletions are recorded with a reason</li>
                <li>Permanent bans for repeated or serious violations</li>
                <li>Outstanding payouts are reviewed on a case-by-case basis</li>
              </ul>
            </section>

            <section id="liability">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">16. Limitation of Liability</h2>
              <p className="text-base leading-relaxed text-foreground mb-2">To the maximum extent permitted by applicable law:</p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>We are not liable for the content or actions of other users</li>
                <li>No liability for lost profits, lost sales, lost data, business interruption, or consequential damages</li>
                <li>
                  No liability for damage arising from unauthorized access to, hacking of, or failure
                  of the platform or third-party infrastructure (including Supabase, Stripe, PayPal,
                  hosting and model providers), and no compensation is paid for such events
                </li>
                <li>No liability for interruptions or unavailability of the platform</li>
                <li>Liability is capped at the fees paid to us in the last 12 months</li>
                <li>
                  In case of intent or gross negligence, and wherever liability cannot lawfully be
                  excluded, liability remains unlimited
                </li>
              </ul>
            </section>

            <section id="indemnification">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">17. Indemnification</h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                You shall indemnify us, including Dari Kastrati personally as operator, against all
                third-party claims arising out of your use of the platform, your products, or your
                breach of these terms, including reasonable legal fees, to the extent permitted by
                law.
              </p>
            </section>

            <section id="changes">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">18. Changes to the Terms</h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>We may update these terms</li>
                <li>Material changes are announced 30 days in advance by e-mail</li>
                <li>If you object within 30 days, your account will be terminated</li>
                <li>Without objection the new terms apply</li>
              </ul>
            </section>

            <section id="termination">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">19. Termination</h2>
              <p className="text-base leading-relaxed text-foreground mb-2">
                You may delete your account at any time.
              </p>
              <p className="text-base leading-relaxed text-foreground mb-2 font-semibold">We may terminate:</p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Immediately and without notice for breach of these terms</li>
                <li>Without reason: with 30 days' notice</li>
              </ul>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Outstanding payment obligations survive termination. Obligations relating to
                completed sales (support, refunds) continue for a reasonable period.
              </p>
            </section>

            <section id="governing-law">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">20. Governing Law</h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Swiss law, excluding conflict-of-law rules and the UN Convention on Contracts for
                the International Sale of Goods (CISG). Mandatory consumer-protection provisions
                remain unaffected.
              </p>
            </section>

            <section id="jurisdiction">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">21. Jurisdiction</h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Exclusive place of jurisdiction is the Canton of Lucerne, Switzerland, unless
                mandatory law provides otherwise.
              </p>
            </section>

            <section id="severability">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">22. Severability</h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                If any provision is invalid, the validity of the remaining provisions is not
                affected.
              </p>
            </section>

            <section id="odr">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">23. Online Dispute Resolution</h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                EU consumers may use the European Commission's ODR platform:{" "}
                <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  ec.europa.eu/consumers/odr
                </a>
              </p>
              <p className="text-base leading-relaxed text-foreground mb-4">
                We are not required to participate in consumer arbitration proceedings but are
                willing to do so.
              </p>
            </section>

            <section id="contact">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">24. Contact</h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Dari Kastrati<br />
                DK AI Marketplace<br />
                Udligenswilerstrasse 15<br />
                6043 Adligenswil, Switzerland<br />
                Business and legal matters:{" "}
                <a href="mailto:management@dkaimarketplace.com" className="text-primary hover:underline">
                  management@dkaimarketplace.com
                </a>
                <br />
                Support:{" "}
                <a href="mailto:support@dkaimarketplace.com" className="text-primary hover:underline">
                  support@dkaimarketplace.com
                </a>
              </p>
            </section>

            <div className="mt-12 pt-8 border-t border-border">
              <p className="text-base text-foreground">
                Read also:{" "}
                <Link to="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
              </p>
              <p className="text-sm text-muted-foreground mt-4">Last updated: {LAST_UPDATED}</p>
            </div>
          </article>

          <aside className="hidden lg:block print:hidden">
            <nav className="sticky top-24">
              <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Table of Contents
              </h3>
              <ul className="space-y-2 text-sm">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="text-primary hover:underline block">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        </div>
      </div>
    </div>
  );
}
