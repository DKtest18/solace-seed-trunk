

# Analyse: DSGVO-Compliance & Meeting-Regeln

## Aktueller Stand

Die Plattform hat bereits:
- **User-Regeln** (`rule_type: 'user'`) — akzeptiert bei Signup
- **Seller-Regeln** (`rule_type: 'seller'`) — akzeptiert beim Seller-Onboarding
- **Legal Pages**: Impressum, Datenschutz, AGB, Cookies, Widerrufsbelehrung
- **DSGVO**: Datenexport, Account-Löschung, Cookie-Consent

## Was fehlt

### 1. Meeting-Regeln (neuer `rule_type: 'meeting'`)
Es gibt aktuell **keine separaten Meeting-Regeln**. Folgende Regeln sollten hinzugefügt werden:

- Mindestalter 18 Jahre für Meeting-Teilnahme
- Keine Nacktheit, sexuelle Inhalte oder unangemessenes Verhalten
- Keine Treffen mit Minderjährigen
- Nur geschäftliche/professionelle Meetings
- Keine Belästigung, Bedrohung oder Diskriminierung
- Keine illegalen Aktivitäten oder Aufnahmen ohne Einwilligung
- Meeting-Aufzeichnungen nur mit Zustimmung aller Teilnehmer
- Verstösse führen zu sofortigem Ausschluss und Account-Sperre

### 2. Community-Regeln (neuer `rule_type: 'community'`)
Aktuell gibt es keine expliziten Community-Regeln. Empfohlen:

- Respektvoller Umgang
- Kein Spam, keine Werbung
- Keine illegalen Inhalte
- Kein Doxxing oder Belästigung

### 3. Meeting-Regeln in Legal Pages
Eine neue Legal Page (`page_type: 'meetings'`) mit den Meeting-Richtlinien für die Legal-Übersicht.

## Umsetzungsplan

### Schritt 1: SQL-Seed für Meeting- und Community-Regeln
- `INSERT INTO platform_rules` mit `rule_type = 'meeting'` und den oben genannten Regeln
- `INSERT INTO platform_rules` mit `rule_type = 'community'`
- `INSERT INTO legal_pages` mit `page_type = 'meetings'` (Meeting-Richtlinien)

### Schritt 2: Meeting-Regeln-Akzeptanz erzwingen
- `useRulesAcceptance` Hook um `meeting`-Typ erweitern
- Vor dem Beitreten eines Meetings müssen Nutzer die Meeting-Regeln akzeptieren (ähnlich wie `RulesAcceptanceStep`)

### Schritt 3: Legal-Übersichtsseite erweitern
- Neue Karte "Meeting Guidelines" zur `LegalOverview.tsx` hinzufügen

### Schritt 4: Community-Regeln-Akzeptanz
- Vor dem ersten Community-Post müssen Nutzer Community-Regeln akzeptieren

## DK Meeting App — Prompt

Hier ist ein Prompt, den du für die separate **DK Meeting** App verwenden kannst:

```text
Erstelle Meeting-Richtlinien für die DK Meeting App, die als externe 
Video-Meeting-Plattform für den DK AI Marketplace dient. Meetings werden 
im DK AI Marketplace geplant und in der DK Meeting App abgehalten.

Regeln:
1. Mindestalter: Teilnehmer müssen mindestens 18 Jahre alt sein.
2. Nur geschäftliche Zwecke: Meetings dienen ausschliesslich 
   geschäftlichen/professionellen Gesprächen (Produktberatung, Support, 
   Demos, Vertragsverhandlungen).
3. Verbotene Inhalte: Keine Nacktheit, sexuelle Inhalte, Gewalt, 
   Hassrede, Diskriminierung oder illegale Aktivitäten.
4. Keine Minderjährigen: Treffen mit Personen unter 18 Jahren sind 
   strikt untersagt.
5. Aufzeichnungen: Meeting-Aufzeichnungen (Audio/Video/Screen) nur 
   mit ausdrücklicher Zustimmung aller Teilnehmer.
6. Respektvolles Verhalten: Keine Belästigung, Bedrohung, Stalking 
   oder Einschüchterung.
7. Keine illegalen Geschäfte: Keine Diskussion oder Planung illegaler 
   Aktivitäten.
8. Datenschutz: Keine Weitergabe persönlicher Daten anderer Teilnehmer 
   ohne deren Einwilligung (DSGVO Art. 6).
9. Verstösse: Führen zu sofortigem Meeting-Ausschluss, Account-Sperre 
   auf DK AI Marketplace und ggf. Meldung an Behörden.
10. Haftung: DK Meeting und DK AI Marketplace haften nicht für Inhalte, 
    die von Teilnehmern geteilt werden. Die Verantwortung liegt beim 
    jeweiligen Nutzer.

Betreiber: DK AI Marketplace, Dari Kastrati, Udligenswilerstrasse 15, 
6043 Adligenswil, Schweiz. Email: support@dkaimarketplace.com

Implementiere diese Regeln als Akzeptanz-Dialog vor dem Beitritt zu 
jedem Meeting. Nutzer müssen die Regeln beim ersten Mal akzeptieren, 
und erneut wenn die Regeln aktualisiert werden.
```

## DSGVO-Checkliste — Was ist erfüllt

| Anforderung | Status |
|---|---|
| Impressum | ✅ |
| Datenschutzerklärung (Art. 13/14) | ✅ |
| AGB | ✅ |
| Cookie Policy & Consent | ✅ |
| Widerrufsbelehrung (EU 2011/83) | ✅ |
| Datenexport (Art. 20) | ✅ |
| Account-Löschung (Art. 17) | ✅ |
| Auftragsverarbeiter benannt | ✅ |
| User-Regeln bei Signup | ✅ |
| Seller-Regeln bei Onboarding | ✅ |
| Meeting-Regeln | ❌ — neu hinzufügen |
| Community-Regeln | ❌ — neu hinzufügen |
| Meeting Legal Page | ❌ — neu hinzufügen |

