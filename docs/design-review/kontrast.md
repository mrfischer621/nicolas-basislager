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
| `success` #0c6944 | `success-subtle` #e1f6ea | Badge/Meldung Erfolg | 5.95:1 | 4.5:1 | bestanden |
| `warning` #865901 | `warning-subtle` #fef1d6 | Badge/Meldung Warnung | 5.45:1 | 4.5:1 | bestanden |
| `danger` #a91f1f | `danger-subtle` #ffebe9 | Badge/Meldung Fehler | 6.31:1 | 4.5:1 | bestanden |
| `line-strong` #747b87 | `surface` #ffffff | Rand von Eingabefeldern (Nicht-Text, 1.4.11) | 4.26:1 | 3:1 | bestanden |
| `line-strong` #747b87 | `canvas` #f2f4f7 | Rand von Umschaltern auf dem Grund (1.4.11) | 3.87:1 | 3:1 | bestanden |
| `focus` #0b1220 | `surface` #ffffff | Fokusring auf Karten (2.4.13 / 1.4.11) | 18.72:1 | 3:1 | bestanden |
| `focus` #0b1220 | `canvas` #f2f4f7 | Fokusring auf dem Grund | 16.99:1 | 3:1 | bestanden |
| `focus-inverted` #9fdcff | `ink` #0b1220 | Fokusring in der Seitenleiste | 12.62:1 | 3:1 | bestanden |
| `cta` #0a95ff | `surface` #ffffff | Chart: Einnahmen-Balken (Grafik, 1.4.11) | 3.11:1 | 3:1 | bestanden |
| `fg` #0b1220 | `surface` #ffffff | Chart: Ausgaben-Balken (Grafik, 1.4.11) | 18.72:1 | 3:1 | bestanden |

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
| `success` #0c6944 | `success-subtle` #e1f6ea | Badge/Meldung Erfolg | 5.95:1 | 4.5:1 | bestanden |
| `warning` #865901 | `warning-subtle` #fef1d6 | Badge/Meldung Warnung | 5.45:1 | 4.5:1 | bestanden |
| `danger` #a91f1f | `danger-subtle` #ffebe9 | Badge/Meldung Fehler | 6.31:1 | 4.5:1 | bestanden |
| `line-strong` #747b87 | `surface` #141d30 | Rand von Eingabefeldern (Nicht-Text, 1.4.11) | 3.95:1 | 3:1 | bestanden |
| `line-strong` #747b87 | `canvas` #0b1220 | Rand von Umschaltern auf dem Grund (1.4.11) | 4.39:1 | 3:1 | bestanden |
| `focus` #9fdcff | `surface` #141d30 | Fokusring auf Karten (2.4.13 / 1.4.11) | 11.34:1 | 3:1 | bestanden |
| `focus` #9fdcff | `canvas` #0b1220 | Fokusring auf dem Grund | 12.62:1 | 3:1 | bestanden |
| `focus-inverted` #9fdcff | `ink` #141d30 | Fokusring in der Seitenleiste | 11.34:1 | 3:1 | bestanden |
| `cta` #0a95ff | `surface` #141d30 | Chart: Einnahmen-Balken (Grafik, 1.4.11) | 5.41:1 | 3:1 | bestanden |
| `fg` #f4f7fb | `surface` #141d30 | Chart: Ausgaben-Balken (Grafik, 1.4.11) | 15.66:1 | 3:1 | bestanden |


Alle Paare bestehen.
