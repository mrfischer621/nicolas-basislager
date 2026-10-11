# Anpassung: helles Thema und satte Statusfarben

Stand 11.10.2026. Screenshots nur mit erfundenen Testdaten (Mock «ZZ Testfirma»).

## 1. Helles Thema als Standard

- **Ursache:** `tokens.css` schaltete per `prefers-color-scheme` auf Tiefsee, sobald macOS im Dunkelmodus läuft.
- **Neu:** Standard ist immer hell. Tiefsee gilt nur, wenn es unter Einstellungen › Benutzerprofil › Darstellung als «Dunkel» gewählt ist (pro Gerät gespeichert).
- **Seitenleiste und Kopfzeile:** hell. Aktiver Menüpunkt auf `accent-subtle` mit 4-px-Linie in `cta`.
- **Umschalter:** aktive Option in Tinte auf Weiss. `cta` mit weisser Schrift hätte nur 3.1:1 und wäre bei 14 px zu schwach.

| | Vorher (Mac im Dunkelmodus) | Nachher (Mac im Dunkelmodus) | Nachher (Thema «Dunkel» gewählt) |
|---|---|---|---|
| Dashboard | `vorher/dashboard-mac-dunkelmodus-1440.png` | `nachher/dashboard-mac-dunkelmodus-1440.png` | `nachher/dashboard-thema-dunkel-gewaehlt-1440.png` |
| Buchungen | `vorher/buchungen-mac-dunkelmodus-1440.png` | `nachher/buchungen-mac-dunkelmodus-1440.png` | `nachher/buchungen-thema-dunkel-gewaehlt-1440.png` |
| Rechnungen | `vorher/rechnungen-hell-1440.png` | `nachher/rechnungen-mac-dunkelmodus-1440.png` | `nachher/rechnungen-thema-dunkel-gewaehlt-1440.png` |
| Auswertungen | `vorher/auswertungen-mac-dunkelmodus-1440.png` | `nachher/auswertungen-mac-dunkelmodus-1440.png` | `nachher/auswertungen-thema-dunkel-gewaehlt-1440.png` |
| Jahresabschluss | `vorher/jahresabschluss-mac-dunkelmodus-1440.png` | `nachher/jahresabschluss-mac-dunkelmodus-1440.png` | `nachher/jahresabschluss-thema-dunkel-gewaehlt-1440.png` |

## 2. Statusfarben (Erweiterung CRM, nicht Teil des Blauwasser Design Systems)

Definiert in `scripts/build-tokens.mjs` (Block `STATUS`) und erzeugt nach `src/styles/tokens.css`. In Tailwind stehen sie als `positive`, `negative`, `warning`, `attention` und `info`.

| Token | satt (`-solid`) | Text hell (`text-…`) | Text Tiefsee | Hintergrund (`-subtle`) | Text darauf (`-on-subtle`) |
|---|---|---|---|---|---|
| positive | #0cb655 | #047a37 | #0cb655 | #e2f9e6 | #047a37 |
| negative | #ed4042 | #cc272e | #ee4b4d | #ffe9e6 | #cc272e |
| warning | #f57400 | #a95009 | #f57400 | #ffecdd | #a95009 |
| attention | #f5c40d | #816500 | #f5c40d | #fbf1d8 | #816500 |
| info | #0a95ff (cta) | Tinte | Tinte hell | #e1f4ff | Tinte |

**Abweichungen vom Vorschlag**, alle technisch begründet:

- **Textvarianten leicht abgedunkelt:** positive #05893e → #047a37, warning #be5a0a → #a95009, attention #8f7000 → #816500. Auf den hellen Hintergründen (Badges, Banner) lagen sie bei 4.07, 3.93 und 4.16:1, jetzt überall über 4.5:1.
- **Rot in Tiefsee aufgehellt:** Als Text dort #ee4b4d, weil #ed4042 auf der dunklen Fläche nur 4.34:1 hält.
- **Satt-Grün auf Weiss nur 2.68:1:** Die Einnahmen-Balken tragen deshalb eine Kontur in der Textvariante (5.47:1).
- **Rot gegen Grün** ist bei Deuteranopie nicht unterscheidbar (Palettenprüfung ΔE 4.2). Zweite Kennzeichnung überall: Ausgaben-Balken schraffiert, Vorzeichen + / −, Pfeil-Icons, Wörter in Badges, Legende und Tooltip.

**Wo die Farben stehen:**

- **Kennzahlen** (Dashboard, Auswertung): Akzentlinie, Icon-Kachel und Betrag in der Farbe; Ergebnis grün bei Gewinn, rot bei Verlust.
- **Charts:** Einnahmen grün, Ausgaben rot schraffiert, Tooltip mit Vorzeichen und CHF.
- **Buchungsliste:** Beträge grün mit + und Pfeil, rot mit − und Pfeil; Typ-Badge Einnahme/Ausgabe; Badge «Beleg fehlt» orange.
- **Rechnungen und Offerten:** bezahlt/akzeptiert grün, versendet info, überfällig/abgelehnt rot, Entwurf/offen grau, fällig in 7 Tagen gelb.
- **Warnbanner:** heller orange Hintergrund, 4-px-Linie und Icon satt, Text in Tinte, Link in der Textvariante.
- **Jahresabschluss › Kontrollen:** Fehler rot, Hinweise orange, alles in Ordnung grün, jeweils mit Wort und Icon.

**Kontrast:** `../kontrast.md` (aus `node scripts/contrast-check.mjs`), alle Paare bestanden.
