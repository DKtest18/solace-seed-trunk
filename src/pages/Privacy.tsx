import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const LAST_UPDATED = "25. Mai 2026";

const sections = [
  { id: "verantwortliche", title: "1. Verantwortliche Stelle / Controller" },
  { id: "geltungsbereich", title: "2. Geltungsbereich / Scope" },
  { id: "grundlagen", title: "3. Grundlagen / Legal Basis" },
  { id: "daten", title: "4. Welche Daten wir erheben / Data We Collect" },
  { id: "zwecke", title: "5. Zwecke der Verarbeitung / Purposes" },
  { id: "empfaenger", title: "6. Empfaenger / Recipients - Auftragsverarbeiter" },
  { id: "international", title: "7. Internationale Datenuebermittlung" },
  { id: "speicherdauer", title: "8. Speicherdauer / Retention" },
  { id: "rechte", title: "9. Ihre Rechte / Your Rights" },
  { id: "beschwerde", title: "10. Beschwerderecht / Right to Complain" },
  { id: "automatisiert", title: "11. Automatisierte Entscheidungsfindung" },
  { id: "ai", title: "12. AI-Produkte Transparenz / AI Transparency" },
  { id: "sicherheit", title: "13. Sicherheit / Security" },
  { id: "breaches", title: "14. Datenschutzverletzungen / Breaches" },
  { id: "aenderungen", title: "15. Aenderungen / Changes" },
  { id: "kontakt", title: "16. Kontakt bei Datenschutzfragen" },
];

const Privacy = () => {
  const [tocOpen, setTocOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto py-12 px-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-8">
          <article className="max-w-3xl">
            <h1 className="font-display text-4xl font-semibold mb-2">Privacy Policy</h1>
            <p className="font-display text-xl text-muted-foreground mb-2">Datenschutzerklaerung</p>
            <p className="text-sm text-muted-foreground mb-2">
              Stand / Last updated: {LAST_UPDATED}
            </p>
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

            <section id="verantwortliche">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                1. Verantwortliche Stelle / Controller
              </h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                DK AI Marketplace<br />
                DK [Nachname]<br />
                [Adresse], Schweiz<br />
                E-Mail:{" "}
                <a href="mailto:dari@dkaisystem.com" className="text-primary hover:underline">
                  dari@dkaisystem.com
                </a>
              </p>
            </section>

            <section id="geltungsbereich">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                2. Geltungsbereich / Scope
              </h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Diese Datenschutzerklaerung gilt fuer die Verarbeitung personenbezogener Daten durch
                DK AI Marketplace im Rahmen der Nutzung von dkaimarketplace.com sowie verbundener
                Dienste.
              </p>
              <p className="text-base leading-relaxed text-foreground mb-4">
                This privacy policy applies to all personal data processing by DK AI Marketplace
                through dkaimarketplace.com and connected services.
              </p>
            </section>

            <section id="grundlagen">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                3. Grundlagen / Legal Basis
              </h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Wir verarbeiten Ihre Daten auf folgenden Rechtsgrundlagen:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Vertragserfuellung (Art. 31 Abs. 2 lit. a revDSG, Art. 6 Abs. 1 lit. b DSGVO)</li>
                <li>Rechtliche Verpflichtung (Art. 31 Abs. 1 revDSG, Art. 6 Abs. 1 lit. c DSGVO)</li>
                <li>Berechtigtes Interesse (Art. 31 Abs. 2 lit. b revDSG, Art. 6 Abs. 1 lit. f DSGVO)</li>
                <li>Einwilligung (Art. 31 Abs. 1 revDSG, Art. 6 Abs. 1 lit. a DSGVO)</li>
              </ul>
            </section>

            <section id="daten">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                4. Welche Daten wir erheben / Data We Collect
              </h2>

              <h3 className="font-display text-lg font-semibold mt-6 mb-2">Account-Daten</h3>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>E-Mail-Adresse</li>
                <li>Passwort (verschluesselt gespeichert via SHA-256/bcrypt durch Supabase)</li>
                <li>Vor- und Nachname (optional)</li>
                <li>Profilbild (optional)</li>
              </ul>

              <h3 className="font-display text-lg font-semibold mt-6 mb-2">
                Profildaten (fuer Verkaeufer)
              </h3>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Biografie, Skills, Spezialgebiete</li>
                <li>Stripe Connect-Account-ID (Zahlungsabwicklung)</li>
                <li>Bewertungen und Reviews</li>
              </ul>

              <h3 className="font-display text-lg font-semibold mt-6 mb-2">Transaktionsdaten</h3>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Kauf-/Verkaufshistorie</li>
                <li>Bestellungen, Status, Betraege</li>
                <li>Kommunikation zwischen Kaeufern und Verkaeufern</li>
              </ul>

              <h3 className="font-display text-lg font-semibold mt-6 mb-2">Zahlungsdaten</h3>
              <div className="bg-muted/50 border-l-4 border-primary p-4 my-4">
                <ul className="list-disc list-inside ml-4 space-y-2">
                  <li>Werden ausschliesslich von Stripe verarbeitet</li>
                  <li>Wir speichern KEINE Kreditkartendaten</li>
                  <li>Wir sehen nur die letzten 4 Ziffern fuer Buchhaltung</li>
                </ul>
              </div>

              <h3 className="font-display text-lg font-semibold mt-6 mb-2">Technische Daten</h3>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>IP-Adresse (gekuerzt nach 30 Tagen)</li>
                <li>Browser-Typ, Betriebssystem</li>
                <li>Aufgerufene Seiten, Zeitstempel</li>
                <li>Cookies (siehe Cookie-Richtlinie)</li>
              </ul>

              <h3 className="font-display text-lg font-semibold mt-6 mb-2">Custom Order Daten</h3>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Beschreibungen, Anhaenge, Kommunikation</li>
                <li>Status, Preise, Vereinbarungen</li>
              </ul>

              <h3 className="font-display text-lg font-semibold mt-6 mb-2">
                2FA-Daten (wenn aktiviert)
              </h3>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>TOTP-Secret (verschluesselt AES-GCM)</li>
                <li>Backup-Codes (SHA-256 gehasht)</li>
              </ul>
            </section>

            <section id="zwecke">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                5. Zwecke der Verarbeitung / Purposes
              </h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Bereitstellung des Marketplace-Services</li>
                <li>Zahlungsabwicklung ueber Stripe</li>
                <li>Versand transaktionaler E-Mails</li>
                <li>Schutz vor Betrug und Missbrauch</li>
                <li>Erfuellung gesetzlicher Aufbewahrungspflichten</li>
                <li>Verbesserung des Services (anonymisiert)</li>
                <li>Direkte Kommunikation auf der Plattform</li>
              </ul>
            </section>

            <section id="empfaenger">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                6. Empfaenger / Recipients - Auftragsverarbeiter
              </h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Wir nutzen folgende externe Dienstleister:
              </p>

              <h3 className="font-display text-lg font-semibold mt-6 mb-2">a) Supabase Inc.</h3>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Zweck: Datenbank, Authentifizierung, Datei-Speicherung<br />
                Standort: EU (Frankfurt) / US<br />
                DPA:{" "}
                <a
                  href="https://supabase.com/legal/dpa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  supabase.com/legal/dpa
                </a>
                <br />
                Datenkategorien: Account, Profile, Transaktionen
              </p>

              <h3 className="font-display text-lg font-semibold mt-6 mb-2">
                b) Stripe Payments Europe Ltd.
              </h3>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Zweck: Zahlungsabwicklung, Connect-Auszahlungen<br />
                Standort: Irland (EU), USA<br />
                Privacy:{" "}
                <a
                  href="https://stripe.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  stripe.com/privacy
                </a>
                <br />
                Datenkategorien: Zahlungs-, Transaktions-, Identitaetsdaten
              </p>

              <h3 className="font-display text-lg font-semibold mt-6 mb-2">
                c) Resend / Postmark (Email-Service)
              </h3>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Zweck: Versand transaktionaler E-Mails<br />
                Standort: USA<br />
                Datenkategorien: E-Mail, Name, Versanddaten
              </p>

              <h3 className="font-display text-lg font-semibold mt-6 mb-2">
                d) Vercel Inc. / Lovable
              </h3>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Zweck: Hosting der Webanwendung<br />
                Standort: Global (CDN)<br />
                Datenkategorien: Technische Logs, IP-Adressen
              </p>

              <h3 className="font-display text-lg font-semibold mt-6 mb-2">e) GitHub (Microsoft)</h3>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Zweck: Code-Repository<br />
                Standort: USA<br />
                Keine personenbezogenen Daten von Endnutzern
              </p>
            </section>

            <section id="international">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                7. Internationale Datenuebermittlung
              </h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Einige unserer Dienstleister verarbeiten Daten in den USA. Hierfuer bestehen
                folgende Schutzmechanismen:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>EU-US Data Privacy Framework (DPF)</li>
                <li>EU-Standardvertragsklauseln (SCC)</li>
                <li>Schweizer Anerkennung des DPF durch EDOEB</li>
              </ul>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Sie koennen auf Anfrage Kopien dieser Schutzmechanismen erhalten.
              </p>
            </section>

            <section id="speicherdauer">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                8. Speicherdauer / Retention
              </h2>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Account-Daten: bis Kontoloeschung + 30 Tage Grace Period</li>
                <li>Transaktionsdaten: 10 Jahre (CH-Buchfuehrung, OR Art. 958f)</li>
                <li>Server-Logs: 90 Tage</li>
                <li>E-Mail-Logs: 12 Monate</li>
                <li>Cookies: siehe Cookie-Richtlinie (max. 24 Monate)</li>
                <li>Bewertungen: dauerhaft (anonymisiert nach Kontoloeschung)</li>
              </ul>
            </section>

            <section id="rechte">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                9. Ihre Rechte / Your Rights
              </h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Gemaess revDSG und DSGVO haben Sie folgende Rechte:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Auskunft (Art. 25 revDSG, Art. 15 DSGVO)</li>
                <li>Berichtigung (Art. 32 Abs. 1 revDSG, Art. 16 DSGVO)</li>
                <li>Loeschung (Art. 32 Abs. 2 lit. c revDSG, Art. 17 DSGVO)</li>
                <li>Einschraenkung (Art. 18 DSGVO)</li>
                <li>Datenuebertragbarkeit (Art. 28 revDSG, Art. 20 DSGVO)</li>
                <li>Widerspruch (Art. 30 revDSG, Art. 21 DSGVO)</li>
                <li>Widerruf von Einwilligungen (jederzeit)</li>
              </ul>
              <div className="bg-muted/50 border-l-4 border-primary p-4 my-4">
                <p className="text-base leading-relaxed text-foreground mb-2 font-semibold">
                  So ueben Sie Ihre Rechte aus:
                </p>
                <ul className="list-disc list-inside ml-4 space-y-2">
                  <li>
                    E-Mail:{" "}
                    <a href="mailto:dari@dkaisystem.com" className="text-primary hover:underline">
                      dari@dkaisystem.com
                    </a>{" "}
                    (Betreff: <span className="font-mono text-sm">Datenschutz-Anfrage</span>)
                  </li>
                  <li>Self-Service: Einstellungen -&gt; Privatsphaere</li>
                  <li>Antwortzeit: innerhalb von 30 Tagen</li>
                </ul>
              </div>
            </section>

            <section id="beschwerde">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                10. Beschwerderecht / Right to Complain
              </h2>
              <h3 className="font-display text-lg font-semibold mt-6 mb-2">Schweiz</h3>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Eidgenoessischer Datenschutz- und Oeffentlichkeitsbeauftragter (EDOEB)<br />
                Feldeggweg 1, 3003 Bern,{" "}
                <a
                  href="https://edoeb.admin.ch"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  edoeb.admin.ch
                </a>
              </p>
              <h3 className="font-display text-lg font-semibold mt-6 mb-2">EU</h3>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Datenschutzbehoerde Ihres Wohnsitzlandes.
              </p>
            </section>

            <section id="automatisiert">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                11. Automatisierte Entscheidungsfindung
              </h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Wir treffen keine vollautomatisierten Entscheidungen mit rechtlicher Wirkung (Art.
                22 DSGVO).
              </p>
            </section>

            <section id="ai">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                12. AI-Produkte Transparenz / AI Transparency
              </h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Auf unserer Plattform werden AI-Produkte verkauft. Kaeufer werden klar informiert
                wenn ein Produkt KI-basiert ist. Verkaeufer sind verpflichtet, Funktionsweise
                transparent zu beschreiben (EU AI Act).
              </p>
            </section>

            <section id="sicherheit">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                13. Sicherheit / Security
              </h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Wir treffen technische und organisatorische Massnahmen:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>TLS-Verschluesselung</li>
                <li>Datenbank-Verschluesselung bei Supabase</li>
                <li>2-Faktor-Authentifizierung verfuegbar</li>
                <li>Sensible Daten AES-GCM verschluesselt</li>
                <li>Passwoerter via bcrypt gehasht</li>
                <li>Regelmaessige Security-Audits</li>
                <li>Stripe-zertifizierte Zahlungsabwicklung (PCI DSS)</li>
              </ul>
            </section>

            <section id="breaches">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                14. Datenschutzverletzungen / Breaches
              </h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Im Falle einer Datenschutzverletzung benachrichtigen wir:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2 mb-4">
                <li>Die zustaendige Aufsichtsbehoerde innert 72h</li>
                <li>
                  Betroffene Nutzer "unverzueglich" wenn hohes Risiko besteht (Art. 24 revDSG, Art.
                  34 DSGVO)
                </li>
              </ul>
            </section>

            <section id="aenderungen">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                15. Aenderungen / Changes
              </h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Wir koennen diese Datenschutzerklaerung anpassen. Wesentliche Aenderungen werden 30
                Tage im Voraus per E-Mail mitgeteilt. Aktuelle Version stets unter{" "}
                <span className="font-mono text-sm">/privacy</span>.
              </p>
            </section>

            <section id="kontakt">
              <h2 className="font-display text-2xl font-semibold mt-10 mb-4">
                16. Kontakt bei Datenschutzfragen
              </h2>
              <p className="text-base leading-relaxed text-foreground mb-4">
                E-Mail:{" "}
                <a href="mailto:dari@dkaisystem.com" className="text-primary hover:underline">
                  dari@dkaisystem.com
                </a>
                <br />
                Betreff: <span className="font-mono text-sm">Datenschutz-Anfrage</span>
              </p>
              <p className="text-base leading-relaxed text-foreground mb-4">
                Wir sind nicht verpflichtet, einen Datenschutzbeauftragten (DSB) zu benennen.
              </p>
            </section>

            <div className="mt-12 bg-muted/50 border-l-4 border-primary p-4 rounded-md">
              <p className="text-base leading-relaxed text-foreground">
                Have privacy questions? Email{" "}
                <a
                  href="mailto:support@dkaimarketplace.com"
                  className="text-primary hover:underline"
                >
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
                    <a
                      href={`#${s.id}`}
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
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
};

export default Privacy;
