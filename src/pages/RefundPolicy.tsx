import { useEffect } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail } from "lucide-react";

const SUPPORT_EMAIL = "support@dkaimarketplace.com";

const sections = [
  {
    title: "1. Our role",
    body: (
      <p>
        DK AI Marketplace (Dari Kastrati, Einzelunternehmen, Lucerne, Switzerland) operates a
        marketplace connecting independent third-party sellers with buyers. Payments are processed
        by Stripe and PayPal and go directly to the seller. We act as an intermediary and support
        layer, not as the seller of the products.
      </p>
    ),
  },
  {
    title: "2. When you can request a refund",
    body: (
      <>
        <p>
          Refunds are reviewed by DK AI Marketplace support and may be granted where:
        </p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>the product was not delivered within the seller&apos;s stated delivery time, or</li>
          <li>the product is materially not as described on its listing.</li>
        </ul>
        <p className="mt-2">
          Requests must be made within 14 days of purchase via{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </>
    ),
  },
  {
    title: "3. Digital goods & right of withdrawal",
    body: (
      <p>
        Because products are digital and delivered immediately, buyers are asked at checkout to
        consent to immediate delivery and to acknowledge that the statutory 14-day right of
        withdrawal is waived once download or access begins. This does not affect the
        support-reviewed refund grounds in section 2.
      </p>
    ),
  },
  {
    title: "4. Exclusive Buyouts",
    body: (
      <p>
        An Exclusive Buyout transfers full rights and permanently removes the product from the
        marketplace. Once the source files have been delivered and receipt confirmed, an Exclusive
        Buyout is final and non-refundable, except where the seller fails to deliver the agreed
        files.
      </p>
    ),
  },
  {
    title: "5. How refunds are funded",
    body: (
      <p>
        Where a refund is approved, it is debited from the seller&apos;s payment balance (Stripe or
        PayPal). The seller bears the cost of approved refunds and chargebacks on their sales. DK AI
        Marketplace facilitates and processes the refund but does not itself sell the product.
      </p>
    ),
  },
  {
    title: "6. Seller response time",
    body: (
      <p>
        The seller has 48 hours to respond to a refund request or dispute with evidence of delivery.
        If the seller does not respond in time, the case is decided in the buyer&apos;s favor.
      </p>
    ),
  },
  {
    title: "7. Chargebacks",
    body: (
      <p>
        If a buyer opens a chargeback with their card issuer or PayPal instead of using this
        process, the disputed amount and any fees are recovered from the seller&apos;s balance.
        Sellers agree to indemnify DK AI Marketplace for chargebacks, refunds, and losses arising
        from their sales, to the extent permitted by law.
      </p>
    ),
  },
  {
    title: "8. Contact",
    body: (
      <p>
        All refund and dispute matters:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
          {SUPPORT_EMAIL}
        </a>
        . We aim to respond within 2 business days.
      </p>
    ),
  },
];

export default function RefundPolicy() {
  useEffect(() => {
    document.title = "Refund & Dispute Policy | DK AI Marketplace";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) {
      desc.setAttribute(
        "content",
        "Refund and dispute policy of DK AI Marketplace: refund grounds, 14-day window, exclusive buyouts, chargebacks and seller responsibilities."
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

        <h1 className="font-display text-4xl font-semibold mb-2">
          Refund &amp; Dispute Policy
        </h1>
        <p className="text-muted-foreground mb-6">
          How refunds and disputes are handled on DK AI Marketplace.
        </p>

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
      </div>
    </AppLayout>
  );
}
