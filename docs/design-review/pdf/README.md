# Rechnung und Offerte im Blauwasser-Design

Muster mit erfundenen Testdaten, erzeugt mit dem echten Generator:
`LOGO=design-system/blauwasser/logos/blauwasser-wortmarke-schwarz.png node scripts/pdf-muster/render.mjs docs/design-review/pdf`
(Dev-Server auf :5173; `MANY=1` erzeugt eine mehrseitige Rechnung).

- `muster-rechnung-mit-logo.pdf` (Seite 1: Rechnung, Seite 2: QR-Rechnung)
- `muster-offerte-mit-logo.pdf` (mit Rabatt)

## Gestaltung

- **Schriften:** Albert Sans 900 für den Titel und das Total; Albert Sans 700 für Etiketten, Spaltenköpfe und den Absender; Montserrat für Text und Tabelle. Bisher erschien überall Helvetica, weil die Montserrat-TTF fehlten.
- **Farben:**
  - Tinte #0b1220 für Text, gedämpft #4b5566 für Etiketten und Zusatztexte.
  - Haarlinien #d9dee6 zwischen den Positionen, eine Linie in Tinte unter dem Tabellenkopf.
  - Hellblau #0a95ff einzig als **senkrechte** Akzentlinie links am Total.
  - **Keine farbigen Unterstreichungen, kein Marker** (Vorgabe 11.10.2026). Das bisherige Salbeigrün ist entfernt.
- **Aufbau:**
  - Absender oben links, Logo oben rechts (höchstens 18 × 60 mm).
  - Absenderzeile klein über der Empfängeradresse. Die Adresse steht unverändert an der Fensterposition (x 20 mm, y 55 mm).
  - Titel in Versalien, darunter die Metadaten als Spalten: Nr., Datum, Zahlbar bis bzw. Gültig bis, UID.
  - Tabelle mit Positionstitel fett und Beschreibung gedämpft.
  - Summenblock mit dem Total auf getönter Fläche.
  - Fusszeile auf jeder Seite in drei Spalten: Absender, Bank/UID/MWST, Kontakt. Bei mehrseitigen Dokumenten kommt «Seite x von y» dazu.
- **Begriffe:** «Offerte» statt «Angebot» im Dokument und im Dateinamen, passend zur App.
- **QR-Rechnung:** unverändert und immer in Helvetica, wie es die Swiss Payment Standards verlangen.
