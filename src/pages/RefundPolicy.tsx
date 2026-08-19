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
        DK AI Marketplace (Dari Kastrati, Einzelunternehmen, Adligenswil, Lucerne, Switzerland)
        operates a marketplace connecting independent third-party sellers with buyers. Payments are
        processed by Stripe and PayPal and go directly to the seller&apos;s connected payment
        account. We act as an intermediary and support layer, not as the seller of the products.
        Each purchase contract is between the buyer and the seller.
      </p>
    ),
  },
  {
    title: "2. When you can request a refund",
    body: (
      <>
        <p>
          Refunds are reviewed by DK AI Marketplace support and may be granted only where:
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
          . No refund is granted for change of mind, for missing requirements that were clearly
          stated in the listing, for features that were never advertised, or for problems caused by
          the buyer&apos;s own environment.
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
        withdrawal lapses once download or access begins. This does not affect the support-reviewed
        refund grounds in section 2, and mandatory consumer rights in the buyer&apos;s country of
        residence remain unaffected.
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
        Marketplace facilitates and processes the refund but does not itself sell the product and
        does not fund refunds from its own means.
      </p>
    ),
  },
  {
    title: "6. Seller response time",
    body: (
      <p>
        The seller has 48 hours to respond to a refund request or dispute with evidence of delivery.
        If the seller does not respond in time, the case is decided in the buyer&apos;s favour.
      </p>
    ),
  },
  {
    title: "7. Chargebacks",
    body: (
      <p>
        If a buyer opens a chargeback with their card issuer or PayPal instead of using this
        process, the disputed amount and any fees are recovered from the seller&apos;s balance.
        Sellers agree to indemnify DK AI Marketplace and Dari Kastrati for chargebacks, refunds, and
        losses arising from their sales, to the extent permitted by law.
      </p>
    ),
  },
  {
    title: "8. No compensation beyond refunds",
    body: (
      <p>
        To the maximum extent permitted by applicable law, refunds under this policy are the sole
        remedy available through the platform. DK AI Marketplace and Dari Kastrati do not pay
        compensation for indirect or consequential loss, loss of profit, loss of data, business
        interruption, or damage arising from platform downtime, technical faults, or unauthorized
        access to platform or third-party infrastructure, except where such damage results from our
        intent or gross negligence. Mandatory statutory rights remain unaffected.
      </p>
    ),
  },
  {
    title: "9. Contact",
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
