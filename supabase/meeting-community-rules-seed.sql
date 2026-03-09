-- ============================================================
-- Meeting- und Community-Regeln + Meeting Legal Page
-- Ausführen im Supabase SQL Editor
-- Stand: 2026-03-09
-- ============================================================

-- Sicherstellen, dass die Tabelle dkai_platform_rules existiert
-- (sollte bereits vorhanden sein)

-- 1. MEETING-REGELN
INSERT INTO dkai_platform_rules (rule_type, title, rules, version, is_active)
VALUES ('meeting', 'Meeting-Richtlinien', 
ARRAY[
  'Mindestalter: Teilnehmer müssen mindestens 18 Jahre alt sein. Meetings mit Personen unter 18 Jahren sind strikt untersagt.',
  'Nur geschäftliche Zwecke: Meetings dienen ausschliesslich geschäftlichen und professionellen Gesprächen wie Produktberatung, Support, Demos oder Vertragsverhandlungen.',
  'Keine Nacktheit oder sexuelle Inhalte: Jegliche Form von Nacktheit, sexuellen Inhalten oder unangemessenem Verhalten ist verboten.',
  'Keine Treffen mit Minderjährigen: Das Arrangieren oder Durchführen von Meetings mit Personen unter 18 Jahren ist strikt untersagt und wird den Behörden gemeldet.',
  'Respektvolles Verhalten: Keine Belästigung, Bedrohung, Stalking, Einschüchterung, Hassrede oder Diskriminierung jeglicher Art.',
  'Keine illegalen Aktivitäten: Die Diskussion, Planung oder Durchführung illegaler Aktivitäten ist verboten.',
  'Aufzeichnungen nur mit Einwilligung: Meeting-Aufzeichnungen (Audio, Video, Bildschirmaufnahmen) sind nur mit ausdrücklicher Zustimmung aller Teilnehmer gestattet.',
  'Datenschutz (DSGVO Art. 6): Keine Weitergabe persönlicher Daten anderer Teilnehmer ohne deren ausdrückliche Einwilligung.',
  'Verstösse: Führen zu sofortigem Meeting-Ausschluss, Account-Sperre auf DK AI Marketplace und gegebenenfalls Meldung an die zuständigen Behörden.',
  'Haftung: DK AI Marketplace haftet nicht für Inhalte, die von Teilnehmern in Meetings geteilt werden. Die Verantwortung liegt beim jeweiligen Nutzer.'
], 1, true)
ON CONFLICT (rule_type, version) DO UPDATE SET
  title = EXCLUDED.title,
  rules = EXCLUDED.rules,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- 2. COMMUNITY-REGELN
INSERT INTO dkai_platform_rules (rule_type, title, rules, version, is_active)
VALUES ('community', 'Community-Richtlinien',
ARRAY[
  'Respektvoller Umgang: Behandle alle Community-Mitglieder mit Respekt und Höflichkeit. Keine Beleidigungen, persönliche Angriffe oder Diskriminierung.',
  'Kein Spam: Keine wiederholten, irrelevanten oder werblichen Beiträge. Eigenpromotion nur in angemessenem Rahmen.',
  'Keine illegalen Inhalte: Das Teilen von illegalen, urheberrechtlich geschützten oder schädlichen Inhalten ist verboten.',
  'Kein Doxxing: Das Veröffentlichen persönlicher Informationen anderer Nutzer ohne deren Zustimmung ist strikt untersagt.',
  'Keine Belästigung: Kein Stalking, Cybermobbing, Drohungen oder Einschüchterung anderer Nutzer.',
  'Keine Nacktheit oder anstössige Inhalte: Keine sexuellen, gewalttätigen oder anderweitig unangemessenen Inhalte.',
  'Konstruktive Beiträge: Beiträge sollten einen Mehrwert für die Community bieten. Kritik ist willkommen, muss aber sachlich und konstruktiv sein.',
  'Datenschutz: Respektiere die Privatsphäre anderer Nutzer. Keine Weitergabe privater Nachrichten oder persönlicher Daten.',
  'Verstösse: Können zu Verwarnungen, temporären Sperren oder permanentem Ausschluss aus der Community führen.',
  'Meldepflicht: Verdächtige oder regelwidrige Inhalte bitte über die Meldefunktion an das Moderationsteam melden.'
], 1, true)
ON CONFLICT (rule_type, version) DO UPDATE SET
  title = EXCLUDED.title,
  rules = EXCLUDED.rules,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- 3. MEETING LEGAL PAGE
INSERT INTO legal_pages (page_type, title, content)
VALUES ('meetings', 'Meeting Guidelines / Meeting-Richtlinien',
'Meeting-Richtlinien für DK AI Marketplace

Stand: 09. März 2026

Betreiber:
DK AI Marketplace
Dari Kastrati
Udligenswilerstrasse 15
6043 Adligenswil, Schweiz
E-Mail: support@dkaimarketplace.com

1. Geltungsbereich
Diese Richtlinien gelten für alle Video-Meetings, die über den DK AI Marketplace geplant und in der DK Meeting App abgehalten werden. Mit der Teilnahme an einem Meeting akzeptieren Sie diese Richtlinien vollständig.

2. Mindestalter
Die Teilnahme an Meetings ist ausschliesslich Personen ab 18 Jahren gestattet. DK AI Marketplace behält sich das Recht vor, eine Altersverifikation zu verlangen.

3. Zweckbindung
Meetings dienen ausschliesslich geschäftlichen und professionellen Zwecken:
- Produktberatung und -demos
- Support-Gespräche
- Vertragsverhandlungen
- Projektbesprechungen
Die Nutzung für private, nicht-geschäftliche Zwecke ist nicht gestattet.

4. Verbotene Inhalte und Verhaltensweisen
Folgende Inhalte und Verhaltensweisen sind strikt untersagt:
a) Nacktheit, sexuelle Inhalte oder anzügliches Verhalten
b) Treffen mit Personen unter 18 Jahren
c) Belästigung, Bedrohung, Stalking oder Einschüchterung
d) Hassrede, Diskriminierung aufgrund von Geschlecht, Ethnie, Religion, sexueller Orientierung oder Behinderung
e) Gewaltverherrlichung oder -androhung
f) Diskussion, Planung oder Durchführung illegaler Aktivitäten
g) Verbreitung von Malware oder schädlichen Links

5. Aufzeichnungen und Datenschutz
a) Meeting-Aufzeichnungen (Audio, Video, Bildschirmfreigaben) sind nur mit ausdrücklicher, vorab eingeholter Zustimmung aller Teilnehmer gestattet.
b) Die Weitergabe persönlicher Daten anderer Teilnehmer ohne deren Einwilligung ist gemäss DSGVO Art. 6 und nDSG untersagt.
c) Geteilte Bildschirminhalte und Dateien unterliegen dem Datenschutz und dürfen nicht ohne Genehmigung weiterverbreitet werden.

6. Konsequenzen bei Verstössen
Bei Verstössen gegen diese Richtlinien behält sich DK AI Marketplace folgende Massnahmen vor:
a) Sofortiger Ausschluss aus dem laufenden Meeting
b) Temporäre oder permanente Sperrung des Accounts
c) Meldung an die zuständigen Strafverfolgungsbehörden bei Verdacht auf strafbare Handlungen
d) Geltendmachung von Schadensersatzansprüchen

7. Haftungsausschluss
DK AI Marketplace und DK Meeting haften nicht für:
a) Inhalte, die von Teilnehmern in Meetings geteilt werden
b) Vereinbarungen, die zwischen Teilnehmern getroffen werden
c) Schäden, die aus der Nutzung der Meeting-Funktion entstehen
Die Verantwortung für geteilte Inhalte liegt ausschliesslich beim jeweiligen Nutzer.

8. Datenschutz
Die Verarbeitung personenbezogener Daten im Rahmen von Meetings erfolgt gemäss unserer Datenschutzerklärung und in Übereinstimmung mit der DSGVO und dem nDSG. Details finden Sie unter /legal/privacy.

9. Änderungen
DK AI Marketplace behält sich das Recht vor, diese Richtlinien jederzeit zu ändern. Bei wesentlichen Änderungen werden die Nutzer informiert und müssen die aktualisierten Richtlinien erneut akzeptieren.

10. Anwendbares Recht
Es gilt Schweizer Recht. Gerichtsstand ist Luzern, Schweiz.')
ON CONFLICT (page_type) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  last_updated = now();

-- 4. COMMUNITY LEGAL PAGE
INSERT INTO legal_pages (page_type, title, content)
VALUES ('community', 'Community Guidelines / Community-Richtlinien',
'Community-Richtlinien für DK AI Marketplace

Stand: 09. März 2026

Betreiber:
DK AI Marketplace
Dari Kastrati
Udligenswilerstrasse 15
6043 Adligenswil, Schweiz
E-Mail: support@dkaimarketplace.com

1. Geltungsbereich
Diese Richtlinien gelten für alle Beiträge, Kommentare und Interaktionen in der DK AI Marketplace Community. Mit der Nutzung der Community akzeptieren Sie diese Richtlinien.

2. Grundregeln
a) Respektvoller Umgang: Behandle alle Community-Mitglieder mit Höflichkeit und Respekt.
b) Konstruktive Beiträge: Beiträge sollen einen Mehrwert bieten. Sachliche Kritik ist willkommen.
c) Keine Beleidigungen: Persönliche Angriffe, Beschimpfungen und Herabsetzungen sind untersagt.

3. Verbotene Inhalte
a) Spam und unerwünschte Werbung
b) Illegale oder urheberrechtlich geschützte Inhalte
c) Nacktheit, sexuelle oder gewalttätige Inhalte
d) Hassrede und Diskriminierung
e) Doxxing (Veröffentlichung persönlicher Daten anderer)
f) Malware, Phishing-Links oder schädliche Inhalte

4. Datenschutz
a) Respektiere die Privatsphäre anderer Nutzer.
b) Veröffentliche keine privaten Nachrichten oder persönliche Daten ohne Zustimmung.
c) Die Verarbeitung personenbezogener Daten erfolgt gemäss DSGVO und nDSG.

5. Moderation
a) Das Moderationsteam behält sich das Recht vor, Beiträge ohne Vorankündigung zu entfernen.
b) Nutzer können verdächtige Inhalte über die Meldefunktion melden.

6. Konsequenzen
Bei Verstössen drohen:
a) Verwarnung
b) Temporäre Sperre der Community-Funktion
c) Permanenter Ausschluss
d) Account-Sperre bei schwerwiegenden Verstössen

7. Anwendbares Recht
Es gilt Schweizer Recht. Gerichtsstand ist Luzern, Schweiz.')
ON CONFLICT (page_type) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  last_updated = now();
