

## Audit-Ergebnis: Legal Pages & DSGVO-Konformität

### Status der Legal Pages

| Seite | page_type | Inhalt | Status |
|-------|-----------|--------|--------|
| Impressum | `imprint` | § 5 TMG/DDG, Pflichtangaben, ODR-Link | ✅ Vollständig (Platzhalter vorhanden) |
| Datenschutz | `privacy` | Art. 13/14, 5 Auftragsverarbeiter, Betroffenenrechte, Drittlandtransfer | ✅ Vollständig |
| AGB | `terms` | Buyer/Seller, Widerrufsrecht, 10% Fee, Salvatorische Klausel, Rom I | ✅ Vollständig |
| Cookies | `cookies` | Essential/Preference differenziert, kein Tracking | ✅ Vollständig |
| Widerruf/Refund | `refund` | Muster-Widerrufsformular, Waiver, § 355/356 BGB | ✅ Vollständig |

### Gefundene Probleme

**1. SQL-Bug: Spaltenname `updated_at` vs `last_updated`**
Die `legal_pages`-Tabelle hat die Spalte `last_updated` (laut Types), aber das Seed-SQL referenziert `updated_at` in den ON CONFLICT Klauseln. Das SQL wird fehlschlagen.

**2. Kein Footer mit Legal-Links**
Die Index-Seite und das AppLayout haben keinen Footer mit Links zu Impressum, Datenschutz, AGB usw. Nach deutschem Recht (TMG/DDG) müssen diese von **jeder Seite** aus erreichbar sein.

**3. Platzhalter noch nicht ausgefüllt**
Alle `[...]`-Platzhalter im SQL müssen vor dem Ausführen ersetzt werden.

### Plan

1. **SQL-Seed korrigieren**: `updated_at` → `last_updated` in allen 5 ON CONFLICT Klauseln
2. **Footer-Komponente erstellen**: Mit Links zu allen 5 Legal Pages (Impressum, Datenschutz, AGB, Cookies, Widerruf) — von jeder Seite aus sichtbar via AppLayout
3. **Korrigiertes SQL im Chat ausgeben**: Fertiges, ausführbares SQL mit korrektem Spaltennamen

### Korrigiertes SQL

Nach der Implementierung gebe ich dir das vollständige SQL hier im Chat mit folgenden Korrekturen:
- `updated_at = now()` → `last_updated = now()` (5 Stellen)
- Alle Platzhalter markiert mit `⚠️ ERSETZEN`

### Technische Details

- `legal_pages`-Tabelle: Spalten `id`, `page_type` (UNIQUE), `title`, `content`, `last_updated`, `updated_by`
- Route `/legal/:type` existiert und liest korrekt aus der Tabelle
- `Legal.tsx` verwendet `data.title` und `data.content` — korrekt
- CookieConsent verlinkt bereits auf `/legal/cookies` und `/legal/privacy`
- Fehlender Footer: weder in `AppLayout.tsx` noch in `Index.tsx`

