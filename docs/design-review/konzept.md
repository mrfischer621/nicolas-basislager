# Designkonzept CRM: Blauwasser Design System

Stand 11.10.2026, Branch `feature/crm-anpassungen-okt26`. Verbindliche Quelle ist `design-system/blauwasser/` (Export vom 02.10.2026). Die Screenshots zeigen **nur erfundene Testdaten** («ZZ Testfirma», Mock in `scripts/mock/`), weil das Repository öffentlich ist.

## 1. Diagnose des Ist-Zustands (vor dem Umbau)

Jede Aussage ist am Vorher-Screenshot oder per Suche prüfbar.

1. **Zwei Markenwelten und keine Hierarchie der Farbe.** Primärknöpfe, aktive Navigation und Filter waren salbeigrün (`#6b8a5e`, «Freiluftchuchi Sage»), daneben Rot, Grün, Blau, Lila und Gelb aus der Tailwind-Palette. Im Code standen 1'861 Palettenklassen (`gray-500`, `red-600`, …). Belege: `vorher/buchungen-hell-1440.png`, Suche im Commit `2a8b3d7e`.
2. **Bedeutung nur über Farbe, teils unlesbar.** Einnahmen grün, Ausgaben rot, Gewinn grün. Die Kennzahl «Einnahmen» im Dashboard stand in `#4ade80` auf Weiss, das sind rund 1.9:1. Der Typ «Ausgabe» in der Maske war ein roter Knopf. Belege: `vorher/dashboard-hell-390.png`, `vorher/buchung-maske-hell-1440.png`.
3. **Typografie ohne Stimme.** Überall Inter, Seitentitel 24 px halbfett, kaum von Kartentiteln zu unterscheiden. Beträge ohne gleich breite Ziffern, teils ohne Tausendertrennung («CHF 2400.00»). Beleg: `vorher/rechnungen-hell-1440.png`.
4. **Uneinheitliche und fehlerhafte Bausteine.** Die Buchungsmaske öffnete ein Modal **im** Modal (doppeltes Overlay). Icon-Knöpfe ohne Beschriftung, darunter das Drei-Punkte-Menü. An 17 Stellen war der Tastaturfokus mit `outline-none` unterdrückt. Belege: `vorher/buchung-maske-hell-1440.png`, Commit `af247a3b`.
5. **Auf dem Handy nur bedingt nutzbar.** Der Seitenkopf des Dashboards lief horizontal über. Die zugeklappte Seitenleiste überdeckte unsichtbar die linken 240 px und schluckte dort jeden Klick. Die Buchungsliste war eine breite Tabelle, und es gab keinen Weg, einen Beleg direkt zu fotografieren. Beleg: `vorher/dashboard-hell-390.png`.

## 2. Tokens

Die Tokens werden **nicht von Hand übernommen**, sondern mit `node scripts/build-tokens.mjs` aus `tokens.json` erzeugt (`src/styles/tokens.css`). Die Farben stehen als RGB-Kanäle, damit Tailwind die Deckkraft bilden kann (z. B. `bg-ink/50`). Tailwind kennt nur diese Tokens; die Standardpalette ist entfernt.

| App-Token | Design-System-Token | Hell | Tiefsee | Rolle im CRM |
|---|---|---|---|---|
| `canvas` | background | #f2f4f7 | #0b1220 | Seitenhintergrund |
| `surface` | surface | #ffffff | #141d30 | Karten, Tabellen, Dialoge |
| `raised` / `sunken` | surface-raised / -sunken | #e8ecf1 / #dfe4eb | #141d30 / #0b1220 | Hover, Badge neutral, Skeleton |
| `ink` | surface-inverted | #0b1220 | #141d30 | Seitenleiste |
| `fg` / `fg-muted` | foreground / -muted | #0b1220 / #4b5566 | #f4f7fb / #aab6c9 | Text / gedämpfter Text |
| `accent` | accent (Tinte) | #0b1220 | #f4f7fb | Primärknopf, aktive Auswahl |
| `cta` | cta | #0a95ff | #0a95ff | **eine** Pill pro Ansicht, Akzentlinien, Marker, Chart «Einnahmen» |
| `line` / `line-strong` | border / -strong | #d9dee6 / #747b87 | #26324a / #747b87 | Trennlinie / Feldrand (3:1) |
| `success` `warning` `danger` (+ `-subtle`) | gleichnamig | | wie Hell | nur als Badge oder Meldung mit Wort |
| `focus` | focus | #0b1220 | #9fdcff | 2 px Fokusring mit 2 px Abstand |

Dazu Radien (`rounded-card` 24 px, `rounded-tile` 16 px, `rounded-lg` 12 px für Felder und Knöpfe, `rounded-badge` 4 px, Pill voll rund) und Schatten (`shadow-card`, `shadow-cta`). Schriften: Albert Sans für Titel, Zahlen, Etiketten und Knöpfe, Montserrat für Text, Tabellen und Formulare, beide selbst gehostet aus `project/fonts/`. Lucide-Icons mit Strich 1.5. Hell und Tiefsee folgen dem System; unter Einstellungen › Benutzerprofil › Darstellung lässt sich das pro Gerät übersteuern.

**Übertragung auf ein Arbeitswerkzeug**, ergänzend zum `README-CRM.md`:

- Statusfarben stehen nur auf ihrer hellen Statusfläche (Badge, Meldung). So bleiben sie auch in Tiefsee lesbar; das Design System sieht sie «nur light» vor.
- Beträge stehen in Tinte. Die Richtung zeigen Zeichen (+ / −), Spalte und Wort, nicht die Farbe.
- Charts: Einnahmen `cta`, Ausgaben Tinte. Die Palettenprüfung (Skill dataviz, `validate_palette.js`) ergab eine Farbsehschwäche-Trennung von ΔE 48.7 (hell) und 31.8 (dunkel). Die generischen Regeln zu Helligkeitsband und Sättigung schlagen bei Tinte an; das ist bewusst so, weil die Marke kein zweites Blau erlaubt. Zusätzlich gibt es Legende und Tooltip mit Text.
- Der Marker steht genau einmal in der App: im Titel des Dashboards.

## 3. Beispiel: Seite Buchungen

| | Vorher | Nachher |
|---|---|---|
| Liste | `vorher/buchungen-hell-1440.png` | `nachher/buchungen-hell-1440.png`, `nachher/buchungen-dunkel-1440.png` |
| Maske | `vorher/buchung-maske-hell-1440.png` | `nachher/buchung-maske-hell-1440.png` |
| Handy | | `nachher/buchungen-hell-390.png`, `nachher/buchung-maske-hell-390.png` |

- **Eine Pill** «Neue Buchung» als Hauptaktion; Zweitwege (Filter, Export) sind neutral.
- **Filter:** Art als Umschalter, Suche nach Text, Lieferant und Nr, Zeitraum.
- **Tabelle:** Datum, Nr, Lieferant/Zahler, Text, Kategorie (neutrales Badge), Betrag in Tinte mit + / −. Ein fehlender Beleg erscheint als Badge «fehlt», das Drei-Punkte-Menü ist beschriftet. Auf dem Handy eine Liste statt der Tabelle.
- **Maske:** ein einziger Dialog mit Fokusfalle und Escape, auf dem Handy als Blatt von unten. Pflichtfelder oben; seltene Felder (Beleg-Nr, Kunde, Projekt, Tags) unter «Weitere Angaben». Auf dem Handy gibt es einen eigenen Knopf «Foto aufnehmen» (`capture="environment"`).

## 4. Abnahme

- **Build, Typecheck, Tests:** `npm run build` und `npm test` grün (93 Tests).
- **Lint:** `npm run lint` mit 0 Fehlern (vorher 78) und 18 Warnungen (`exhaustive-deps`, bereits vorher vorhanden).
- **Kontrast:** `kontrast.md`, alle 48 Paare in Hell und Tiefsee bestanden.
- **Fest codierte Farben:** `farben-suche.md`.
- **Rauchtest:** `node scripts/smoke-pages.mjs` rendert alle 14 Hauptseiten mit Mock-Daten ohne Fehleransicht.
- **Offen, nur von Hand prüfbar:** Kamera auf einem echten Handy (Permissions-Policy `camera=()` betrifft `getUserMedia`, nicht `<input capture>`). Bildschirmleser-Durchgang (VoiceOver).

## 5. Werkzeuge

| Skript | Zweck |
|---|---|
| `scripts/build-tokens.mjs` | erzeugt `src/styles/tokens.css` aus dem Paket |
| `scripts/codemod-colors.mjs` | einmalige Umstellung der Palettenklassen (bereits angewendet) |
| `scripts/codemod-a11y.mjs` | aria-label für Icon-Knöpfe, keine gefüllten Icons (bereits angewendet) |
| `scripts/normalize-page-header.py` | Seitenkopf, Pill, Karten je Seite (bereits angewendet) |
| `scripts/screenshots.mjs` | Screenshots; `MOCK=1` mit Testdaten, sonst mit Sitzung aus `.auth/` |
| `scripts/contrast-check.mjs` | erzeugt `kontrast.md` |
| `scripts/smoke-pages.mjs` | Rauchtest aller Hauptseiten |
