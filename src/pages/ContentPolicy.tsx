import { useEffect } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail } from "lucide-react";

const SUPPORT_EMAIL = "support@dkaimarketplace.com";

const sections: { title: string; body: JSX.Element }[] = [
  {
    title: "1. Scope",
    body: (
      <p>
        This policy applies to all Sellers, all submitted products (regardless of delivery mode),
        all product media (screenshots, demo videos, preview files), and all written content in a
        listing (titles, descriptions, FAQs). It applies from the moment a product is created as a
        draft through to its removal or delisting.
      </p>
    ),
  },
  {
    title: "2. Permitted Product Categories",
    body: (
      <>
        <p>
          Sellers may list digital, AI-related products they have full legal rights to sell,
          including:
        </p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>AI agents and autonomous workflows</li>
          <li>Automations (n8n, Make, Zapier, and similar tools)</li>
          <li>Prompt packs and prompt systems</li>
          <li>Datasets the Seller is licensed to distribute</li>
          <li>Templates (documents, design files, code scaffolding)</li>
          <li>Digital tools, scripts, and SaaS starter kits</li>
          <li>Educational material and courses the Seller owns or is licensed to distribute</li>
          <li>Custom commissioned work, where the commissioning terms allow resale</li>
        </ul>
      </>
    ),
  },
  {
    title: "3. Prohibited Content",
    body: (
      <>
        <p>
          The categories below are illustrative, not exhaustive. The Platform may remove any product
          it reasonably determines to be harmful, unlawful, or damaging to marketplace trust, even if
          not explicitly listed here.
        </p>

        <h3 className="font-semibold text-foreground mt-4 mb-2">
          3.1 Illegal, malicious, or unauthorized-access content
        </h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Anything illegal under Swiss, EU, or U.S. law, or the law of the Buyer&apos;s or
            Seller&apos;s country of residence.
          </li>
          <li>
            Malware, viruses, ransomware, spyware, keyloggers, exploit kits, or any tool whose
            primary purpose is unauthorized system access, hacking, credential theft, or
            circumventing security or DRM protections.
          </li>
          <li>
            Tools built primarily to enable phishing, spam, fraud, fake reviews, engagement/click
            fraud, or bots that violate a third-party platform&apos;s terms of service.
          </li>
          <li>
            Tools that facilitate surveillance or stalking of individuals without their knowledge or
            consent.
          </li>
        </ul>

        <h3 className="font-semibold text-foreground mt-4 mb-2">
          3.2 Sexual and exploitative content
        </h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Pornographic, sexually explicit, or sexually suggestive content of any kind.</li>
          <li>
            Any content sexualizing minors, in any form. Zero tolerance — reported to the relevant
            authorities immediately upon detection, with no prior warning to the Seller.
          </li>
          <li>
            Non-consensual intimate content, or deepfakes depicting real, identifiable people in
            sexual, defamatory, or otherwise deceptive contexts.
          </li>
        </ul>

        <h3 className="font-semibold text-foreground mt-4 mb-2">
          3.3 Violence, hate, and dangerous content
        </h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Content promoting or glorifying violence, terrorism, or self-harm.</li>
          <li>
            Hate speech, or content that attacks, degrades, or discriminates against people on the
            basis of ethnicity, nationality, religion, gender, sexual orientation, disability, or
            similar protected traits.
          </li>
          <li>
            Instructions, code, or tools primarily designed to build weapons, explosives, or other
            dangerous goods.
          </li>
        </ul>

        <h3 className="font-semibold text-foreground mt-4 mb-2">
          3.4 Restricted goods and services
        </h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Gambling, betting, or games-of-chance products, and tools that primarily facilitate them.
          </li>
          <li>
            Products dedicated to the marketing, production, or trade of alcohol, tobacco, vaping
            products, or controlled substances.
          </li>
          <li>Adult-only vice services of any kind.</li>
        </ul>

        <h3 className="font-semibold text-foreground mt-4 mb-2">
          3.5 Intellectual property and deception
        </h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Counterfeit goods, pirated software, cracked or resold licenses, or anything infringing a
            third party&apos;s copyright, trademark, patent, or trade secret.
          </li>
          <li>
            Freely available open-source code or templates repackaged and sold as the Seller&apos;s
            own original work without disclosed, substantial modification or added value.
          </li>
          <li>
            Stolen data, leaked databases, or personal data the Seller has no lawful right to sell or
            distribute.
          </li>
          <li>
            Listings that misrepresent what the product does, what it includes, or what results a
            Buyer can expect — including fabricated reviews, fake benchmarks, or falsified demo
            material.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "4. AI Transparency Requirements",
    body: (
      <>
        <p>
          In line with the EU AI Act&apos;s transparency obligations and general consumer-protection
          principles, Sellers must:
        </p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>
            Clearly and accurately describe what the AI product does, its known limitations, and any
            material risks.
          </li>
          <li>
            Disclose, where the product generates content (text, image, audio, or video) for end
            users, that the output is AI-generated, to the extent required by applicable law.
          </li>
          <li>
            Never market a product with false claims of capability, accuracy, certification, or human
            authorship.
          </li>
          <li>
            Apply additional disclosures where the product falls into a high-risk category as defined
            by the EU AI Act.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "5. Working-Product Verification (Demo Requirement)",
    body: (
      <p>
        To deter listings of code the Seller does not actually own or has not actually built, every
        product must include a short screen-recorded demonstration (a link to an unlisted/shared
        recording, or an uploaded video file) showing the product genuinely functioning as described.
        Listings without a valid demo cannot be approved. A demo alone does not establish ownership
        or licensing rights — see Section 3.5 — but its absence is an independent ground for
        rejection.
      </p>
    ),
  },
  {
    title: "6. Review Process",
    body: (
      <p>
        Every product is reviewed by the Platform before publication and may be re-reviewed after
        modification. Submission does not guarantee approval. The Platform may approve, request
        changes, or reject a listing at its discretion, and may request temporary, confidential,
        logged, time-limited access to a product or a representative sample to verify compliance with
        this policy.
      </p>
    ),
  },
  {
    title: "7. Enforcement",
    body: (
      <>
        <p>
          Violations of this Content Policy may result in, depending on severity and history:
        </p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Rejection of the specific listing, with a note explaining what must change.</li>
          <li>Removal of an already-published listing.</li>
          <li>A formal warning recorded on the Seller&apos;s account.</li>
          <li>Temporary suspension of the Seller&apos;s ability to publish new listings.</li>
          <li>Permanent removal of the Seller&apos;s account.</li>
          <li>
            Withholding of payouts for orders directly connected to the violation, to the extent
            legally permitted.
          </li>
          <li>
            Reporting to law enforcement or other competent authorities where legally required or, in
            the Platform&apos;s judgment, appropriate — in particular for content described in
            Section 3.2.
          </li>
        </ul>
        <p className="mt-4">
          Platform operators may access account records — including account names, email addresses,
          sign-up and sign-in dates, and product counts — for operational, security, and review
          purposes. Accounts may be suspended or deleted where a documented reason exists.
        </p>
      </>
    ),
  },
  {
    title: "8. Reporting a Violation",
    body: (
      <p>
        Buyers, Sellers, or any third party may report a suspected violation of this policy to{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
          {SUPPORT_EMAIL}
        </a>
        . Reports are reviewed on a best-effort basis; the Platform does not guarantee a specific
        response time outside of its standard support commitments.
      </p>
    ),
  },
  {
    title: "9. Appeals",
    body: (
      <p>
        A Seller whose listing is rejected or removed for a Content Policy violation may request a
        review by replying to the rejection notice or writing to{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
          {SUPPORT_EMAIL}
        </a>{" "}
        with supporting evidence. The Platform&apos;s decision following an appeal is final.
      </p>
    ),
  },
  {
    title: "10. Changes to This Policy",
    body: (
      <p>
        The Platform may update this Content Policy from time to time. Continued listing or selling of
        products after an update takes effect constitutes acceptance of the revised policy. Material
        changes will be reflected in the version number and effective date at the top of this
        document.
      </p>
    ),
  },
  {
    title: "11. Governing Law",
    body: (
      <p>
        This Content Policy is governed by Swiss law and forms part of the Platform&apos;s Terms of
        Service, subject to mandatory consumer-protection provisions that may apply in a Buyer&apos;s
        country of residence. Place of jurisdiction is the Platform operator&apos;s registered seat in
        Switzerland.
      </p>
    ),
  },
];

export default function ContentPolicy() {
  useEffect(() => {
    document.title = "Content Policy | DK AI Marketplace";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) {
      desc.setAttribute(
        "content",
        "Content Policy of DK AI Marketplace: permitted product categories, prohibited content, AI transparency rules, demo requirement, review and enforcement."
      );
    }
  }, []);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto py-12 px-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link to="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>

        <h1 className="font-display text-4xl font-semibold mb-2">Content Policy</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Version 1 · Effective 15.08.2026 · Subject to review by legal counsel
        </p>

        <div className="text-base leading-relaxed text-muted-foreground space-y-3 mb-6">
          <p>
            This Content Policy applies to every product, listing, description, image, video, and
            file submitted to DK AI Marketplace (&quot;the Platform&quot;, operated by Dari Kastrati,
            an Einzelunternehmen based in Adligenswil, Lucerne, Switzerland). It sits alongside the
            Platform&apos;s Seller Agreement, Seller Rules &amp; Obligations, and Terms of Service.
            Where this Content Policy and Section 3 (&quot;Prohibited Products &amp; Content&quot;) of
            the Seller Rules &amp; Obligations document overlap, the more specific or more restrictive
            provision governs; the Platform intends to consolidate its legal documents into a single
            canonical source over time.
          </p>
        </div>

        <Button asChild size="lg" className="mb-8">
          <a href={`mailto:${SUPPORT_EMAIL}`}>
            <Mail className="w-4 h-4 mr-2" />
            Contact Support
          </a>
        </Button>

        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="font-display text-xl font-semibold mt-8 mb-3 text-foreground">
              {s.title}
            </h2>
            <div className="text-base leading-relaxed text-muted-foreground">{s.body}</div>
          </section>
        ))}

        <p className="mt-10 pt-6 border-t text-sm italic text-muted-foreground">
          This document is provided as a working draft and is marked subject to review by qualified
          legal counsel before it is treated as final. Contact:{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline not-italic">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </AppLayout>
  );
}
