import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Link } from "react-router-dom";

const LAST_UPDATED = "1 July 2026";

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
                <strong>Quick summary:</strong> These are the rules for using DK AI Marketplace.
                By signing up you agree to them. Launch promo: 0% platform fee for the first 20
                sales on the platform. After that, a small platform fee (default 5%) applies.
                Payments are processed by Stripe and go directly to the seller's Stripe account;
                Stripe's standard payment processing fees apply and are borne by the seller.
                Swiss law applies, and we are a marketplace (not a party to your transactions).
                Full details below.
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
                <li><strong>&quot;Buyer&quot;</strong> = user who purchases products</li>
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
                <li>E-mail address and secure password</li>
                <li>You are responsible for your credentials</li>
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
                <li>Payment processing via Stripe Connect (direct charges to the seller's account)</li>
                <li>A dispute-handling system</li>
                <li>Content moderation</li>
              </ul>
              <p className="text-base leading-relaxed text-foreground mb-2 font-semibold">We do NOT provide:</p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Any quality guarantee for offered products</li>
                <li>Liability for seller-supplied content</li>
                <li>Any uptime or availability guarantee</li>
              </ul>
            </section>

            <section id="seller-obligations">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">6. Seller Obligations</h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Set up your own Stripe Connect account</li>
                <li>Describe products truthfully</li>
                <li>Deliver within the promised timeframe</li>
                <li>Respond to messages within 72 hours</li>
                <li>Only offer products for which you hold the necessary rights</li>
                <li>Comply with all legal requirements (taxes, etc.)</li>
                <li>Comply with EU AI Act transparency for AI products</li>
              </ul>
            </section>

            <section id="buyer-obligations">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">7. Buyer Obligations</h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Provide truthful information</li>
                <li>Check product suitability yourself</li>
                <li>Pay in full and on time</li>
                <li>Communicate custom order specifications clearly</li>
              </ul>
            </section>

            <section id="payments">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">8. Payments</h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>All payments run through Stripe</li>
                <li>We do not store card details</li>
                <li>Payments are captured at checkout (custom orders: upon acceptance)</li>
                <li>Payments go directly to the seller's Stripe account (direct charges)</li>
                <li>Stripe's standard payment processing fees apply and are borne by the seller</li>
              </ul>
            </section>

            <section id="platform-fee">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">9. Platform Fee</h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Launch promo: 0% platform fee for the first 20 sales on the platform — sellers keep 100% (minus Stripe processing fees)</li>
                <li>Afterwards: platform fee (default 5%) per transaction</li>
                <li>Stripe processing fees always apply separately and are borne by the seller</li>
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
                Because digital products are delivered immediately, the statutory right of
                withdrawal does not apply (Art. 16 lit. m EU Directive 2011/83/EU). Buyers
                confirm this at checkout.
              </p>
              <p className="text-base leading-relaxed text-foreground mb-2 font-semibold">Exceptions:</p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Product does not match the description &rarr; refund</li>
                <li>Seller does not deliver &rarr; automatic refund after 14 days</li>
                <li>Justified complaint via the dispute system</li>
                <li>Within the seller's return window (min. 24 hours, max. 90 days): full unconditional refund via Stripe</li>
              </ul>
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
                <li>You grant us a non-exclusive licence to display it</li>
                <li>You warrant that you hold all necessary rights</li>
                <li>Infringement leads to account suspension and damages</li>
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
                <li>We may remove content without prior notice</li>
                <li>We may suspend accounts for violations</li>
                <li>Permanent bans for repeated or serious violations</li>
                <li>Outstanding payouts are reviewed on a case-by-case basis</li>
              </ul>
            </section>

            <section id="liability">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">16. Limitation of Liability</h2>
              <p className="text-base leading-relaxed text-foreground mb-2">To the extent permitted by law:</p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>We are not liable for the content or actions of other users</li>
                <li>No liability for lost profits or consequential damages</li>
                <li>Liability capped at the fees paid to us in the last 12 months</li>
                <li>In case of intent or gross negligence: unlimited</li>
              </ul>
            </section>

            <section id="indemnification">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">17. Indemnification</h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                You shall indemnify us against all third-party claims arising out of your use of
                the platform, including reasonable legal fees.
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
                Outstanding payment obligations survive termination.
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
                Exclusive place of jurisdiction is the Canton of Lucerne, Switzerland. We may also
                sue consumers at their place of residence.
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
                E-mail:{" "}
                <a href="mailto:management@dkaimarketplace.com" className="text-primary hover:underline">
                  management@dkaimarketplace.com
                </a>
              </p>
            </section>

            <div className="mt-12 pt-8 border-t border-border">
              <p className="text-base text-foreground mb-2">
                Questions? Email{" "}
                <a href="mailto:support@dkaimarketplace.com" className="text-primary hover:underline">
                  support@dkaimarketplace.com
                </a>
              </p>
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
