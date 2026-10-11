# Kontrastpruefung (WCAG 2.2 AA)

Erzeugt mit `node scripts/contrast-check.mjs` aus `src/styles/tokens.css`. Mindestwerte: Text 4.5:1, grosse fette Schrift und Nicht-Text (Raender, Fokus, Grafik) 3:1.

## Hell

| Text / Vordergrund | Hintergrund | Verwendung | Kontrast | Minimum | Ergebnis |
|---|---|---|---|---|---|
| `fg` #0b1220 | `canvas` #f2f4f7 | Fliesstext, Titel auf dem Grund | 16.99:1 | 4.5:1 | bestanden |
| `fg` #0b1220 | `surface` #ffffff | Text in Karten, Tabellen, Formularen | 18.72:1 | 4.5:1 | bestanden |
| `fg` #0b1220 | `raised` #e8ecf1 | Text auf getoenter Flaeche (Hover, Badge neutral) | 15.78:1 | 4.5:1 | bestanden |
| `fg-muted` #4b5566 | `canvas` #f2f4f7 | Gedaempfter Text auf dem Grund | 6.83:1 | 4.5:1 | bestanden |
| `fg-muted` #4b5566 | `surface` #ffffff | Gedaempfter Text in Karten | 7.53:1 | 4.5:1 | bestanden |
| `fg-muted` #4b5566 | `raised` #e8ecf1 | Gedaempfter Text auf getoenter Flaeche | 6.34:1 | 4.5:1 | bestanden |
| `fg-subtle` #6b7485 | `surface` #ffffff | Platzhalter in Eingabefeldern | 4.71:1 | 4.5:1 | bestanden |
| `fg` #0b1220 | `accent-subtle` #e4f5ff | Text auf hellblauer Hinterlegung (Badge, Auswahl) | 16.76:1 | 4.5:1 | bestanden |
| `accent-fg` #ffffff | `accent` #0b1220 | Primaerknopf, aktiver Umschalter | 18.72:1 | 4.5:1 | bestanden |
| `cta-fg` #ffffff | `cta` #0a95ff | Pill (nur grosse, fette Versalien, dokumentierte Ausnahme) | 3.11:1 | 3:1 | bestanden |
| `fg-inverted` #f4f7fb | `ink` #0b1220 | Seitenleiste: aktiver Punkt, Firmenname | 17.42:1 | 4.5:1 | bestanden |
| `fg-inverted-muted` #aab6c9 | `ink` #0b1220 | Seitenleiste: Menuepunkte, Gruppentitel | 9.13:1 | 4.5:1 | bestanden |
| `fg-inverted` #f4f7fb | `ink-raised` #141d30 | Seitenleiste: aktiver/gehoverter Punkt | 15.66:1 | 4.5:1 | bestanden |
| `fg-inverted-muted` #aab6c9 | `ink-raised` #141d30 | Seitenleiste: Hover | 8.21:1 | 4.5:1 | bestanden |
| `line-strong` #747b87 | `surface` #ffffff | Rand von Eingabefeldern (Nicht-Text, 1.4.11) | 4.26:1 | 3:1 | bestanden |
| `line-strong` #747b87 | `canvas` #f2f4f7 | Rand von Umschaltern auf dem Grund (1.4.11) | 3.87:1 | 3:1 | bestanden |
| `focus` #0b1220 | `surface` #ffffff | Fokusring auf Karten (2.4.13 / 1.4.11) | 18.72:1 | 3:1 | bestanden |
| `focus` #0b1220 | `canvas` #f2f4f7 | Fokusring auf dem Grund | 16.99:1 | 3:1 | bestanden |
| `focus-inverted` #9fdcff | `ink` #0b1220 | Fokusring in der Seitenleiste | 12.62:1 | 3:1 | bestanden |
| `positive-text` #047a37 | `surface` #ffffff | Betrag Einnahme/Gewinn, Kennzahl (Text) | 5.46:1 | 4.5:1 | bestanden |
| `positive-text` #047a37 | `canvas` #f2f4f7 | Text gruen auf dem Grund | 4.96:1 | 4.5:1 | bestanden |
| `negative-text` #cc272e | `surface` #ffffff | Betrag Ausgabe/Verlust, Kennzahl (Text) | 5.39:1 | 4.5:1 | bestanden |
| `negative-text` #cc272e | `canvas` #f2f4f7 | Text rot auf dem Grund | 4.89:1 | 4.5:1 | bestanden |
| `warning-text` #a95009 | `surface` #ffffff | Text orange auf Papier | 5.47:1 | 4.5:1 | bestanden |
| `attention-text` #816500 | `surface` #ffffff | Text gelb auf Papier | 5.53:1 | 4.5:1 | bestanden |
| `positive-on-subtle` #047a37 | `positive-subtle` #e2f9e6 | Badge bezahlt/Einnahme, Kontrolle in Ordnung | 4.92:1 | 4.5:1 | bestanden |
| `negative-on-subtle` #cc272e | `negative-subtle` #ffe9e6 | Badge ueberfaellig/Ausgabe, Kontrolle Fehler | 4.63:1 | 4.5:1 | bestanden |
| `warning-on-subtle` #a95009 | `warning-subtle` #ffecdd | Badge Beleg fehlt, Warnbanner-Link, Hinweis | 4.77:1 | 4.5:1 | bestanden |
| `attention-on-subtle` #816500 | `attention-subtle` #fbf1d8 | Badge faellig bald | 4.92:1 | 4.5:1 | bestanden |
| `info-on-subtle` #0b1220 | `info-subtle` #e1f4ff | Badge versendet | 16.57:1 | 4.5:1 | bestanden |
| `cta-fg` #ffffff | `negative-on-subtle` #cc272e | Knopf Loeschen im Bestaetigungsdialog (weiss auf Rot) | 5.39:1 | 4.5:1 | bestanden |
| `fg-on-light` #0b1220 | `warning-subtle` #ffecdd | Text im Warnbanner / Hinweis | 16.31:1 | 4.5:1 | bestanden |
| `fg-on-light` #0b1220 | `negative-subtle` #ffe9e6 | Text in Kontrolle Fehler | 16.09:1 | 4.5:1 | bestanden |
| `fg-on-light` #0b1220 | `positive-subtle` #e2f9e6 | Text in Kontrolle In Ordnung | 16.87:1 | 4.5:1 | bestanden |
| `positive-text` #047a37 | `surface` #ffffff | Chart: Kontur der Einnahmen-Balken (Grafik, 1.4.11) | 5.46:1 | 3:1 | bestanden |
| `negative-text` #cc272e | `surface` #ffffff | Chart: Kontur der Ausgaben-Balken (Grafik, 1.4.11) | 5.39:1 | 3:1 | bestanden |
| `negative` #ed4042 | `surface` #ffffff | Chart: Fuellung Ausgaben (Grafik, 1.4.11) | 3.88:1 | 3:1 | bestanden |
| `warning` #f57400 | `warning-subtle` #ffecdd | Warnbanner: Linie und Icon (dekorativ, Text traegt die Aussage) | 2.48:1 | 1:1 | bestanden |

## Tiefsee (dunkel)

| Text / Vordergrund | Hintergrund | Verwendung | Kontrast | Minimum | Ergebnis |
|---|---|---|---|---|---|
| `fg` #f4f7fb | `canvas` #0b1220 | Fliesstext, Titel auf dem Grund | 17.42:1 | 4.5:1 | bestanden |
| `fg` #f4f7fb | `surface` #141d30 | Text in Karten, Tabellen, Formularen | 15.66:1 | 4.5:1 | bestanden |
| `fg` #f4f7fb | `raised` #141d30 | Text auf getoenter Flaeche (Hover, Badge neutral) | 15.66:1 | 4.5:1 | bestanden |
| `fg-muted` #aab6c9 | `canvas` #0b1220 | Gedaempfter Text auf dem Grund | 9.13:1 | 4.5:1 | bestanden |
| `fg-muted` #aab6c9 | `surface` #141d30 | Gedaempfter Text in Karten | 8.21:1 | 4.5:1 | bestanden |
| `fg-muted` #aab6c9 | `raised` #141d30 | Gedaempfter Text auf getoenter Flaeche | 8.21:1 | 4.5:1 | bestanden |
| `fg-subtle` #aab6c9 | `surface` #141d30 | Platzhalter in Eingabefeldern | 8.21:1 | 4.5:1 | bestanden |
| `fg` #f4f7fb | `accent-subtle` #141d30 | Text auf hellblauer Hinterlegung (Badge, Auswahl) | 15.66:1 | 4.5:1 | bestanden |
| `accent-fg` #0b1220 | `accent` #f4f7fb | Primaerknopf, aktiver Umschalter | 17.42:1 | 4.5:1 | bestanden |
| `cta-fg` #ffffff | `cta` #0a95ff | Pill (nur grosse, fette Versalien, dokumentierte Ausnahme) | 3.11:1 | 3:1 | bestanden |
| `fg-inverted` #f4f7fb | `ink` #141d30 | Seitenleiste: aktiver Punkt, Firmenname | 15.66:1 | 4.5:1 | bestanden |
| `fg-inverted-muted` #aab6c9 | `ink` #141d30 | Seitenleiste: Menuepunkte, Gruppentitel | 8.21:1 | 4.5:1 | bestanden |
| `fg-inverted` #f4f7fb | `ink-raised` #141d30 | Seitenleiste: aktiver/gehoverter Punkt | 15.66:1 | 4.5:1 | bestanden |
| `fg-inverted-muted` #aab6c9 | `ink-raised` #141d30 | Seitenleiste: Hover | 8.21:1 | 4.5:1 | bestanden |
| `line-strong` #747b87 | `surface` #141d30 | Rand von Eingabefeldern (Nicht-Text, 1.4.11) | 3.95:1 | 3:1 | bestanden |
| `line-strong` #747b87 | `canvas` #0b1220 | Rand von Umschaltern auf dem Grund (1.4.11) | 4.39:1 | 3:1 | bestanden |
| `focus` #9fdcff | `surface` #141d30 | Fokusring auf Karten (2.4.13 / 1.4.11) | 11.34:1 | 3:1 | bestanden |
| `focus` #9fdcff | `canvas` #0b1220 | Fokusring auf dem Grund | 12.62:1 | 3:1 | bestanden |
| `focus-inverted` #9fdcff | `ink` #141d30 | Fokusring in der Seitenleiste | 11.34:1 | 3:1 | bestanden |
| `positive-text` #0cb655 | `surface` #141d30 | Betrag Einnahme/Gewinn, Kennzahl (Text) | 6.28:1 | 4.5:1 | bestanden |
| `positive-text` #0cb655 | `canvas` #0b1220 | Text gruen auf dem Grund | 6.99:1 | 4.5:1 | bestanden |
| `negative-text` #ee4b4d | `surface` #141d30 | Betrag Ausgabe/Verlust, Kennzahl (Text) | 4.61:1 | 4.5:1 | bestanden |
| `negative-text` #ee4b4d | `canvas` #0b1220 | Text rot auf dem Grund | 5.13:1 | 4.5:1 | bestanden |
| `warning-text` #f57400 | `surface` #141d30 | Text orange auf Papier | 5.91:1 | 4.5:1 | bestanden |
| `attention-text` #f5c40d | `surface` #141d30 | Text gelb auf Papier | 10.24:1 | 4.5:1 | bestanden |
| `positive-on-subtle` #047a37 | `positive-subtle` #e2f9e6 | Badge bezahlt/Einnahme, Kontrolle in Ordnung | 4.92:1 | 4.5:1 | bestanden |
| `negative-on-subtle` #cc272e | `negative-subtle` #ffe9e6 | Badge ueberfaellig/Ausgabe, Kontrolle Fehler | 4.63:1 | 4.5:1 | bestanden |
| `warning-on-subtle` #a95009 | `warning-subtle` #ffecdd | Badge Beleg fehlt, Warnbanner-Link, Hinweis | 4.77:1 | 4.5:1 | bestanden |
| `attention-on-subtle` #816500 | `attention-subtle` #fbf1d8 | Badge faellig bald | 4.92:1 | 4.5:1 | bestanden |
| `info-on-subtle` #0b1220 | `info-subtle` #e1f4ff | Badge versendet | 16.57:1 | 4.5:1 | bestanden |
| `cta-fg` #ffffff | `negative-on-subtle` #cc272e | Knopf Loeschen im Bestaetigungsdialog (weiss auf Rot) | 5.39:1 | 4.5:1 | bestanden |
| `fg-on-light` #0b1220 | `warning-subtle` #ffecdd | Text im Warnbanner / Hinweis | 16.31:1 | 4.5:1 | bestanden |
| `fg-on-light` #0b1220 | `negative-subtle` #ffe9e6 | Text in Kontrolle Fehler | 16.09:1 | 4.5:1 | bestanden |
| `fg-on-light` #0b1220 | `positive-subtle` #e2f9e6 | Text in Kontrolle In Ordnung | 16.87:1 | 4.5:1 | bestanden |
| `positive-text` #0cb655 | `surface` #141d30 | Chart: Kontur der Einnahmen-Balken (Grafik, 1.4.11) | 6.28:1 | 3:1 | bestanden |
| `negative-text` #ee4b4d | `surface` #141d30 | Chart: Kontur der Ausgaben-Balken (Grafik, 1.4.11) | 4.61:1 | 3:1 | bestanden |
| `negative` #ed4042 | `surface` #141d30 | Chart: Fuellung Ausgaben (Grafik, 1.4.11) | 4.34:1 | 3:1 | bestanden |
| `warning` #f57400 | `warning-subtle` #ffecdd | Warnbanner: Linie und Icon (dekorativ, Text traegt die Aussage) | 2.48:1 | 1:1 | bestanden |


Alle Paare bestehen.

## Hinweise zur Erweiterung (Statusfarben)

- Die satten Farben (`positive` #0cb655, `negative` #ed4042, `warning` #f57400, `attention` #f5c40d) sind fuer Flaechen, Balken, Linien und Icons. Satt-Gruen haelt auf Weiss nur 2.68:1, darum tragen die Einnahmen-Balken eine Kontur in der Textvariante (5.47:1). Icons in Kacheln und die Linie im Warnbanner sind dekorativ (aria-hidden), die Aussage steht als Text daneben.
- Textvarianten gegenueber dem Vorschlag: positive #05893e auf #047a37, warning #be5a0a auf #a95009, attention #8f7000 auf #816500 abgedunkelt, damit sie auch auf den hellen Hintergruenden 4.5:1 halten (vorher 4.07, 3.93 und 4.16:1). negative #cc272e unveraendert.
- Rot gegen Gruen: Die Palettenpruefung (dataviz, validate_palette.js) ergibt bei Deuteranopie dE 4.2, also nicht unterscheidbar. Zweite Kennzeichnung ueberall: Ausgaben-Balken schraffiert, Vorzeichen + / −, Pfeil-Icons, Woerter (Einnahme/Ausgabe, Gewinn/Verlust) in Badges, Legende und Tooltip.
