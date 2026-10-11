# Blauwasser Design System: Paket für das CRM

Export aus dem Blauwasser Design System (Claude, Stand 2. Oktober 2026). Diesen Ordner als `design-system/blauwasser/` ins CRM-Repository legen.

## Inhalt

- `project/README.md`: die verbindlichen Regeln der Gestaltung "Plakatform" (Farbe, Schrift, Marker, Fläche, Ikonografie, Logo, Bewegung, Sprache)
- `project/tokens.json`: alle Tokens (Farben für die Themen `light` und `dark`, Typografie, Abstände, Radien, Schatten, Linien, Marker)
- `project/components/bundle.css`: Referenzumsetzung der Bausteine als CSS (Pill, Karte, Kennzahl, Badge, Checkliste, Verteilungsbalken)
- `project/components/*/README.md`: Regeln einzelner Bausteine (Pill, Marker, Kennzahlkarte)
- `project/fonts/`: Albert Sans (400 bis 900) und Montserrat (400 bis 700) als woff2
- `logos/`: Wortmarke schwarz und weiss (PNG, Querformat 920 x 174 px), Zeichen "B" in Blau, Tinte, Weiss (SVG), App-Icons (SVG)

## Übertragung auf ein Arbeitswerkzeug

Die Plakatform ist für Website, Logbuch und Grafiken gebaut. Für das CRM gilt sie sinngemäss:

- Farben, Schriften, Radien, Schatten, Fokus und Icons 1:1 aus den Tokens.
- Versalien in Albert Sans 900 nur für Seitentitel und kleine Etiketten (`caps-sm`). Tabellen, Formulare und Fliesstext in Montserrat, gemischt geschrieben.
- Ein Hellblau `cta` (#0a95ff) für die eine Hauptaktion pro Ansicht. Kein zweites Blau, kein Verlauf.
- Fliesstext nie in `cta` auf hellem Grund. Links als `bw-textlink` (Tinte, hellblau unterstrichen).
- Der Marker höchstens einmal pro Seite, zum Beispiel im Dashboard-Titel. In Tabellen und Formularen nie.
- Bänder, Polarnetz, Route und Randnotiz sind Marketing-Motive und gehören nicht ins CRM, ausser allenfalls dezent auf der Login-Seite.
- Statusfarben (`success`, `warning`, `danger`) immer mit Wort, nie nur Farbe.
