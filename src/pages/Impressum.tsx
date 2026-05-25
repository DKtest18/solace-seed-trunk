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

        <h1 className="font-display text-4xl font-semibold mb-2">Impressum</h1>
        <p className="text-muted-foreground mb-8">
          Verantwortlich fuer den Inhalt dieser Website.
        </p>

        {/* TODO: Replace placeholders with real data */}

        <section>
          <h2 className="font-display text-xl font-semibold mt-8 mb-3 text-foreground">
            Verantwortlich
          </h2>
          <div className="text-base leading-relaxed text-muted-foreground">
            <p>DK [LASTNAME]</p>
            <p>DK AI Marketplace</p>
            <p>[STREET]</p>
            <p>[POSTAL_CODE] [CITY]</p>
            <p>Schweiz</p>
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold mt-8 mb-3 text-foreground">
            Kontakt
          </h2>
          <div className="text-base leading-relaxed text-muted-foreground">
            <p>
              E-Mail:{" "}
              <a
                href="mailto:dari@dkaisystem.com"
                className="text-primary hover:underline"
              >
                dari@dkaisystem.com
              </a>
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold mt-8 mb-3 text-foreground">
            Steuerliche Daten
          </h2>
          <div className="text-base leading-relaxed text-muted-foreground">
            <p>Im Aufbau, Anmeldung beim Handelsregister geplant</p>
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold mt-8 mb-3 text-foreground">
            Aufsichtsbehoerde Datenschutz
          </h2>
          <div className="text-base leading-relaxed text-muted-foreground">
            <p>Eidgenoessischer Datenschutz- und Oeffentlichkeitsbeauftragter (EDOEB)</p>
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

        <div className="mt-12 pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
