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

## QR-Rechnung (Zahlteil mit Empfangsschein)

Geprüft gegen die **Implementation Guidelines QR-Rechnung 2.3** (gültig ab 21.11.2025) und den **Style Guide QR-Rechnung 1.1** (gültig ab 01.01.2026). Vorschau: `qr-rechnung-zahlteil.png`, gerendert mit Apple PDFKit.

- **Raster nach Style Guide Seite 6, in mm:**
  - Empfangsschein 62 breit (5 + 52 + 5), in der Höhe Titel 7, Angaben 56, Betrag 14 und Annahmestelle 18.
  - Zahlteil 148 breit (5 + 51 + 87 + 5), in der Höhe Titel 7, QR-Bereich 56, Betrag 22 und Weitere Informationen 10.
  - Rand oben und unten je 5.
- **Swiss QR Code:**
  - Vektorgrafik, exakt 46 × 46 mm bei x 67 / y 209 mm.
  - Fehlerkorrekturstufe M.
  - Schweizerkreuz 7 × 7 mm mittig auf weisser Grundfläche.
  - Ein automatischer Test misst die Lage im erzeugten PDF nach (`src/utils/qrBillLayout.test.ts`).
- **Schrift nach Style Guide Seite 15:** nur Helvetica in Schwarz.

  | Teil | Titel | Überschriften | Werte | Betrag | Sonstiges |
  |---|---|---|---|---|---|
  | Empfangsschein | 11 pt fett | 6 pt fett, Zeilenabstand 9 pt | 8 pt, Zeilenabstand 9 pt | 8 pt, Zeilenabstand 11 pt | Annahmestelle 6 pt fett, rechtsbündig |
  | Zahlteil | 11 pt fett | 8 pt fett, Zeilenabstand 11 pt | 10 pt, Zeilenabstand 11 pt | 10 pt, Zeilenabstand 13 pt | |

  Zwischen den Blöcken steht je eine Leerzeile.
- **Inhalt:** Gedruckt wird nur, was im QR-Code steht, und zwar eins zu eins.
  - Die Fälligkeit steht deshalb in der Mitteilung («Rechnung RE-…, zahlbar bis …»). Vorher stand «Fällig: …» im Zahlteil, aber nicht im Code.
  - Der Empfänger wird so gedruckt, wie er im Code steht. Vorher wichen gedruckter Name und QR-Inhalt voneinander ab.
- **Betrag:** Im Code steht derselbe, auf 5 Rappen gerundete Betrag wie im Total der Rechnung. Vorher stand dort der ungerundete Betrag.
- **Trennung im PDF:** gestrichelte Linien und der Hinweis «Vor der Einzahlung abzutrennen» über der Linie (IG Kap. 3.7). Das bisherige Scherensymbol fehlte in Helvetica und erschien als Strich.
- **Datenteil:**
  - 31 Elemente, Ende mit `EPD` ohne Zeilenschaltung. Die nicht verwendeten Elemente vom Status «A» sind weggelassen.
  - Nur strukturierte Adressen (Typ «S»). Ohne Zahlungspflichtigen bleibt der Adress-Typ leer.
- **Leerfelder:** Eckmarken für fehlenden Betrag oder Zahlungspflichtigen sind vorbereitet (0.75 pt, 40 × 15 und 65 × 25 mm im Zahlteil, 30 × 10 und 52 × 20 mm im Empfangsschein), werden aber nicht genutzt, weil Rechnungen immer beides enthalten.
