import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Link } from "react-router-dom";

const LAST_UPDATED = "25. Mai 2026";

const sections = [
  { id: "scope", title: "1. Geltungsbereich / Scope" },
  { id: "definitions", title: "2. Definitionen" },
  { id: "eligibility", title: "3. Nutzungsvoraussetzungen / Eligibility" },
  { id: "account", title: "4. Konto-Registrierung / Account" },
  { id: "role", title: "5. Rolle der Plattform / Our Role" },
  { id: "seller-obligations", title: "6. Pflichten Verkaeufer / Seller Obligations" },
  { id: "buyer-obligations", title: "7. Pflichten Kaeufer / Buyer Obligations" },
  { id: "payments", title: "8. Zahlungsabwicklung / Payments" },
  { id: "platform-fee", title: "9. Plattformgebuehr / Platform Fee" },
  { id: "custom-orders", title: "10. Custom Commission Orders" },
  { id: "refunds", title: "11. Rueckerstattung / Refunds" },
  { id: "disputes", title: "12. Streitbeilegung / Disputes" },
  { id: "ip", title: "13. Geistiges Eigentum / IP" },
  { id: "prohibited", title: "14. Verbotene Inhalte / Prohibited Content" },
  { id: "moderation", title: "15. Content-Moderation" },
  { id: "liability", title: "16. Haftungsbeschraenkung / Liability" },
  { id: "indemnification", title: "17. Freistellung / Indemnification" },
  { id: "changes", title: "18. Aenderungen der AGB / Changes" },
  { id: "termination", title: "19. Kuendigung / Termination" },
  { id: "governing-law", title: "20. Anwendbares Recht / Governing Law" },
  { id: "jurisdiction", title: "21. Gerichtsstand / Jurisdiction" },
  { id: "severability", title: "22. Salvatorische Klausel / Severability" },
  { id: "odr", title: "23. Online-Streitbeilegung / ODR" },
  { id: "contact", title: "24. Kontakt / Contact" },
];

export default function TermsOfService() {
  const [tocOpen, setTocOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto py-12 px-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-8">
          <article className="max-w-3xl">
            <h1 className="font-display text-4xl font-semibold mb-2">
              Terms of Service
            </h1>
            <p className="font-display text-xl text-muted-foreground mb-2">
              Allgemeine Geschaeftsbedingungen (AGB)
            </p>
            <p className="text-sm text-muted-foreground mb-2">
              Stand / Last updated: {LAST_UPDATED}
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Reading time: ~15 minutes
            </p>

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
                By signing up, you agree to them. The most important: we charge 5% on transactions,
                sellers keep 95%, Swiss law applies, and we are a marketplace (not a party to your
                transactions). Full details below.
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

            {/* Section 1 */}
            <section id="scope">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                1. Geltungsbereich / Scope
              </h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Diese Allgemeinen Geschaeftsbedingungen (AGB) regeln die Nutzung des DK AI Marketplace
                (&quot;Plattform&quot;), betrieben von DK [Nachname], [Adresse], Schweiz
                (&quot;Betreiberin&quot;, &quot;wir&quot;). Mit der Registrierung akzeptieren Sie diese AGB.
              </p>
              <p className="text-base leading-relaxed text-foreground mb-4">
                These Terms of Service govern the use of the DK AI Marketplace (&quot;Platform&quot;),
                operated by DK [Lastname], [Address], Switzerland (&quot;Operator&quot;, &quot;we&quot;).
                By registering, you accept these terms.
              </p>
            </section>

            {/* Section 2 */}
            <section id="definitions">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                2. Definitionen
              </h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li><strong>&quot;Plattform&quot;</strong> = dkaimarketplace.com inkl. aller Services</li>
                <li><strong>&quot;Nutzer&quot;</strong> = jede natuerliche oder juristische Person mit Konto</li>
                <li><strong>&quot;Kaeufer&quot;</strong> = Nutzer, der Produkte erwirbt</li>
                <li><strong>&quot;Verkaeufer&quot;</strong> = Nutzer, der Produkte anbietet</li>
                <li><strong>&quot;Produkt&quot;</strong> = digitale AI-Produkte, Agenten, Templates, Workflows</li>
                <li><strong>&quot;Dienstleistung&quot;</strong> = Custom Commission Orders, Expert Calls</li>
                <li><strong>&quot;Transaktion&quot;</strong> = abgeschlossener Kauf</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section id="eligibility">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                3. Nutzungsvoraussetzungen / Eligibility
              </h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Mindestalter: 18 Jahre oder gesetzliches Mindestalter</li>
                <li>Wahrheitsgemaesse Angaben bei Registrierung</li>
                <li>Pro Person nur ein Konto</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section id="account">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                4. Konto-Registrierung / Account
              </h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>E-Mail-Adresse und sicheres Passwort</li>
                <li>Sie sind verantwortlich fuer Zugangsdaten</li>
                <li>Bei Verdacht auf Missbrauch sofort Mitteilung</li>
                <li>Wir koennen Konten ablehnen oder schliessen</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section id="role">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                5. Rolle der Plattform / Our Role
              </h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Wir sind eine <strong>Vermittlungsplattform</strong>. Wir sind NICHT Vertragspartner fuer
                Kaeufe zwischen Nutzern.
              </p>
              <p className="text-base leading-relaxed text-foreground mb-2 font-semibold">Wir leisten:</p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Bereitstellung der Plattform</li>
                <li>Zahlungsabwicklung ueber Stripe Connect</li>
                <li>Streitbeilegungssystem</li>
                <li>Content-Moderation</li>
              </ul>
              <p className="text-base leading-relaxed text-foreground mb-2 font-semibold">Wir leisten NICHT:</p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Qualitaetsgarantie fuer angebotene Produkte</li>
                <li>Haftung fuer Inhalte von Verkaeufern</li>
                <li>Garantie fuer Verfuegbarkeit</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section id="seller-obligations">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                6. Pflichten Verkaeufer / Seller Obligations
              </h2>
              <p className="text-base leading-relaxed text-foreground mb-2">
                Verkaeufer verpflichten sich:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Eigenes Stripe-Connect-Konto einzurichten</li>
                <li>Produkte wahrheitsgemaess zu beschreiben</li>
                <li>Lieferungen innerhalb Frist auszufuehren</li>
                <li>Auf Nachrichten innert 72h zu reagieren</li>
                <li>Nur Produkte anzubieten mit erforderlichen Rechten</li>
                <li>Gesetzliche Vorschriften einzuhalten (Steuern, etc.)</li>
                <li>EU AI Act-Transparenz fuer AI-Produkte</li>
              </ul>
            </section>

            {/* Section 7 */}
            <section id="buyer-obligations">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                7. Pflichten Kaeufer / Buyer Obligations
              </h2>
              <p className="text-base leading-relaxed text-foreground mb-2">
                Kaeufer verpflichten sich:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Wahrheitsgemaesse Angaben zu machen</li>
                <li>Eignung von Produkten selbst zu pruefen</li>
                <li>Zahlungen vollstaendig und puenktlich</li>
                <li>Custom Order Specs klar zu kommunizieren</li>
              </ul>
            </section>

            {/* Section 8 */}
            <section id="payments">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                8. Zahlungsabwicklung / Payments
              </h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Alle Zahlungen ueber Stripe</li>
                <li>Wir speichern keine Kreditkartendaten</li>
                <li>Zahlungen bei Kauf sofort, bei Custom Orders nach Akzeptanz</li>
                <li>Auszahlungen an Verkaeufer automatisch via Stripe Connect</li>
              </ul>
            </section>

            {/* Section 9 */}
            <section id="platform-fee">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                9. Plattformgebuehr / Platform Fee
              </h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>5% Plattformgebuehr auf jede Transaktion</li>
                <li>Verkaeufer erhaelt 95%</li>
                <li>Founding Sellers (erste 10) behalten 95% lebenslang</li>
                <li>Stripe-Gebuehren separat (~1.5% + EUR 0.25)</li>
              </ul>
            </section>

            {/* Section 10 */}
            <section id="custom-orders">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                10. Custom Commission Orders
              </h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Kaeufer beschreibt Anforderungen, schlaegt Preis vor</li>
                <li>Verkaeufer akzeptiert/lehnt innert 7 Tagen ab</li>
                <li>Bei Akzeptanz: Zahlung wird belastet, Geld treuhaenderisch</li>
                <li>Verkaeufer liefert gemaess Vereinbarung</li>
                <li>Kaeufer bestaetigt oder eroeffnet Streitfall</li>
                <li>Auszahlung nach Bestaetigung oder Ablauf 7 Tage</li>
              </ul>
            </section>

            {/* Section 11 */}
            <section id="refunds">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                11. Rueckerstattung / Refunds
              </h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Da digitale Produkte sofort bereitgestellt werden, gilt kein Widerrufsrecht
                (Art. 16 lit. m Verbraucher-RL). Kaeufer bestaetigen dies bei Kauf.
              </p>
              <p className="text-base leading-relaxed text-foreground mb-2 font-semibold">Ausnahmen:</p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Produkt entspricht nicht Beschreibung -&gt; Rueckerstattung</li>
                <li>Verkaeufer liefert nicht -&gt; automatische Rueckerstattung nach 14 Tagen</li>
                <li>Berechtigte Beanstandung im Streitsystem</li>
              </ul>
            </section>

            {/* Section 12 */}
            <section id="disputes">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                12. Streitbeilegung / Disputes
              </h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Streitfaelle zuerst zwischen Kaeufer und Verkaeufer</li>
                <li>Bei Nichteinigung: Schiedsstelle der Plattform</li>
                <li>Entscheidungen verbindlich fuer Plattform-Auszahlung</li>
                <li>Anrufung ordentlicher Gerichte bleibt vorbehalten</li>
              </ul>
            </section>

            {/* Section 13 */}
            <section id="ip">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                13. Geistiges Eigentum / IP
              </h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Sie behalten alle Rechte an Ihren Inhalten</li>
                <li>Sie gewaehren uns nicht-exklusive Lizenz zur Anzeige</li>
                <li>Sie versichern, alle noetigen Rechte zu haben</li>
                <li>Verletzung fuehrt zu Account-Sperrung und Schadenersatz</li>
              </ul>
            </section>

            {/* Section 14 */}
            <section id="prohibited">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                14. Verbotene Inhalte / Prohibited Content
              </h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Illegale Produkte oder Dienstleistungen</li>
                <li>AI-Produkte ohne Transparenz (EU AI Act-Verstoss)</li>
                <li>Malware, Viren, Schadcode</li>
                <li>Urheberrechtsverletzungen</li>
                <li>Hassrede, Diskriminierung, Belaestigung</li>
                <li>Pornografie, Gewaltverherrlichung</li>
                <li>Personen-ID-Daten Dritter ohne Zustimmung</li>
                <li>Spam, Massenkommunikation</li>
              </ul>
            </section>

            {/* Section 15 */}
            <section id="moderation">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                15. Content-Moderation
              </h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Wir koennen Inhalte ohne Vorankuendigung entfernen</li>
                <li>Accounts sperren bei Verstoessen</li>
                <li>Permanente Sperrung bei wiederholten/schweren Verstoessen</li>
                <li>Auszahlung ausstehender Betraege im Einzelfall geprueft</li>
              </ul>
            </section>

            {/* Section 16 */}
            <section id="liability">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                16. Haftungsbeschraenkung / Limitation of Liability
              </h2>
              <p className="text-base leading-relaxed text-foreground mb-2">
                Im gesetzlich zulaessigen Rahmen:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Wir haften nicht fuer Inhalte oder Handlungen anderer</li>
                <li>Nicht fuer entgangenen Gewinn oder Folgeschaeden</li>
                <li>Haftung beschraenkt auf in 12 Monaten gezahlte Gebuehren</li>
                <li>Bei Vorsatz/grober Fahrlaessigkeit: unbeschraenkt</li>
              </ul>
            </section>

            {/* Section 17 */}
            <section id="indemnification">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                17. Freistellung / Indemnification
              </h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Sie stellen uns frei von allen Anspruechen Dritter, die aus Ihrer Nutzung der
                Plattform resultieren, einschliesslich angemessener Anwaltskosten.
              </p>
            </section>

            {/* Section 18 */}
            <section id="changes">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                18. Aenderungen der AGB / Changes
              </h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Wir koennen diese AGB anpassen</li>
                <li>Wesentliche Aenderungen 30 Tage im Voraus per E-Mail</li>
                <li>Bei Widerspruch innert 30 Tagen: Konto wird gekuendigt</li>
                <li>Ohne Widerspruch: neue AGB gelten</li>
              </ul>
            </section>

            {/* Section 19 */}
            <section id="termination">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                19. Kuendigung / Termination
              </h2>
              <p className="text-base leading-relaxed text-foreground mb-2">
                Sie koennen Konto jederzeit loeschen.
              </p>
              <p className="text-base leading-relaxed text-foreground mb-2 font-semibold">Wir koennen kuendigen:</p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Bei AGB-Verstoss: sofort und ohne Vorankuendigung</li>
                <li>Ohne Begruendung: mit 30 Tagen Frist</li>
              </ul>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Ausstehende Zahlungspflichten ueberdauern Kuendigung.
              </p>
            </section>

            {/* Section 20 */}
            <section id="governing-law">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                20. Anwendbares Recht / Governing Law
              </h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Schweizer Recht unter Ausschluss der Kollisionsnormen und des UN-Kaufrechts.
                Zwingende Verbraucherschutzbestimmungen bleiben unberuehrt.
              </p>
            </section>

            {/* Section 21 */}
            <section id="jurisdiction">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                21. Gerichtsstand / Jurisdiction
              </h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Ausschliesslicher Gerichtsstand ist [Ihr Kanton], Schweiz. Wir koennen Verbraucher
                auch an deren Wohnsitzgericht verklagen.
              </p>
            </section>

            {/* Section 22 */}
            <section id="severability">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                22. Salvatorische Klausel / Severability
              </h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der uebrigen
                Bestimmungen unberuehrt.
              </p>
            </section>

            {/* Section 23 */}
            <section id="odr">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                23. Online-Streitbeilegung / ODR
              </h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                EU-Verbraucher koennen die ODR-Plattform der EU-Kommission nutzen:{" "}
                <a
                  href="https://ec.europa.eu/consumers/odr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  ec.europa.eu/consumers/odr
                </a>
              </p>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Wir sind nicht verpflichtet, an Verbraucherschlichtungsverfahren teilzunehmen,
                sind aber bereit dazu.
              </p>
            </section>

            {/* Section 24 */}
            <section id="contact">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                24. Kontakt / Contact
              </h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                DK [Nachname]<br />
                DK AI Marketplace<br />
                [Adresse]<br />
                [PLZ] [Ort], Schweiz<br />
                E-Mail:{" "}
                <a href="mailto:dari@dkaisystem.com" className="text-primary hover:underline">
                  dari@dkaisystem.com
                </a>
              </p>
            </section>

            {/* Bottom CTA */}
            <div className="mt-12 pt-8 border-t border-border">
              <p className="text-base text-foreground mb-2">
                Questions? Email{" "}
                <a href="mailto:dari@dkaisystem.com" className="text-primary hover:underline">
                  dari@dkaisystem.com
                </a>
              </p>
              <p className="text-base text-foreground">
                Read also:{" "}
                <Link to="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
              </p>
              <p className="text-sm text-muted-foreground mt-4">
                Last updated: {new Date().toLocaleDateString()}
              </p>
            </div>
          </article>

          {/* Sticky TOC on desktop */}
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
