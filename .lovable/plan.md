# Netzwerk & Tools auf der Startseite

## Ziel
Die rein dekorative Symbol-Leiste zwischen Produktkarten und „So funktioniert’s“ entfernen und einen hochwertigen, barrierefreien Bereich „Netzwerk & Tools“ direkt unter „Warum DK AI Marketplace“ sowie vor dem Verkäufer-Aufruf ergänzen.

## Umsetzung
1. Eine eigenständige `NetworkToolsSection` mit zentraler, typisierter Konfiguration für Nordpixel, Make und ElevenLabs erstellen.
2. Die drei vorgegebenen Ziele und Linkattribute unverändert einsetzen:
   - Nordpixel: `nofollow noopener`
   - Make und ElevenLabs: `sponsored noopener`
3. Eine langsame, nahtlose CSS-Transform-Animation mit genügend visuellen Kopien umsetzen. Nur die drei Originaleinträge werden wiederholt.
4. Die drei eigentlichen Links als semantische Liste und einzige Tastaturstopps bereitstellen. Animationskopien bleiben für Maus/Touch anklickbar, sind aber aus Tab-Reihenfolge und Screenreader-Baum entfernt. Bei Tastaturfokus wechselt der Bereich in eine sichtbare statische Ansicht.
5. Pause/Fortsetzen mit zugänglichem Zustand ergänzen. Hover und Fokus pausieren temporär; eine bewusst gewählte Pause bleibt bestehen. `prefers-reduced-motion` zeigt standardmässig die statische responsive Ansicht.
6. Karten, Logo-Flächen, Fokusmarkierungen, Abstände und Kontrast an die bestehende helle Startseite und ihre semantischen Variablen anpassen. Seitenweiter horizontaler Overflow wird verhindert.
7. Überschrift, Untertitel, Beschreibungen, Kennzeichnungen, Linkbeschriftungen, Steuerung und Affiliate-Hinweis in Deutsch, Englisch und Französisch ergänzen.
8. Die vorhandene dekorative Icon-Leiste samt nicht mehr benötigtem Code entfernen. Produktkarten, „So funktioniert’s“, bestehende Firmenlogo-Wand, Vertrauensbereich und Verkäufer-Aufruf bleiben erhalten.

## Logo-Dateien
- Die Uploads sind inhaltlich eindeutig Nordpixel, Make und ElevenLabs zugeordnet.
- Technische Prüfung: Alle drei Dateien sind undurchsichtige RGB-Bilder. Nordpixel hat einen echten weissen Hintergrund; Make und ElevenLabs haben ein eingebranntes Schachbrett und sind daher keine transparenten Originaldateien.
- Vor der Umsetzung werden geeignete offizielle Originalvarianten von den ausdrücklich genannten Markenressourcen geprüft. Nur eine klar offizielle, kontrastreiche Datei wird lokal als Projektdatei gespeichert.
- Falls für Make oder ElevenLabs keine eindeutig geeignete Originaldatei abrufbar ist, erscheint zunächst der Unternehmensname als sauberer Text-Fallback. Es wird kein Logo nachgebaut, generiert, umgefärbt oder mit Filtern kaschiert.

## Prüfung
- Desktop und Mobil: Reihenfolge, Lesbarkeit, Endlosschleife, Hover-/Fokus-Pause, manuelle Pause, Touch-Ziele und kein Seiten-Overflow.
- Reduzierte Bewegung: statische responsive Liste ohne automatische Bewegung.
- Tastatur und Screenreader: genau drei primäre Linkstopps, sichtbare Fokusmarkierungen, verständliche Beschriftungen und zugänglicher Pausenstatus.
- Links: exakte URLs, Parameter, `target="_blank"` und korrekte `rel`-Werte.
- Bilddarstellung: feste Logo-Flächen, `object-fit: contain`, keine Verzerrung oder Beschneidung.
- Build-/TypeScript-Prüfung und sichtbare Kontrolle in der Vorschau.

## Grenzen
Keine Änderung an Supabase, Authentifizierung, Datenbank, Storage oder Stripe. Kein Lovable Cloud. Keine neuen oder generierten Logos.
