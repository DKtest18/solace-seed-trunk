import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Impressum() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto py-12 px-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link to="/"><ArrowLeft className="w-4 h-4 mr-2" />Back</Link>
        </Button>

        <h1 className="font-display text-4xl font-semibold mb-2">Legal Notice (Impressum)</h1>
        <p className="text-muted-foreground mb-8">
          Responsible for the content of this website.
        </p>

        <section>
          <h2 className="font-display text-xl font-semibold mt-8 mb-3 text-foreground">
            Operator
          </h2>
          <div className="text-base leading-relaxed text-muted-foreground">
            <p>Dari Kastrati</p>
            <p>DK AI Marketplace</p>
            <p>Udligenswilerstrasse 15</p>
            <p>6043 Adligenswil</p>
            <p>Switzerland</p>
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold mt-8 mb-3 text-foreground">
            Contact
          </h2>
          <div className="text-base leading-relaxed text-muted-foreground">
            <p>
              Business, legal and operator matters:{" "}
              <a
                href="mailto:management@dkaimarketplace.com"
                className="text-primary hover:underline"
              >
                management@dkaimarketplace.com
              </a>
            </p>
            <p>
              Support:{" "}
              <a
                href="mailto:support@dkaimarketplace.com"
                className="text-primary hover:underline"
              >
                support@dkaimarketplace.com
              </a>
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold mt-8 mb-3 text-foreground">
            Tax details
          </h2>
          <div className="text-base leading-relaxed text-muted-foreground">
            <p>Commercial register entry planned.</p>
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold mt-8 mb-3 text-foreground">
            Data protection supervisory authority
          </h2>
          <div className="text-base leading-relaxed text-muted-foreground">
            <p>Federal Data Protection and Information Commissioner (FDPIC)</p>
            <p>Feldeggweg 1, 3003 Bern</p>
            <p>
              Website:{" "}
              <a
                href="https://www.edoeb.admin.ch"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                edoeb.admin.ch
              </a>
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold mt-8 mb-3 text-foreground">
            Disclaimer
          </h2>
          <div className="text-base leading-relaxed text-muted-foreground">
            <p>
              The content of this website is provided with care but without any warranty of
              accuracy, completeness, or timeliness. Products offered on the marketplace are
              supplied by independent third-party sellers, who are solely responsible for them. To
              the maximum extent permitted by applicable law, DK AI Marketplace and Dari Kastrati
              accept no liability for the content of external links or for damage arising from the
              use of this website, except where such damage results from intent or gross negligence
              on our part.
            </p>
          </div>
        </section>

        <div className="mt-12 pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground">Last updated: 19.8.2026</p>
        </div>
      </div>
    </AppLayout>
  );
}
