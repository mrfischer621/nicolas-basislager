Blauwasser IT ist die Einzelfirma von Nicolas Fischer in Frauenfeld: KI, Prozessautomatisierung und Reporting für Schweizer KMU. Die Gestaltung heisst **Plakatform**: grosse Versalien, viel Luft, Tinte auf kühlem Grau, ein einziges Hellblau und ein Textmarker. Sie gilt für die Website, das Logbuch «Die KMU-Expedition» und jede Grafik, Folie oder Video-Einblendung.

## Die Regel vor allen anderen: keine erfundenen Fakten

- Keine erfundenen Kundennamen, Zahlen, Prozentwerte, Projektzahlen, Jahreszahlen, Teamgrössen, Zertifikate, Auszeichnungen, Logos oder Bewertungen.
- **Es gibt genau drei Kundenstimmen** (Samuel, Irina, Ladina). Sie werden wörtlich verwendet oder gar nicht.
- **Es gibt genau diese Preise:** gemeinsame Analyse 490 Franken, Startprojekt ab 4'490 Franken, «Pro Monat maximal 5 Analysen.» Keine Rabatte, keine Rechenbeispiele.
- **Kein Team.** Die Stimme sagt «wir», aber nie «unser Team», Angestellte, Büros oder Teamfotos. Nicolas ist «Inhaber, Blauwasser IT», dazu ein Netz aus Freelancern.
- Studienzahlen nur mit Quelle darunter (z. B. «Quelle: AXA KMU-Arbeitsmarktstudie 2026, Sotomo, 336 KMU, März 2026»).
- Die Anwendungsfälle aus den Strategiepapieren (Treuhand, Sanitär, Outdoor-Shop, Gastro-Grosshandel, Metallbau) sind konstruierte Beispiele. Sie erscheinen nie so, dass man sie als Referenz lesen kann.

## Sprache

- Deutsch, Schweizer Rechtschreibung, durchgehend **du**. **ss statt ß**, ausnahmslos. Zahlen mit Hochkomma: `4'490`, `15'000`.
- **Keine Gedankenstriche** (– oder —) im Text. Stattdessen Komma, Doppelpunkt oder Punkt.
- Ton: klar und ruhig, mit leicht eigenwilliger, persönlicher Note. Kein Hype, keine Konzernsprache, keine Nerdigkeit, keine Aggressivität.
- Die Marke verkauft **keine Freizeit**. Zeit ist betrieblicher Nutzen: «mehr Zeit für das Kerngeschäft», «weniger Abtippen». Nie Entspannung, nie Feierabend.
- Der Claim **«Wir optimieren deine Balance zwischen Menschen und Technologie»** steht wörtlich, wird nie umformuliert, nie übersetzt und ist nie die H1. Der Leitsatz **«Erst der Mensch, danach die Technik.»** trägt Abschlüsse und Rückseiten.
- Echte Formulierungen als Richtschnur: «Willst du mehr Zeit für das Kerngeschäft, mit demselben Team?» · «Das Problem liegt selten in einem System. Es liegt dazwischen.» · «KI übernimmt Arbeit. Nicht Verantwortung.» · «Hype ist auf einer Expedition schlechtes Gepäck.»
- Das Logbuch erzählt in Expeditionsbildern (Ziel, Terrain, Hindernisse, Ausrüstung, Basislager, Navigation, nächste Route).

## Farbe

Zwei Themen: `light` (Grund, Standard für Website und Logbuch hell) und `dark` (Tiefsee, dunkles Logbuch, Video).

- **Ein einziges Hellblau: `cta` (#0a95ff).** Es trägt Pill, Marker, Häkchenpunkt, 4-px-Akzentlinien, Nummern, Route, Randnotiz und Ankündigungsleiste. Es gibt keinen Verlauf und kein zweites Blau. `cta-hover`, `accent-subtle` und `accent-border` sind nur Zustände und Tönungen davon.
- Tinte `foreground` (#0b1220) für Text; dieselbe Farbe als Fläche `surface-inverted` für das dunkle Band, die Leiste, den Footer und die dunkle Hälfte der Angebotskarte.
- Grund `background` (#f2f4f7) und Papier `surface` (#ffffff) wechseln sich als Bänder ab.
- Gedämpfter Text in `foreground-muted`, leiser in `foreground-subtle` (nur Quellen und Fussnoten), auf Tinte `foreground-inverted-muted`.
- **Fliesstext steht nie in `cta` auf hellem Grund** (2.8:1). Auf Tinte hält `cta` 6.0:1, deshalb wird dort die Pointe eines Titels hellblau.
- Weiss auf `cta` hält 3.1:1: dokumentierte Ausnahme, nur für grosse, fette Versalien (Pill, Häkchen, Ankündigung).
- Statusfarben (`success`, `warning`, `danger`) nur auf hellen Flächen und immer mit Wort. `friction` (Zeitfresser) markiert Reibung im Logbuch.
- Fokus: 2 px solid `focus`, 2 px Abstand; auf Tinte `focus-on-inverted`.

## Schrift

- **Albert Sans** für Titel, Zahlen, Etiketten, Knöpfe (`display`). **Montserrat** für Fliesstext und Vorspann (`body`). **Caveat** nur für die Unterschrift und die Randnotiz (`hand`), nie für Titel oder Text.
- Titel immer in Versalien, sehr fett (900), eng: `poster` (H1, einmal pro Seite), `poster-sm` (H2), `caps` (H3 in Karten). Versalien kommen aus der Gestaltung, nie aus dem Text. Wörter, die nicht umbrechen dürfen («IT‑Projekt»), bekommen U+2011.
- Gemischt geschrieben: `statement` (zweifarbige Aussage), `quote` (Zitat), Fragen der FAQ.
- Kleine Etiketten `caps-sm`: Versalien, 800, Sperrung 0.12em, gedämpft.
- Text: `lead` für den Vorspann, `body` (17 px, Zeilenhöhe 1.6, 65ch), `body-sm` in Karten.
- Druck (Logbuch A4) nutzt die Gruppe «Logbuch A4», Video die Gruppe «Overlay 1080p».

## Der Marker

Das Erkennungszeichen: ein hellblauer Balken hinter der unteren Hälfte einzelner Wörter eines Titels (`marker-from` 58 % bis `marker-to` 92 %). **Ein Marker pro Titel und pro Seite, Grafik oder Szene**, immer auf der Pointe. Auf Tinte wird das Wort stattdessen hellblau; nur Cover, Kapitelkarte und Abspann behalten den Balken auf Tinte (`bw-marker--force`).

## Fläche, Raster, Form

- Jede Sektion ist ein **Band** über die volle Breite, ohne Linien dazwischen; Inhalt im Rahmen `frame` (1180 px), Seitenrand 4vw. Ein dunkles Band höchstens einmal pro Seite.
- Abstände auf der 4-px-Skala: `space-stack` innerhalb eines Blocks, `space-stack-lg` zwischen Blöcken, `space-section` zwischen Bändern. Logbuch: Raster `raster` 4 mm, Satzspiegel 20 / 18 / 18 mm.
- Radien: Karten und Fotos `radius-card` (24 px), Icon-Kachel `radius-tile` (16 px), Eingabefelder `radius-lg`, Nummernschild `radius-badge` (4 px), Pill `radius-full`. Bänder haben keine Rundung.
- Tiefe: weisse Karten `shadow-card`, die Pill `shadow-cta`, die Angebotskarte `shadow-offer`. Flächen und Bänder bleiben schattenlos.
- Linien: Hairline `border`, Akzentlinie `border-accent` (4 px `cta`) an Kennzahlen und Spalten, gestrichelt unter Fragen und im Kartenfuss.
- **Eine Pill pro Band.** Ein Zweitweg ist ein Textlink, nie ein zweiter Knopf.

## Bilder und Motive

- Nur eigene Fotos: Nicolas, die Expedition (Beagle Channel, Antarktis, Segelschiff, Brücke), das Logbuch-Mockup. **Keine Stockfotos von Menschen, keine Roboter, keine leuchtenden Gehirne, keine KI-Neuronen.**
- Fotos tragen `radius-card` und den versetzten blauen Block (`FotoVersatz`).
- Motive der Marke: die **Route** (gestrichelte Welle in `cta` mit sieben Linienillustrationen), das **Polarnetz** (Kreise und Meridiane als leise Textur) und die **Randnotiz** in Handschrift.
- Diagramme: ein Verteilungsbalken, höchstens drei Teile, Zahlen mit Wort und Quelle.

## Ikonografie

- Linien-Icons aus Lucide, 24er Raster, **Strich 1.5**, runde Enden; im Häkchenpunkt Strich 3. Gruppe `Icons` (SVG in Tinte). Inline gesetzt übernehmen sie `currentColor`; in der Icon-Kachel stehen sie in `cta` auf `accent-subtle`.
- Keine Emoji, kein Icon-Paket, keine gefüllten Icons. Pfeil rechts in Knöpfen, Chevron in Fragen, Häkchen in Listen.

## Logo

- Wortmarke **schwarz** auf hellen Flächen (Leiste hell, Logbuch-Kopf), **weiss** auf Tinte (Leiste, Footer, Video). Das Zeichen «B» allein in **Blau** (`cta`), Tinte oder Weiss, oder als App-Icon (weisses B auf `cta` oder Tinte).
- Logo nie einfärben, verzerren, mit Verlauf versehen oder nachzeichnen; nur die Dateien der Gruppe `Logos` verwenden.
- Höhen: Leiste 36 px, Logbuch-Kopf 4.5 mm, Video-Ecke 44 px, Abspann 72 px.

## Bewegung

- Blöcke gleiten 30 px hoch und blenden ein (800 ms, `cubic-bezier(0, 0, 0.58, 1)`), Karten 50 px, je 200 ms versetzt.
- Der Marker fährt in 2 s von links aus. Die Aussage füllt sich Wort für Wort von Grau zu Tinte. Zitate gleiten alle 5 s.
- Knöpfe: Label rutscht beim Hover nach oben, Kopie von unten (240 ms). Keine Federn, kein Hüpfen, keine Partikel.
- Unter `prefers-reduced-motion` nur kurzes Überblenden.

## Grafiken und Video-Overlays bauen

1. Lade `tokens.css` und `components/bundle.css` und lege den Inhalt in einen Container mit Klasse `bw` (auf Tinte zusätzlich `bw-on-ink`, im dunklen Thema `data-theme="dark"`).
2. Setze Bausteine aus den Komponenten zusammen: Titel mit Marker, Kennzahl, Zitat, Route, Polarnetz. Grössen nur über die Typo-Klassen.
3. Formate: Video 1920 x 1080 (`bw-frame`), Hochformat 1080 x 1920 (`bw-frame--portrait`), Feed 1080 x 1350 (`bw-frame--feed`). Titelsicherheit 96 px zum Rand; im Hochformat unten 200 px frei für Bedienelemente der Plattformen.
4. Für Video-Einblendungen den Hintergrund transparent lassen und das HTML in einem Headless-Browser als PNG-Sequenz oder ProRes 4444 mit Alpha rendern (z. B. Playwright oder Remotion).
5. Pro Bild: ein Titel, ein Marker, höchstens eine Pill, höchstens eine Randnotiz.
