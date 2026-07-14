import { AppLayout } from '@/components/AppLayout';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

export default function LicenseTerms() {
  return (
    <AppLayout>
      <div className="container mx-auto max-w-4xl py-8 px-4">
        <Button variant="ghost" asChild className="mb-4">
          <Link to="/legal"><ArrowLeft className="w-4 h-4 mr-2" />Back</Link>
        </Button>

        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 mb-6 flex items-start gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600" />
          <span>
            <strong>Not legal advice — subject to review by a Swiss lawyer.</strong> This page
            summarises DK AI Marketplace license tiers in plain language. Individual sellers may
            add their own product-specific terms in addition to (but not overriding) these.
          </span>
        </div>

        <h1 className="text-3xl font-bold mb-4">License Terms</h1>
        <p className="text-muted-foreground mb-8">
          Every product on DK AI Marketplace is sold under one of the license tiers below. The
          buyer chooses the tier at checkout, and the resulting order acts as the license
          reference. <strong>Resale of a product on DK AI Marketplace or on any other marketplace
          is never permitted, regardless of tier.</strong>
        </p>

        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Personal</h2>
            <ul className="list-disc pl-6 text-sm space-y-1 mt-2">
              <li>Use inside the buyer's own business.</li>
              <li>One deployment / one production environment.</li>
              <li>No resale, no redistribution, no client deployment.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold">Commercial</h2>
            <ul className="list-disc pl-6 text-sm space-y-1 mt-2">
              <li>Use across the buyer's own business.</li>
              <li>Multiple internal deployments permitted.</li>
              <li>No resale, no white-label, no deployment for third-party clients.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold">Agency / White-Label</h2>
            <ul className="list-disc pl-6 text-sm space-y-1 mt-2">
              <li>Deploy and rebrand the product for the buyer's OWN clients as an off-platform service.</li>
              <li>Modification and derivative works permitted for those client engagements.</li>
              <li>
                <strong>Explicitly forbidden:</strong> relisting or reselling the product itself
                on DK AI Marketplace or any other marketplace.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-semibold">Exclusive Buyout</h2>
            <ul className="list-disc pl-6 text-sm space-y-1 mt-2">
              <li>Full transfer of rights from the seller to the buyer.</li>
              <li>The product is permanently removed from the marketplace after transfer.</li>
              <li>
                Licenses issued to earlier buyers under lower tiers remain valid — the assignment
                is subject to those pre-existing licenses.
              </li>
              <li>See the IP Assignment Agreement generated at checkout for the exact rights transferred.</li>
            </ul>
          </div>
        </section>

        <section className="mt-10 space-y-3 text-sm">
          <h2 className="text-lg font-semibold">Seller warranties</h2>
          <p>
            By offering a product on any tier, the seller warrants that they own or control all
            rights they purport to grant, that the product does not infringe third-party
            intellectual property, and that sublicensing beyond the granted tier is not permitted.
          </p>

          <h2 className="text-lg font-semibold pt-3">Governing law &amp; jurisdiction</h2>
          <p>
            Swiss substantive law applies, excluding the CISG. Exclusive place of jurisdiction is
            Lucerne, Switzerland. For consumers, mandatory consumer-protection provisions and the
            courts of the consumer's country of habitual residence remain unaffected.
          </p>
        </section>
      </div>
    </AppLayout>
  );
}
