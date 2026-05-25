import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export default function CookiePolicy() {
  const today = new Date().toLocaleDateString();
  return (
    <main className="max-w-3xl mx-auto py-12 px-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-4xl font-semibold">Cookie-Richtlinie / Cookie Policy</h1>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>
      <p className="text-muted-foreground mb-8">Last updated: {today}</p>

      <article className="space-y-8 text-foreground leading-relaxed">
        <section>
          <h2 className="text-2xl font-semibold mb-2">1. Was sind Cookies?</h2>
          <p className="text-muted-foreground">
            Cookies sind kleine Textdateien, die auf Ihrem Geraet gespeichert werden, wenn Sie eine Website besuchen.
            Sie ermoeglichen es uns, Ihr Geraet wiederzuerkennen und Ihre Erfahrung zu verbessern.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2">2. Welche Cookies wir verwenden</h2>

          <h3 className="font-semibold mt-4 mb-1">A) Streng notwendige Cookies (keine Einwilligung erforderlich)</h3>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li><code>supabase-auth-token</code> – Authentifizierung (Session, 1 Jahr)</li>
            <li><code>supabase-auth-refresh</code> – Token-Aktualisierung (1 Jahr)</li>
            <li><code>csrf-token</code> – Sicherheit gegen CSRF (Session)</li>
          </ul>

          <h3 className="font-semibold mt-4 mb-1">B) Funktionale Cookies (Einwilligung erforderlich)</h3>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li><code>language-preference</code> – Sprache (12 Monate)</li>
            <li><code>theme-preference</code> – Light/Dark Mode (12 Monate)</li>
            <li><code>cookie-consent-preferences</code> – Ihre Cookie-Wahl (24 Monate)</li>
          </ul>

          <h3 className="font-semibold mt-4 mb-1">C) Analytische Cookies (Einwilligung erforderlich)</h3>
          <p className="text-muted-foreground">Aktuell keine Analytics-Cookies aktiv.</p>

          <h3 className="font-semibold mt-4 mb-1">D) Marketing-Cookies (Einwilligung erforderlich)</h3>
          <p className="text-muted-foreground">Aktuell keine Marketing-Cookies aktiv.</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2">3. Dritt-Cookies / Third-Party Cookies</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-1">
            <li>
              Stripe Payment: stripe.com setzt eigene Cookies waehrend des Checkouts (
              <a href="https://stripe.com/cookies-policy" target="_blank" rel="noreferrer" className="text-primary underline">
                stripe.com/cookies-policy
              </a>
              )
            </li>
            <li>KEINE Google Analytics, KEIN Facebook Pixel, KEINE Werbe-Tracker</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2">4. Ihre Einwilligung</h2>
          <p className="text-muted-foreground">
            Beim ersten Besuch erscheint ein Cookie-Banner. Sie koennen alle akzeptieren, nur notwendige akzeptieren,
            einzeln auswaehlen oder jederzeit aendern unter{" "}
            <Link to="/cookie-settings" className="text-primary underline">
              /cookie-settings
            </Link>.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2">5. Cookies blockieren</h2>
          <p className="text-muted-foreground">
            Sie koennen Cookies in Ihren Browser-Einstellungen blockieren. Konsequenzen: einige Funktionen (Login, Kaeufe) werden nicht funktionieren.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2">6. Speicherdauer</h2>
          <p className="text-muted-foreground">Maximum 24 Monate. Sessions enden mit Browser-Schliessung.</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-2">7. Aenderungen</h2>
          <p className="text-muted-foreground">
            Diese Richtlinie kann angepasst werden. Bei wesentlichen Aenderungen erscheint das Cookie-Banner erneut.
          </p>
        </section>

        <p className="text-sm text-muted-foreground pt-8 border-t border-border">
          Questions? Email{" "}
          <a href="mailto:dari@dkaisystem.com" className="text-primary underline">
            dari@dkaisystem.com
          </a>{" "}
          – Read also:{" "}
          <Link to="/privacy" className="text-primary underline">
            Privacy Policy
          </Link>
        </p>
      </article>
    </main>
  );
}
