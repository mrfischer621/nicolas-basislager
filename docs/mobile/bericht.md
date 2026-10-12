# Bericht: Handy-Ansicht 2026

Stand 12.10.2026. Konzept: [`konzept.md`](konzept.md). Umgesetzt auf `feature/mobile-2026`.

Am 12.10.2026 ging der Branch per Fast-Forward auf `main` und ist produktiv. Die Folge-Commits (Abschnitt 4) gehen auf demselben Weg nach `main`.

Alle Bilder zeigen **nur erfundene Testdaten** (Mock «ZZ Testfirma»).

## 1. Ergebnis in Zahlen

Messung mit `scripts/mobile-audit.mjs`: 49 Ansichten vorher, 52 nachher. Neu gemessen werden Timer-Leiste, Stopp-Dialog und Pipeline-Board.

| Breite / Thema | Seiten mit horizontalem Überlauf | Ziele unter 24 px | Ziele unter 44 px | Felder unter 16 px (iOS-Zoom) | JS-Fehler |
|---|---|---|---|---|---|
| 375 hell | 6 → **0** | 169 → **10** | 926 → **152** | 224 → **1** | 0 → 0 |
| 390 hell | 6 → **0** | 174 → **15** | 932 → **150** | 212 → **1** | 0 → 0 |
| 390 Tiefsee | 6 → **0** | 174 → **15** | 939 → **150** | 218 → **1** | 0 → 0 |
| 430 hell | 1 → **0** | 174 → **14** | 979 → **160** | 222 → **1** | 0 → 0 |

Was in den Zahlen übrig bleibt:

- **Ziele unter 24 px:** Das sind Links im Fliesstext, zum Beispiel im Zeitstrahl oder «Registrieren». Für sie gilt in WCAG 2.5.8 die Ausnahme für Inline-Ziele.
- **Ziele unter 44 px:** Das sind meist 40–43 px hohe Elemente auf dem Desktop-Mass. Sie erfüllen WCAG 2.2 AA (24 px), aber nicht ganz die 44-px-Empfehlung von Apple.
- **Feld unter 16 px:** Das ist der Farbwähler der Kategorien. Er öffnet keine Tastatur, deshalb zoomt iOS dort nicht.

Weitere Wirkung: Bei Rechnungen (390 px) steht die erste Rechnung jetzt bei y ≈ 620 statt ≈ 1700.

**Desktop (1440 px):** Pixelvergleich vorher und nachher über alle 21 Seiten von `scripts/ux-audit-screens.mjs`. Unverändert bis auf zwei Stellen:
- das Timer-Symbol in der Kopfzeile, jetzt mit Strich 1.5 nach Designregel;
- den sichtbaren Fokusring im Suchfeld der Befehlspalette.

Zwei Änderungen sind auch am Desktop bewusst sichtbar:
- Im Lead-/Deal-Panel steht «Speichern» unter den übrigen Aktionen.
- Die Offertmaske hat keinen doppelten Titel und keine Karte in der Karte mehr.

## 2. Vorher und nachher (390 px, hell)

| Ansicht | Vorher | Nachher |
|---|---|---|
| Cockpit | [vorher](vorher/390-hell/cockpit.jpg) | [nachher](nachher/390-hell/cockpit.jpg) |
| Rechnungen | [vorher](vorher/390-hell/rechnungen.jpg) | [nachher](nachher/390-hell/rechnungen.jpg) |
| Neue Buchung | [vorher](vorher/390-hell/buchung-neu.jpg) | [nachher](nachher/390-hell/buchung-neu.jpg) |
| Zeiterfassung | [vorher](vorher/390-hell/zeiterfassung.jpg) | [nachher](nachher/390-hell/zeiterfassung.jpg) |
| Timer läuft | – | [nachher](nachher/390-hell/timer-laeuft.jpg) |
| Personen | [vorher](vorher/390-hell/personen.jpg) | [nachher](nachher/390-hell/personen.jpg) |
| Lead-Panel | [vorher](vorher/390-hell/lead-detail.jpg) | [nachher](nachher/390-hell/lead-detail.jpg) |
| Pipeline | [vorher](vorher/390-hell/pipeline.jpg) | [nachher](nachher/390-hell/pipeline.jpg) |
| Zeilenmenü | [vorher](vorher/390-hell/rechnungen-zeilenmenue.jpg) | [nachher](nachher/390-hell/rechnungen-zeilenmenue.jpg) |
| Zahlungsdaten | [vorher](vorher/390-hell/zahlungsdaten.jpg) | [nachher](nachher/390-hell/zahlungsdaten.jpg) |
| Suche | [vorher](vorher/390-hell/suche.jpg) | [nachher](nachher/390-hell/suche.jpg) |
| Menü | [vorher](vorher/390-hell/menue.jpg) | [nachher](nachher/390-hell/menue.jpg) |
| Einstellungen/Kategorien | [vorher](vorher/390-hell/einst-kategorien.jpg) | [nachher](nachher/390-hell/einst-kategorien.jpg) |

Weitere Bilder:
- alle Ansichten: `vorher|nachher/390-hell/` und `390-tiefsee/`;
- ganze Seiten: `390-hell-ganz/`;
- Messwerte: `messungen-*.json`.

Die Breiten 375 und 430 erzeugt das Skript bei Bedarf neu (Entscheid E10: nur 390 px im Repo).

## 3. Umgesetzt

Nach Baustein. Die Nummern beziehen sich auf die Befunde im Konzept.

| Baustein | Inhalt | behebt |
|---|---|---|
| Grundgerüst | `h-dvh` statt `100vh`, `viewport-fit=cover`, Safe Area an Kopfzeile, Scrollbereich, Seitenmenü, Leiste unten und Blättern, `theme-color` folgt dem Thema, Toasts am Handy oben | K2, K3, M2, N2 |
| Formularschrift | Felder unter `md` mit 16 px | K1 |
| Fokus | `outline-none` an drei Stellen ersetzt, `scroll-padding-bottom` gegen verdeckten Fokus | K5, K6 |
| Touch-Ziele | Klasse `.tap`; Knöpfe, Felder, Tabs, Umschalter und Checkbox-Zeilen mindestens 44 px unter `md`; Checkboxen in Karten mit 44-px-Fläche | K4, M1 |
| Masken | Klasse `.sheet-actions`: feste Fussleiste mit Speichern in Buchung, Rechnung, Offerte, Lead/Deal, Firma, Person, Projekt, Zeit und Zahlungsdaten | H1 |
| Zeilenmenü | unter `md` als Aktionsblatt von unten (48-px-Einträge, Abbrechen) | M3 |
| Listenkopf | Kennzahlen als wischbare Zeile, Auswahlfilter hinter «Filter (n)», Hinweise umbrechend | H2, M6 |
| Tabs | Scroll-Snap, aktiver Tab im Bild, Verlauf als Wisch-Hinweis | M4 |
| Kontakte | `ContactActions` (Anrufen/E-Mail) in Personenkarten, Firmenseite und Lead-/Deal-Panel; «Anrufen» im Zeilenmenü; `type="tel"` und `autocomplete` | H4, M9 |
| Betrag | Buchungsbetrag als Textfeld mit `inputmode="decimal"`, Komma und Apostroph erlaubt, auf Rappen gerundet | M9 |
| Leiste unten | «Buchung» heisst «Beleg», 56 px hoch; Timer-Leiste mit Pause und Stopp, wenn ein Timer läuft | H3, H5 |
| Cockpit | Kurzwege (Timer, Beleg, Rechnungen, Anrufen), Zeilen 48 px, Liquidität per Container Query untereinander | M7, M8, N4 |
| Buchungsmaske | am Handy Beleg zuerst, grosses «Foto aufnehmen», Miniatur; PDF-Beleg öffnen statt iframe | H5, M5 |
| Rechnung/Offerte | `PdfFrame`: am Handy «PDF öffnen» und «Teilen»; Highlights umbrechend; Zahlungsdaten als Karten; Offertmaske ohne doppelten Titel | H9, M5, M7, M12 |
| Pipeline | am Handy Liste als Standard; Board mit Spalten in Bildschirmbreite und Snap; Touch zieht erst nach 250 ms | H7 |
| Überlauf | Firma, Projekt, Kategorien, Kontostände, Leistungen | H8 |
| Feinschliff | Suche am Handy als Vollbild mit Abbrechen; aktives Unternehmen in der Kopfzeile; Beschriftungen im Jahresabschluss; Ladezustände mit `role="status"`; schmalere Diagrammachsen | M10, M11, N3, N5 |
| Fehler | `?neu=1` öffnete Masken nicht zuverlässig, auch am Desktop (Neu-Aufbau nach dem Laden des Unternehmens) | H6 |
| Fehler | Burger-Menü am Handy nicht bedienbar: Der Hintergrund lag über dem Menü. Das betraf auch die bisherige Produktion. | – |

## 4. Folge-Commits nach dem ersten Produktiv-Stand

- Ladezustände mit `role="status"`, schmalere Diagrammachsen am Handy.
- Negative Ränder der Touch-Ziele nur am Handy. Sonst stand «Kontostand erfassen» am Desktop 8 px versetzt; gefunden durch den Pixelvergleich.
- `ux-audit-screens.mjs` kennt `h-dvh` für ganze Seiten.
- Diese Dokumentation.

## 5. Bewusst nicht umgesetzt

- **Geschütztes Leerzeichen in «CHF 1'234»:** Dieselbe Funktion `formatChfDisplay` liefert auch die Beträge im Jahresabschluss-Export. Ich ändere sie nicht für die Anzeige allein. Beträge brechen am Handy deshalb in seltenen Fällen zwischen «CHF» und Zahl um.
- **Wischen zum Schliessen von Blättern:** Das bräuchte Gesten-Code oder eine Bibliothek. Geschlossen wird mit ×, Escape oder einem Tipp auf den Hintergrund.
- **Tiefsee-Hinweisbalken:** Er bleibt hell. Die Statusfarben sind eine Erweiterung des CRM mit geprüftem Kontrast (`docs/design-review/hell-und-status/`).
- **PWA** (Manifest, Icons, Kurzbefehle): nur als Vorschlag im Konzept (Abschnitt 7); ein eigener Auftrag.

## 6. Offene Punkte

1. **Test auf dem iPhone:** Die Emulation zeigt keine Eigenheiten von iOS Safari: Tastatur über der Fussleiste, Browserleiste, Kamera-Aufnahme, Teilen-Menü. Besonders prüfen:
   - Burger-Menü;
   - Beleg fotografieren;
   - Timer-Leiste;
   - Speichern in langen Masken bei offener Tastatur.
2. **VoiceOver von Hand:** nicht getestet. Automatisch geprüft sind Beschriftungen, Rollen und Fokus.
3. **Ziele zwischen 40 und 43 px** auf Seiten, die selten am Handy genutzt werden (Einstellungen, Berichte), nach Bedarf.

## 7. Prüfung

Nach jedem Commit:
- `npm test` (jetzt 215 Tests, neu: `RowMenu`, `contactLinks`, `numberInput`);
- `npm run lint` (0 Fehler);
- `npm run build`;
- `node scripts/smoke-pages.mjs`.

Dazu `node scripts/mobile-audit.mjs` für die betroffenen Ansichten.
