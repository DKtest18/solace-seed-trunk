import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShoppingBag } from "lucide-react";

export default function About() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto py-12 px-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link to="/"><ArrowLeft className="w-4 h-4 mr-2" />Back</Link>
        </Button>

        <h1 className="font-display text-4xl font-semibold mb-4">About DK AI Marketplace</h1>
        <p className="text-lg text-muted-foreground mb-8">
          The marketplace for AI builders and buyers worldwide.
        </p>

        <section className="space-y-6 text-base leading-relaxed text-foreground">
          <p>
            DK AI Marketplace is a marketplace where independent creators sell AI agents,
            automations, prompts, and digital tools directly to buyers worldwide. Our goal is
            simple: give AI builders a clean, honest place to publish their work, and give buyers a
            trusted way to discover and purchase practical AI products.
          </p>

          <p>
            The platform was founded by Dari Kastrati in Switzerland and is operated from
            Adligenswil (Canton of Lucerne). It is built to be compliant with the Swiss FADP
            (revDSG) and the EU GDPR from day one.
          </p>

          <h2 className="font-display text-2xl font-semibold mt-10 mb-2">
            How the money works
          </h2>
          <p>
            All payments are processed by our payment providers, Stripe and PayPal, and go directly
            to the seller's own connected payment account. The payment provider's standard
            processing fees apply and are borne by the seller. As a launch promotion, the first 20
            sales on the whole platform are 100% platform-fee-free for sellers. DK AI Marketplace is
            an intermediary: we are not the seller of the products and we do not hold seller funds.
          </p>
          <p>
            DK AI Marketplace does not guarantee any sales, revenue, traffic, or results for
            sellers, and does not guarantee the quality, fitness, or performance of any product for
            buyers.
          </p>

          <h2 className="font-display text-2xl font-semibold mt-10 mb-2">
            Contact
          </h2>
          <p>
            For general questions or support, email{" "}
            <a href="mailto:support@dkaimarketplace.com" className="text-primary hover:underline">
              support@dkaimarketplace.com
            </a>
            . For business, legal, or operator matters, email{" "}
            <a href="mailto:management@dkaimarketplace.com" className="text-primary hover:underline">
              management@dkaimarketplace.com
            </a>
            .
          </p>

          <div className="pt-6">
            <Button asChild variant="hero">
              <Link to="/marketplace">
                <ShoppingBag className="mr-2 h-5 w-5" />
                Browse the Marketplace
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
