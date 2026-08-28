import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Link } from "react-router-dom";
import { LegalBindingNotice } from '@/components/legal/LegalBindingNotice';

const LAST_UPDATED = "19.8.2026";

const sections = [
  { id: "controller", title: "1. Controller" },
  { id: "scope", title: "2. Scope" },
  { id: "legal-basis", title: "3. Legal Basis" },
  { id: "data", title: "4. Data We Collect" },
  { id: "purposes", title: "5. Purposes" },
  { id: "recipients", title: "6. Recipients / Processors" },
  { id: "international", title: "7. International Transfers" },
  { id: "retention", title: "8. Retention" },
  { id: "rights", title: "9. Your Rights" },
  { id: "complaint", title: "10. Right to Complain" },
  { id: "automated", title: "11. Automated Decision-Making" },
  { id: "ai", title: "12. AI Product Transparency" },
  { id: "security", title: "13. Security" },
  { id: "breaches", title: "14. Data Breaches" },
  { id: "changes", title: "15. Changes" },
  { id: "contact", title: "16. Contact for Privacy Matters" },
];

const Privacy = () => {
  const [tocOpen, setTocOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto py-12 px-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link to="/"><ArrowLeft className="w-4 h-4 mr-2" />Back</Link>
        </Button>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-8">
          <article className="max-w-3xl">
            <h1 className="font-display text-4xl font-semibold mb-2">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground mb-2">Last updated: {LAST_UPDATED}</p>
            <p className="text-sm text-muted-foreground mb-6">Reading time: ~12 minutes</p>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="mb-8 print:hidden"
            >
              <Printer className="h-4 w-4 mr-2" /> Print this page
            </Button>

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

            <section id="controller">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">1. Controller</h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                DK AI Marketplace<br />
                Dari Kastrati<br />
                Udligenswilerstrasse 15, 6043 Adligenswil, Switzerland<br />
                E-mail:{" "}
                <a href="mailto:support@dkaimarketplace.com" className="text-primary hover:underline">
                  support@dkaimarketplace.com
                </a>
              </p>
            </section>

            <section id="scope">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">2. Scope</h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                This privacy policy applies to all processing of personal data by DK AI Marketplace
                through dkaimarketplace.com and connected services.
              </p>
            </section>

            <section id="legal-basis">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">3. Legal Basis</h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                We process your data on the following legal bases:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Performance of a contract (Art. 31(2)(a) revFADP, Art. 6(1)(b) GDPR)</li>
                <li>Legal obligation (Art. 31(1) revFADP, Art. 6(1)(c) GDPR)</li>
                <li>Legitimate interest (Art. 31(2)(b) revFADP, Art. 6(1)(f) GDPR)</li>
                <li>Consent (Art. 31(1) revFADP, Art. 6(1)(a) GDPR)</li>
              </ul>
            </section>

            <section id="data">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">4. Data We Collect</h2>

              <h3 className="font-display text-lg font-semibold mt-6 mb-2">Account data</h3>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>E-mail address</li>
                <li>Password (stored hashed via bcrypt through Supabase)</li>
                <li>First and last name (optional)</li>
                <li>Profile picture (optional)</li>
              </ul>

              <h3 className="font-display text-lg font-semibold mt-6 mb-2">Seller profile data</h3>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Biography, skills, specialities</li>
                <li>Stripe Connect account ID (for Stripe payouts)</li>
                <li>PayPal merchant ID and onboarding status (for PayPal payouts)</li>
                <li>Ratings and reviews</li>
              </ul>

              <h3 className="font-display text-lg font-semibold mt-6 mb-2">Product review data</h3>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>
                  Demo videos and review material submitted with products, stored including in
                  archived form after review to document how a listing was assessed
                </li>
              </ul>

              <h3 className="font-display text-lg font-semibold mt-6 mb-2">Transaction data</h3>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Purchase / sales history</li>
                <li>Orders, status, amounts</li>
                <li>Communication between buyers and sellers</li>
              </ul>

              <h3 className="font-display text-lg font-semibold mt-6 mb-2">
                Setup handover data (where a product requires it)
              </h3>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>
                  Credentials the buyer submits for product setup (e.g. API keys), encrypted
                  (AES-256-GCM); decryption is possible only server-side, access is logged, entries
                  are deleted after the access window or on completion of handover. These values are
                  accessible only to the seller of the product and the submitting buyer, not to the
                  platform operator.
                </li>
              </ul>

              <h3 className="font-display text-lg font-semibold mt-6 mb-2">Payment data</h3>
              <div className="bg-muted/50 border-l-4 border-primary p-4 my-4">
                <ul className="list-disc list-inside ml-4 space-y-2">
                  <li>Processed exclusively by Stripe and PayPal</li>
                  <li>We do NOT store card details or full bank details</li>
                  <li>
                    We see only the last 4 digits (where provided by the processor) for accounting
                    purposes
                  </li>
                </ul>
              </div>

              <h3 className="font-display text-lg font-semibold mt-6 mb-2">Technical data</h3>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>IP address (truncated after 30 days)</li>
                <li>Browser type, operating system</li>
                <li>Pages visited, timestamps</li>
                <li>Cookies (see Cookie Policy)</li>
              </ul>

              <h3 className="font-display text-lg font-semibold mt-6 mb-2">Two-factor authentication data (when enabled)</h3>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>TOTP secret (managed by Supabase Auth, encrypted)</li>
                <li>Recovery codes (stored as salted hashes only, single use)</li>
              </ul>
            </section>

            <section id="purposes">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">5. Purposes</h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Providing the marketplace service</li>
                <li>Payment processing via Stripe and PayPal</li>
                <li>Sending transactional e-mails</li>
                <li>Product review before publication</li>
                <li>Protection against fraud and abuse</li>
                <li>Compliance with legal retention obligations</li>
                <li>Service improvement (in aggregated / anonymised form)</li>
                <li>Direct communication on the platform</li>
              </ul>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Platform operators may access account records (account names, e-mail addresses,
                sign-up and sign-in dates, product counts) for operational, security, and review
                purposes. Accounts may be suspended or deleted where a documented reason exists.
              </p>
            </section>

            <section id="recipients">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">6. Recipients / Processors</h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                We use the following external service providers:
              </p>

              <h3 className="font-display text-lg font-semibold mt-6 mb-2">a) Supabase Inc.</h3>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Purpose: database, authentication, file storage<br />
                Location: EU (Frankfurt) / US<br />
                DPA:{" "}
                <a href="https://supabase.com/legal/dpa" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  supabase.com/legal/dpa
                </a>
                <br />
                Data categories: account, profile, transactions, product files, review material
              </p>

              <h3 className="font-display text-lg font-semibold mt-6 mb-2">b) Stripe Payments Europe Ltd.</h3>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Purpose: payment processing, Connect payouts<br />
                Location: Ireland (EU), USA<br />
                Privacy:{" "}
                <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  stripe.com/privacy
                </a>
                <br />
                Data categories: payment, transaction, identity
              </p>

              <h3 className="font-display text-lg font-semibold mt-6 mb-2">
                c) PayPal (Europe) S.à r.l. et Cie, S.C.A.
              </h3>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Purpose: payment processing, seller payouts<br />
                Location: Luxembourg (EU), USA<br />
                Privacy: paypal.com/privacy<br />
                Data categories: payment, transaction, identity
              </p>

              <h3 className="font-display text-lg font-semibold mt-6 mb-2">d) Resend (e-mail service)</h3>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Purpose: sending transactional e-mails<br />
                Location: USA<br />
                Data categories: e-mail, name, sending metadata
              </p>
            </section>

            <section id="international">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">7. International Transfers</h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Some of our processors handle data in the USA. The following safeguards apply:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>EU-US Data Privacy Framework (DPF)</li>
                <li>EU Standard Contractual Clauses (SCC)</li>
                <li>Swiss recognition of the DPF by the FDPIC</li>
              </ul>
            </section>

            <section id="retention">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">8. Retention</h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Account data: until account deletion + 30-day grace period</li>
                <li>Transaction data: 10 years (Swiss accounting, CO Art. 958f)</li>
                <li>
                  Setup handover credentials: until the access window expires or handover completes,
                  then deleted
                </li>
                <li>
                  Demo videos and review material: for the life of the listing and in archived form
                  thereafter, to document the review
                </li>
                <li>Server logs: 90 days</li>
                <li>E-mail logs: 12 months</li>
                <li>Cookies: see Cookie Policy (max. 24 months)</li>
                <li>Reviews: permanent (anonymised after account deletion)</li>
              </ul>
            </section>

            <section id="rights">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">9. Your Rights</h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Under revFADP and GDPR you have the following rights:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Access (Art. 25 revFADP, Art. 15 GDPR)</li>
                <li>Rectification (Art. 32(1) revFADP, Art. 16 GDPR)</li>
                <li>Erasure (Art. 32(2)(c) revFADP, Art. 17 GDPR)</li>
                <li>Restriction (Art. 18 GDPR)</li>
                <li>Data portability (Art. 28 revFADP, Art. 20 GDPR)</li>
                <li>Objection (Art. 30 revFADP, Art. 21 GDPR)</li>
                <li>Withdrawal of consent (at any time)</li>
              </ul>
              <div className="bg-muted/50 border-l-4 border-primary p-4 my-4">
                <p className="text-base leading-relaxed text-foreground mb-2 font-semibold">
                  How to exercise your rights:
                </p>
                <ul className="list-disc list-inside ml-4 space-y-2">
                  <li>
                    E-mail:{" "}
                    <a href="mailto:support@dkaimarketplace.com" className="text-primary hover:underline">
                      support@dkaimarketplace.com
                    </a>{" "}
                    (subject: <span className="font-mono text-sm">Data protection request</span>)
                  </li>
                  <li>Self-service: Settings, Privacy</li>
                  <li>Response time: within 30 days</li>
                </ul>
              </div>
            </section>

            <section id="complaint">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">10. Right to Complain</h2>
              <h3 className="font-display text-lg font-semibold mt-6 mb-2">Switzerland</h3>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Federal Data Protection and Information Commissioner (FDPIC)<br />
                Feldeggweg 1, 3003 Bern,{" "}
                <a href="https://edoeb.admin.ch" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  edoeb.admin.ch
                </a>
              </p>
              <h3 className="font-display text-lg font-semibold mt-6 mb-2">EU</h3>
              <p className="text-base leading-relaxed text-foreground mb-4">
                The data protection authority of your country of residence.
              </p>
            </section>

            <section id="automated">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">11. Automated Decision-Making</h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                We do not make any fully automated decisions with legal effect (Art. 22 GDPR).
              </p>
            </section>

            <section id="ai">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">12. AI Product Transparency</h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                AI products are sold on our platform. Buyers are clearly informed when a product is
                AI-based. Sellers are required to describe how their products work transparently
                (EU AI Act).
              </p>
            </section>

            <section id="security">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">13. Security</h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                We apply technical and organisational measures:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>TLS encryption</li>
                <li>Database encryption at Supabase</li>
                <li>Two-factor authentication available for every account</li>
                <li>
                  Buyer setup credentials encrypted with AES-256-GCM, server-side decryption only,
                  access logged, automatic deletion
                </li>
                <li>Passwords hashed via bcrypt</li>
                <li>Row-level security on database access</li>
                <li>Stripe and PayPal certified payment processing (PCI DSS)</li>
              </ul>
              <p className="text-base leading-relaxed text-foreground mb-4">
                No security measure is absolute. To the maximum extent permitted by applicable law,
                DK AI Marketplace and Dari Kastrati are not liable for damage caused by unauthorized
                access to, or failure of, platform or third-party infrastructure, except where it
                results from our intent or gross negligence. Our statutory duties in the event of a
                data breach (section 14) remain unaffected.
              </p>
            </section>

            <section id="breaches">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">14. Data Breaches</h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                In the event of a data breach we notify:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>The competent supervisory authority as required by law</li>
                <li>
                  Affected users without undue delay when there is a high risk (Art. 24 revFADP,
                  Art. 34 GDPR)
                </li>
              </ul>
            </section>

            <section id="changes">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">15. Changes</h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                We may update this privacy policy. Material changes are announced 30 days in advance
                by e-mail. The current version is always available at{" "}
                <span className="font-mono text-sm">/privacy</span>.
              </p>
            </section>

            <section id="contact">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">16. Contact for Privacy Matters</h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                E-mail:{" "}
                <a href="mailto:support@dkaimarketplace.com" className="text-primary hover:underline">
                  support@dkaimarketplace.com
                </a>
                <br />
                Subject: <span className="font-mono text-sm">Data protection request</span>
              </p>
              <p className="text-base leading-relaxed text-foreground mb-4">
                We are not required to appoint a Data Protection Officer (DPO).
              </p>
            </section>

            <div className="mt-12 bg-muted/50 border-l-4 border-primary p-4 rounded-md">
              <p className="text-base leading-relaxed text-foreground">
                Have privacy questions? Email{" "}
                <a href="mailto:support@dkaimarketplace.com" className="text-primary hover:underline">
                  support@dkaimarketplace.com
                </a>
              </p>
            </div>

            <p className="text-xs text-muted-foreground mt-8">Last updated: {LAST_UPDATED}</p>
          </article>

          <aside className="hidden lg:block print:hidden">
            <nav className="sticky top-24">
              <p className="font-display text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                Contents
              </p>
              <ul className="space-y-2 text-sm">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="text-muted-foreground hover:text-primary transition-colors">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        </div>
        <LegalBindingNotice />
      </div>
    </div>
  );
};

export default Privacy;
