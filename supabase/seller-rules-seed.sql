-- ============================================================
-- Seller Rules & Seller Legal Page
-- Execute in Supabase SQL Editor
-- Stand: 2026-03-20
-- Legally compliant for Swiss-based marketplace (EU DSA, GDPR, nDSG)
-- ============================================================

-- 1. SELLER PLATFORM RULES (displayed in RulesAcceptanceStep)
INSERT INTO dkai_platform_rules (rule_type, title, rules, version, is_active)
VALUES ('seller', 'Seller Obligations & Compliance / Verkäuferpflichten',
ARRAY[
  'Geschäftsfähigkeit: Sie müssen mindestens 18 Jahre alt und voll geschäftsfähig sein. Durch die Registrierung als Verkäufer bestätigen Sie dies.',
  'Wahrheitsgemässe Produktangaben: Alle Produktbeschreibungen, Bilder, Features und Preise müssen wahrheitsgemäss, vollständig und nicht irreführend sein. Falsche oder übertriebene Angaben verstossen gegen das UWG (Gesetz gegen den unlauteren Wettbewerb) und können rechtliche Konsequenzen haben.',
  'Geistiges Eigentum & Lizenzrecht: Sie garantieren, dass Sie alle erforderlichen Rechte, Lizenzen und Genehmigungen an den von Ihnen angebotenen Produkten besitzen. Urheberrechtsverletzungen, Plagiate oder der Verkauf nicht lizenzierter Inhalte sind strikt untersagt.',
  'Keine illegalen oder schädlichen Inhalte: Das Anbieten von Malware, Spyware, Exploit-Kits, illegalen Inhalten, Hacking-Tools, gestohlenen Daten oder Produkten, die gegen geltende Gesetze verstossen, ist verboten und wird den Behörden gemeldet.',
  'Lieferpflicht: Nach Abschluss eines Kaufvertrags sind Sie verpflichtet, das Produkt exakt wie beschrieben zu liefern. Die Nichtlieferung oder die Lieferung eines wesentlich abweichenden Produkts stellt einen Vertragsbruch dar.',
  'Treuhandverfahren (Escrow): Alle Verkaufserlöse werden bis zur Bestätigung des Käufers über Stripe treuhänderisch verwahrt. Die Auszahlung erfolgt erst nach Ablauf der vollständigen Rückgabefrist. Sie akzeptieren, dass kein vorzeitiger Zugriff auf Gelder möglich ist.',
  'Rückgaberecht des Käufers: Käufer haben ein Mindest-Rückgaberecht von 24 Stunden gemäss EU-Richtlinie 2011/83/EU. Innerhalb dieses Zeitraums erhält der Käufer bei Rückgabe eine vollständige Rückerstattung auf das ursprüngliche Zahlungsmittel. Dieses Recht kann nicht ausgeschlossen werden.',
  'Plattformgebühr: DK AI Marketplace erhebt eine Plattformgebühr von 10% auf alle Verkäufe. 90% des Verkaufserlöses werden nach Ablauf der Rückgabefrist über Stripe Connect an Sie ausgezahlt.',
  'Stripe Connect: Als Verkäufer müssen Sie ein verifiziertes Stripe Connect-Konto führen. Auszahlungen erfolgen ausschliesslich über Stripe. Sie sind selbst verantwortlich für die Richtigkeit Ihrer Zahlungsdaten.',
  'Steuerliche Pflichten: Sie sind allein verantwortlich für die ordnungsgemässe Deklaration und Abführung aller anfallenden Steuern (inkl. Einkommensteuer, Umsatzsteuer/MwSt.) in Ihrem Zuständigkeitsgebiet. DK AI Marketplace übernimmt keine steuerliche Beratung oder Haftung.',
  'Datenschutz (DSGVO/nDSG): Sie verpflichten sich, personenbezogene Daten von Käufern ausschliesslich zur Vertragserfüllung zu verwenden. Die Weitergabe, der Verkauf oder die anderweitige Nutzung von Käuferdaten ist strikt untersagt.',
  'Kommunikation: Jegliche Kommunikation mit Käufern muss professionell, respektvoll und sachlich erfolgen. Belästigung, Spam, Drohungen oder unangemessene Nachrichten führen zur sofortigen Sperrung.',
  'Keine Umgehung der Plattform: Versuche, Transaktionen ausserhalb der Plattform abzuwickeln, um Gebühren zu umgehen, sind verboten und führen zur sofortigen Account-Sperrung.',
  'Haftungsfreistellung: Sie stellen DK AI Marketplace von allen Ansprüchen Dritter frei, die aus Ihren Produkten, Ihrem Verhalten oder Verstössen gegen diese Regeln entstehen. Dies umfasst Rechtsanwalts- und Gerichtskosten.',
  'Konsequenzen bei Verstössen: Verstösse führen zu Verwarnungen, Produktlöschungen, temporären oder permanenten Sperrungen, Einbehaltung ausstehender Zahlungen und gegebenenfalls Meldung an Strafverfolgungsbehörden.',
  'Änderungen: DK AI Marketplace behält sich das Recht vor, diese Regeln jederzeit zu ändern. Bei wesentlichen Änderungen werden Sie informiert und müssen die neuen Regeln erneut akzeptieren, bevor Sie weitere Produkte veröffentlichen können.'
], 1, true)
ON CONFLICT (rule_type, version) DO UPDATE SET
  title = EXCLUDED.title,
  rules = EXCLUDED.rules,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- 2. SELLER LEGAL PAGE (displayed at /legal/seller)
INSERT INTO legal_pages (page_type, title, content)
VALUES ('seller', 'Seller Terms & Obligations / Verkäuferbedingungen',
'Verkäuferbedingungen für DK AI Marketplace

Stand: 20. März 2026

Betreiber:
DK AI Marketplace
Dari Kastrati
Udligenswilerstrasse 15
6043 Adligenswil, Schweiz
E-Mail: support@dkaimarketplace.com

1. Geltungsbereich
Diese Verkäuferbedingungen gelten für alle Personen und Unternehmen, die über DK AI Marketplace digitale Produkte zum Verkauf anbieten (nachfolgend „Verkäufer"). Mit der Registrierung als Verkäufer und der Veröffentlichung von Produkten akzeptieren Sie diese Bedingungen vollständig.

2. Voraussetzungen
a) Mindestalter 18 Jahre und volle Geschäftsfähigkeit
b) Wahrheitsgemässe Angaben bei der Registrierung
c) Verifiziertes Stripe Connect-Konto für den Zahlungsempfang
d) Akzeptanz der aktuellen Plattformregeln

3. Produktanforderungen
a) Alle Produktangaben (Titel, Beschreibung, Bilder, Features, Preise) müssen wahrheitsgemäss, vollständig und nicht irreführend sein (UWG-konform).
b) Der Verkäufer garantiert, dass er alle erforderlichen Rechte, Lizenzen und Genehmigungen an den angebotenen Produkten besitzt.
c) Verboten sind: Malware, Spyware, illegale Inhalte, urheberrechtsverletzende Produkte, Exploit-Kits, gestohlene Daten, Hacking-Tools.
d) Produkte müssen den Beschreibungen entsprechen und funktionsfähig sein.

4. Kaufvertrag & Lieferpflicht
a) Mit dem Kauf durch einen Käufer kommt ein verbindlicher Kaufvertrag zwischen Verkäufer und Käufer zustande. DK AI Marketplace ist lediglich Vermittler.
b) Der Verkäufer ist verpflichtet, das Produkt exakt wie beschrieben zu liefern. Die Nichtlieferung oder Lieferung eines wesentlich abweichenden Produkts stellt einen Vertragsbruch dar.
c) Der Verkäufer kann die Lieferung eines rechtsgültig gekauften Produkts nicht verweigern.

5. Zahlungsabwicklung & Treuhand (Escrow)
a) Alle Zahlungen werden über Stripe abgewickelt und treuhänderisch verwahrt.
b) Die Auszahlung an den Verkäufer erfolgt erst, nachdem der Käufer den Erhalt bestätigt hat UND die Rückgabefrist vollständig abgelaufen ist.
c) Ein vorzeitiger Zugriff auf treuhänderisch verwahrte Gelder ist nicht möglich.
d) Der Verkäufer muss seine Liquidität entsprechend planen.

6. Plattformgebühren
a) DK AI Marketplace erhebt eine Plattformgebühr von 10% auf den Bruttoverkaufspreis.
b) 90% des Verkaufserlöses werden nach Ablauf der Rückgabefrist über Stripe Connect ausgezahlt.
c) Stripe erhebt zusätzlich eigene Transaktionsgebühren gemäss dem jeweiligen Stripe-Tarif.

7. Rückgaberecht & Widerruf
a) Käufer haben ein gesetzliches Widerrufsrecht gemäss EU-Richtlinie 2011/83/EU.
b) Die Mindest-Rückgabefrist beträgt 24 Stunden ab Lieferung.
c) Innerhalb der Rückgabefrist erhält der Käufer eine vollständige Rückerstattung auf das ursprüngliche Zahlungsmittel.
d) Dieses Recht kann vom Verkäufer nicht ausgeschlossen oder eingeschränkt werden.
e) Der Verkäufer kann über die Mindest-Rückgabefrist hinaus eine längere Frist anbieten.

8. Steuerliche Pflichten
a) Der Verkäufer ist allein verantwortlich für die ordnungsgemässe Deklaration und Abführung aller anfallenden Steuern (Einkommensteuer, Umsatzsteuer/MwSt., Quellensteuer etc.) in seinem Zuständigkeitsgebiet.
b) DK AI Marketplace erbringt keine steuerliche Beratung und übernimmt keine Haftung für steuerliche Pflichten des Verkäufers.
c) Ab 2025 gelten in der Schweiz neue Plattform-Besteuerungsregeln (Deemed Supplier). DK AI Marketplace informiert betroffene Verkäufer über relevante Änderungen.

9. Datenschutz
a) Der Verkäufer verpflichtet sich, personenbezogene Daten von Käufern ausschliesslich zur Vertragserfüllung zu verwenden.
b) Die Weitergabe, der Verkauf oder die anderweitige Nutzung von Käuferdaten ist strikt untersagt (DSGVO Art. 6, nDSG Art. 6).
c) Der Verkäufer hält die Datenschutzerklärung von DK AI Marketplace ein.

10. Kommunikation
a) Jegliche Kommunikation mit Käufern muss professionell und sachlich erfolgen.
b) Belästigung, Spam, Drohungen oder unangemessene Nachrichten sind verboten.
c) Die Kommunikation hat ausschliesslich über die Plattform zu erfolgen.

11. Verbotene Praktiken
a) Umgehung der Plattform zur Vermeidung von Gebühren
b) Manipulation von Bewertungen oder Verkaufszahlen
c) Verwendung irreführender SEO-Praktiken oder Keyword-Stuffing
d) Erstellung mehrerer Konten zur Umgehung von Sperren
e) Preismanipulation oder unfaire Handelspraktiken

12. Haftung & Freistellung
a) DK AI Marketplace ist lediglich Vermittler und nicht Vertragspartei des Kaufvertrags zwischen Verkäufer und Käufer.
b) Der Verkäufer stellt DK AI Marketplace, dessen Betreiber und Mitarbeiter von allen Ansprüchen Dritter frei, die aus seinen Produkten, seinem Verhalten oder Verstössen gegen diese Bedingungen entstehen.
c) Dies umfasst insbesondere Rechtsanwalts- und Gerichtskosten sowie Schadensersatzansprüche.
d) DK AI Marketplace haftet nicht für entgangene Gewinne, Umsatzausfälle oder indirekte Schäden des Verkäufers.

13. Konsequenzen bei Verstössen
Bei Verstössen gegen diese Bedingungen behält sich DK AI Marketplace folgende Massnahmen vor:
a) Verwarnung
b) Löschung einzelner Produkte
c) Temporäre Sperrung des Verkäuferkontos
d) Permanente Sperrung des Accounts
e) Einbehaltung ausstehender Zahlungen bei begründetem Verdacht
f) Meldung an die zuständigen Strafverfolgungsbehörden
g) Geltendmachung von Schadensersatzansprüchen

14. Streitbeilegung
a) Bei Streitigkeiten zwischen Verkäufer und Käufer steht das DK AI Marketplace Dispute-System zur Verfügung.
b) DK AI Marketplace vermittelt nach bestem Wissen und Gewissen, übernimmt jedoch keine Garantie für die Lösung von Streitigkeiten.

15. Änderungen dieser Bedingungen
DK AI Marketplace behält sich das Recht vor, diese Bedingungen jederzeit zu ändern. Bei wesentlichen Änderungen werden Verkäufer informiert und müssen die neuen Bedingungen erneut akzeptieren, bevor sie weitere Produkte veröffentlichen können.

16. Anwendbares Recht & Gerichtsstand
Es gilt Schweizer Recht. Gerichtsstand ist Luzern, Schweiz. Für Verbraucher innerhalb der EU gelten zusätzlich die zwingenden Bestimmungen des jeweiligen nationalen Rechts.

17. Salvatorische Klausel
Sollte eine Bestimmung dieser Bedingungen unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen davon unberührt. Die unwirksame Bestimmung wird durch eine wirksame ersetzt, die dem wirtschaftlichen Zweck am nächsten kommt.')
ON CONFLICT (page_type) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  last_updated = now();
