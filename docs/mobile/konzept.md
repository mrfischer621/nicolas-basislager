# Konzept: Handy-Ansicht des Blauwasser CRM (Stand 2026)

Stand 11.10.2026, Grundlage `main` (da172054).

> **Umgesetzt und produktiv seit 12.10.2026.** Nicolas hat mit «setze direkt um» freigegeben; die Entscheide in Abschnitt 7 gelten wie vorgeschlagen.
> Abweichung bei E1: Die Timer-Knöpfe bleiben am Handy zusätzlich in der Kopfzeile, nichts wurde ausgeblendet.
> Ergebnis, Vorher-/Nachher-Vergleich und offene Punkte stehen in [`bericht.md`](bericht.md).

Alle Bilder zeigen **nur erfundene Testdaten** (Mock «ZZ Testfirma»), weil das Repository öffentlich ist.

Die Entscheide stehen gesammelt in Abschnitt 7.

---

## 0. Wie gemessen wurde

- Skript `scripts/mobile-audit.mjs` (neu). Es nutzt Playwright mit Handy-Emulation (`isMobile`, `hasTouch`, Pixelfaktor 2) und den Mock aus `scripts/mock/`.
  - Breiten 375 × 667 (iPhone SE), 390 × 844 (iPhone 14/15/16), 430 × 932 (Pro Max).
  - Je Hell und Tiefsee. Tiefsee wird wie in den Einstellungen über `bw-theme` gesetzt, nicht über `prefers-color-scheme`.
- Erfasst sind 49 Ansichten:
  - alle Seiten aus `smoke-pages.mjs` ohne die alten Weiterleitungen;
  - die zehn Einstellungsbereiche;
  - die Masken «neu» für Zeit, Buchung, Rechnung, Offerte, Lead, Deal, Firma und Projekt;
  - Menü, Benutzermenü, Suche, Zeilenmenü, Buchungs- und Lead-Panel sowie der Dialog «Zahlungsdaten nachtragen».
- Ablage in `docs/mobile/vorher/`:
  - `<breite>-<thema>/<ansicht>.jpg`: sichtbarer Bildschirm, also das, was ohne Scrollen zu sehen ist;
  - `390-hell-ganz/`: ganze Seiten;
  - `messungen-*.json`: Messwerte pro Ansicht.
- Gemessen wird pro Ansicht:
  - horizontaler Überlauf und die überstehenden Elemente;
  - Touch-Ziele unter 44 × 44 px und unter 24 × 24 px;
  - Formularfelder unter 16 px Schrift;
  - `type`, `inputmode` und `autocomplete` der Felder sowie Felder ohne Beschriftung;
  - Lage der Hauptaktion (Pill);
  - Dialoggrösse;
  - JavaScript-Fehler.
- Aufruf: `node scripts/mobile-audit.mjs docs/mobile/vorher`. Mit `FULL=1` kommen die ganzen Seiten dazu. Eingrenzen lässt sich der Lauf mit `WIDTHS=390 THEMES=hell PAGES=cockpit,rechnungen`.
- Grösse: 26 MB JPEG. Wenn dir das fürs Repo zu viel ist, siehe Entscheid E10.

Hinweis zu den Bildern: Das Datumsformat «10/11/2026» in Datumsfeldern stammt vom Headless-Chromium (englische Oberfläche). Auf deinem iPhone zeigt Safari das Format deiner Spracheinstellung. Das ist kein Fehler der App.

---

## 1. Was heute schon gut ist

Damit klar ist, worauf aufgebaut wird:

- **Kein Überlauf** auf 40 von 49 Ansichten, auch nicht bei 375 px. Die Listen zeigen unter 1280 px eine Kartenliste (`DataTable`).
- **Leiste unten** (`MobileBar`) mit Cockpit, Zeit erfassen, Buchung und Suche. Sie setzt bereits `env(safe-area-inset-bottom)`.
- **Drawer als Blatt von unten** (`max-h-[92dvh]`). `Modal` ist auf dem Handy ein Vollbild-Blatt. Beide haben Fokusfalle, Escape und Fokusrückgabe.
- **Kamera:** In der Buchungsmaske gibt es «Foto aufnehmen» (`capture="environment"`), aber nur unter `sm`.
- **Zahlen:** Stunden und Beträge haben meist `inputmode="decimal"`. Der Login hat `autocomplete="email"` und `current-password`.
- **Bewegung und Fokus:** `prefers-reduced-motion` ist global berücksichtigt. Der sichtbare Fokus kommt aus dem Token (2 px Tinte).
- **Kontakt:** `tel:`- und `mailto:`-Links gibt es in der Personenliste (Desktop-Spalte) und auf der Firmenseite. Im Zeilenmenü steht «E-Mail schreiben».

---

## 2. Befunde nach Schwere

Schwere: **K** = kritisch (bricht einen Hauptablauf oder WCAG 2.2 AA), **H** = hoch (spürbar bei jeder Nutzung), **M** = mittel, **N** = niedrig/Feinschliff.

### 2.1 Kritisch

| # | Befund | Beleg | Ursache |
|---|---|---|---|
| K1 | **iOS zoomt bei jedem Eingabefeld heran.** Alle Felder haben 15 px Schrift; Safari vergrössert unter 16 px beim Fokus und zoomt danach nicht zurück. Betroffen sind z. B. 13 Felder in der Buchungsmaske, 16 in der Rechnungsmaske, 7 in der Zeiterfassung und auch der Login. | `messungen-*.json` → `smallFont` | `body { font-size: 15px }`, `.input` erbt |
| K2 | **App-Rahmen mit `100vh`** (`h-screen` in `BentoLayout` und `html,body`). In iOS Safari ist `100vh` höher als der sichtbare Bereich, wenn die Browserleiste eingeblendet ist. Folgen: Der untere Teil des Scrollbereichs liegt hinter der Browserleiste, und die feste Leiste unten springt. | Code `BentoLayout.tsx:34`, `index.css:23` | `h-screen` statt `h-dvh` |
| K3 | **Safe Area greift nicht.** Im Viewport-Meta fehlt `viewport-fit=cover`, deshalb ist `env(safe-area-inset-*)` auf dem iPhone 0. Bei einer Installation auf dem Home-Bildschirm und im Querformat würden Leiste und Blätter unter Home-Indikator und Notch liegen. | `index.html` | Meta-Tag |
| K4 | **Touch-Ziele unter 24 px** (WCAG 2.5.8, Mindestmass 24 × 24 ohne Abstandsausnahme). Beispiele: Checkboxen in Kartenlisten (20 × 20), «Kontostand erfassen» im Cockpit (112 × 16), Phasen-Pfeile und Löschen in den Einstellungen (17 Stück), Datumsfilter-Knöpfe. Bis zu 17 pro Ansicht. | `tiny` in den Messungen | kleine Icon-Knöpfe ohne Polsterung |
| K5 | **`outline-none` an drei Stellen** (tabu, WCAG 2.4.7/2.4.13): Zeilen der `DataTable`, Einträge im `RowMenu`, Eingabefeld der `CommandPalette`. Ersatz ist teils nur eine Hintergrundfarbe. | `DataTable.tsx:195`, `RowMenu.tsx:90`, `CommandPalette.tsx:144` | |
| K6 | **Fokus kann verdeckt sein** (WCAG 2.4.11). Die feste Leiste unten (rund 60 px) überdeckt Elemente am unteren Rand des Scrollbereichs, wenn man mit Tastatur oder Bildschirmleser navigiert. Es fehlt `scroll-padding-bottom`. | Aufbau `BentoLayout` | |

### 2.2 Hoch

| # | Befund | Beleg |
|---|---|---|
| H1 | **Speichern liegt in langen Masken ganz unten.** Neue Buchung, Neue Rechnung, Neue Offerte und Neuer Deal sind Blätter ohne feste Fussleiste. Um zu speichern, musst du ans Ende scrollen; bei der Buchung kommt «Weitere Angaben» noch davor. Das Drawer-`footer` ist nicht in allen Masken genutzt. | `buchung-neu.jpg`, `rechnung-neu.jpg`, `deal-neu.jpg` |
| H2 | **Listen zeigen den Inhalt erst nach 1–2 Bildschirmen.** Beispiel Rechnungen bei 390 px: Titel, Pill, Hinweis, 4 Kennzahlkarten, Tabs, Suche und 3 Filter. Die erste Rechnung steht bei y ≈ 1700. Die Frage «ist sie bezahlt?» braucht also Scrollen. Bei Buchungen, Offerten und Zeiterfassung ist es ähnlich. | `390-hell-ganz/rechnungen.jpg` |
| H3 | **Timer am Handy schwer erreichbar.** Start (32 × 32) und «vorkonfigurieren» (30 × 30) stehen oben rechts in der Kopfzeile, also ausserhalb der Daumenzone. Einen laufenden Timer siehst du nur dort. | `cockpit.jpg` |
| H4 | **Kontakt anrufen oder anschreiben braucht 3 Taps.** In der Kartenliste der Personen stehen nur Name und Funktion; Telefon und E-Mail sind nicht direkt antippbar. Das Zeilenmenü hat «E-Mail schreiben», aber **kein «Anrufen»**. In Lead und Deal ist Telefon ein Textfeld (`type="text"`) ohne Knopf zum Anrufen. | `personen.jpg`, `lead-detail.jpg` |
| H5 | **Beleg-Ablauf:** Am Handy ist «Foto aufnehmen» das 7. Feld in der Buchungsmaske. Für «Beleg fotografieren und erfassen» sollte es das erste sein. | `buchung-neu.jpg` |
| H6 | **Fehler: «Neue Firma», «Neues Projekt» und «Neuer Lead» aus der Suche öffnen die Maske nicht.** `/kontakte?neu=1` und `/projekte?neu=1` zeigen nur die Liste. `/leads?neu=1` wertet `neu` gar nicht aus, und `neu` ist dort zugleich ein Wert von `ansicht`. «Zeit», «Buchung», «Rechnung», «Offerte» und «Deal» funktionieren. Der Fehler betrifft auch den Desktop. | `firma-neu.jpg`, `projekt-neu.jpg`, `lead-neu.jpg` |
| H7 | **Pipeline-Board am Handy:** Die Spalten sind schmaler als der Bildschirm (Karten abgeschnitten, «Muster Garag…»). Der `PointerSensor` mit 6 px Abstand nimmt jedes Wischen auf einer Karte als Ziehen statt als Scrollen. Seitwärts scrollen geht deshalb nur zwischen den Karten. | `pipeline.jpg`, `Pipeline.tsx:40` |
| H8 | **Horizontaler Überlauf** auf 5 Ansichten: Einstellungen/Kategorien (220 px bei 375), Kontostände (53 px, Tabelle), Leistungen (36 px, Umschalter), Firmenseite (31 px, Kontaktblock), Projektseite (51 px, Zeitenliste). | `UEBERLAUF` in den Messungen |
| H9 | **Dialog «Zahlungsdaten nachtragen»** ist eine Tabelle im Blatt. Das Datumsfeld ist abgeschnitten, und die Spalte «Bezahlt am» liegt ausserhalb. | `zahlungsdaten.jpg` |

### 2.3 Mittel

| # | Befund |
|---|---|
| M1 | **Touch-Ziele 24–43 px** (WCAG-konform, aber unter der 44-px-Empfehlung von Apple und Google). Betroffen: Hamburger 36 × 36, Benutzermenü 72 × 40, Zeilenmenü «…» 32 × 32, Einträge im Zeilenmenü 36 px hoch, Tabs 42 px, Filter-Selects 39 px, Cockpit-Zeilen 40 px, Umschalter «Firmen/Lieferanten/Personen» 32 px. Das sind 9–45 pro Ansicht. |
| M2 | **Meldungen (Toasts) unten rechts** liegen auf dem Handy über der Leiste unten und verdecken sie. |
| M3 | **Zeilenmenü als kleines Dropdown** (224 px breit, Einträge 36 px). Auf dem Handy ist ein Blatt von unten mit 48-px-Einträgen üblich und daumenfreundlicher. |
| M4 | **Tabs laufen rechts aus dem Bild** («Überfäl», «Dieser», «Dateien»), ohne Hinweis, dass man wischen kann. Der aktive Tab wird nicht ins Bild gescrollt. |
| M5 | **PDF-Vorschau als `iframe` mit 80vh** (Rechnung, Offerte). iOS Safari zeigt PDFs im iframe nur unvollständig (erste Seite, kein Zoom). Am Handy ist «PDF öffnen» (neuer Tab, Teilen-Menü) besser. |
| M6 | **Hinweisbalken quetschen den Text**, wenn Text und Knopf nebeneinander stehen (Rechnungen: «1 bezahlte / Rechnung / ohne …»). |
| M7 | **Kennzahlen mit abgeschnittenen Beträgen:** Liquidität im Cockpit «CHF 12'…» (drei Spalten), Firma in Offerte und Rechnung «Muster Treuhan…». |
| M8 | **Das Cockpit ist am Handy rund 3½ Bildschirme lang**, ohne Schnellaktionen. Die Kurzwege «Timer», «Beleg» und «Rechnung prüfen» fehlen oben. |
| M9 | **Felder ohne passenden Typ:** Telefon als `type="text"` (Lead, Deal, Person, Firma), ohne `autocomplete="tel"`. E-Mail ohne `autocomplete="email"`. Personennamen ohne `autocomplete="name"`. Firma ohne `organization`. Der Betrag in der Buchung ist `type="number"`; das erlaubt auf iOS kein Komma und zeigt Pfeile. `inputmode="decimal"` mit Textfeld ist besser. |
| M10 | **Jahresabschluss:** Die Eingabefelder für Anlagen und Privatanteile haben nur Platzhalter («Laptop», «1800», «40») und keine sichtbaren Spaltenköpfe am Handy. Unklar, was welches Feld ist. Beträge brechen um («CHF / 1'200.00»). |
| M11 | **Masken ohne Rückmeldung beim Laden:** Unter `Suspense` erscheint ein grosser grauer Block ohne Text. Für Bildschirmleser fehlt `aria-busy`/`role="status"`. |
| M12 | **Neue Offerte:** doppelter Titel («Neue Offerte» im Blatt und darin noch einmal). «Rabatte» und «Position hinzufügen» brechen um. |

### 2.4 Niedrig

| # | Befund |
|---|---|
| N1 | In Tiefsee bleibt der orange Hinweisbalken (Zahlungsdatum) hell; das sticht stark hervor. Der Kontrast des Texts ist ausreichend; ich prüfe ihn mit `scripts/contrast-check.mjs` nach. |
| N2 | Kein `<meta name="theme-color">`: Die Statusleiste in Safari passt sich nicht an Hell oder Tiefsee an. |
| N3 | Diagramme (recharts) im Cockpit und in den Berichten sind bei 390 px lesbar, aber die y-Achse nimmt rund 20 % der Breite ein. «Stunden nach Verrechenbarkeit» ist ein Balken mit viel Leerraum. |
| N4 | Legende «AHV/IV/EO 10 %» bricht vor dem «%» um (geschütztes Leerzeichen fehlt). |
| N5 | Kopfzeile: Das Benutzermenü zeigt am Handy nur ein Symbol und den Pfeil; welches Unternehmen aktiv ist, steht erst im Menü. Bei zwei Unternehmen ist das wichtig, weil Zahlen nie zusammengezählt werden. |

---

## 3. Gemeinsame Bausteine (zuerst)

Alles aus vorhandenen Tokens und Klassen, ohne neue Farben, Schriften, Effekte oder Abhängigkeiten. Alle Änderungen gelten **nur unter `md` (768 px) bzw. unter `xl` (1280 px)**, wo heute schon die Kartenliste gilt. Der Desktop ab 1280 px bleibt unverändert; ich prüfe ihn mit Bildern bei 1440 px vorher und nachher.

| # | Baustein | Änderung | behebt |
|---|---|---|---|
| B1 | **Grundgerüst** | `h-screen` → `h-dvh` (Tailwind 3.4 kann das). `viewport-fit=cover` im Viewport-Meta. Safe Area an Kopfzeile (`pt`), Leiste unten, Blättern, Seitenmenü (`pl`/`pr` im Querformat) und Toasts. `theme-color` hell/Tiefsee, gesetzt in `applyTheme`. | K2, K3, N2 |
| B2 | **Formularschrift** | Unter `md` haben `.input`, `select` und `textarea` 16 px; ab `md` bleibt es bei 15 px. Damit zoomt iOS nicht, und der Desktop bleibt gleich. | K1 |
| B3 | **Touch-Ziele** | Neue Hilfsklasse `.tap` (min. 44 × 44 durch Polsterung, nicht durch grössere Icons) für Icon-Knöpfe. Betroffen: Hamburger, Timer, Benutzermenü, «…», Drawer schliessen, Paginierung, Pfeile. Checkboxen in Karten bekommen eine 44-px-Trefferfläche über ein `label`. Unter `md` gilt `min-h-[44px]` für `.btn`, Tabs, `toggle-group` und Filter-Selects. Abstände bleiben, die Optik ändert sich kaum. | K4, M1 |
| B4 | **Fokus** | `outline-none` an den drei Stellen ersetzen durch den Token-Fokusring. Bei Tabellenzeilen ist das ein Ring innen (`outline-offset:-2px`), damit er nicht abgeschnitten wird. `scroll-padding-bottom` = Höhe der Leiste plus Safe Area am Scrollbereich, `scroll-padding-top` für feste Köpfe. | K5, K6 |
| B5 | **Blatt mit fester Fussleiste** (`Modal` und `Drawer`) | Am Handy ist die Fussleiste mit Abbrechen und Hauptaktion immer sichtbar (`sticky bottom-0`, Safe Area). Der Inhalt scrollt dazwischen. Die Hauptaktion steht rechts in voller Höhe, also in der Daumenzone. Masken, die heute einen Speichern-Knopf im Formular haben, geben ihn an `footer` (über `form="…"` verknüpft, damit Enter und Validierung bleiben). Optisch ein Griffbalken oben, aber **ohne** Wischen zum Schliessen (das bräuchte Gesten-Code oder eine Bibliothek; Schliessen per × und Escape bleibt). | H1, M12 |
| B6 | **Aktionsblatt statt Dropdown** (`RowMenu`) | Unter `md` öffnet das Zeilenmenü als Blatt von unten mit Titel (z. B. «RE-2026-005»), 48-px-Einträgen und «Abbrechen». Ab `md` bleibt es beim heutigen Dropdown. Gleiche Einträge, gleiche Logik, nichts fällt weg. | M3 |
| B7 | **Leiste unten** (`MobileBar`) | Bleibt bei vier Zielen, mit Änderungen. (a) **Timer-Zustand:** Läuft ein Timer, erscheint darüber eine schmale Leiste «▶ 00:42:10 · Projekt · Stopp» (eigenes Element, keine Pill). (b) «Buchung» heisst «Beleg» und öffnet die Buchungsmaske mit der Kamera zuerst (siehe Seite Buchungen). (c) Tap-Höhe 56 px, Beschriftung 12 px statt 11 px. Varianten siehe Entscheid E1. | H3, H5 |
| B8 | **Listen-Kopf kompakt** (`ListPage`, `KpiStrip`, `Toolbar`) | Unter `md`: (a) Kennzahlen als **eine** waagrecht wischbare Zeile kleiner Kacheln statt eines 2×2-Rasters. (b) Filter hinter einem Knopf «Filter (2)», der ein Blatt öffnet; Suche bleibt sichtbar. (c) Hinweise einzeilig mit Link statt Knopf daneben. Ziel: Die erste Zeile der Liste steht bei 390 px oberhalb von y ≈ 450. | H2, M6 |
| B9 | **Tabs** (`ViewTabs`) | Scroll-Snap, aktiven Tab ins Bild scrollen, am rechten Rand ein Verlauf aus `canvas` als Wisch-Hinweis. Das ist kein neuer Effekt, sondern die Hintergrundfarbe mit Transparenz; falls du das als Effekt zählst, siehe E7. Höhe 44 px. | M4 |
| B10 | **Toasts** | Unter `md` oben mittig (`top-center`, unter der Kopfzeile, Safe Area). Ab `md` unverändert unten rechts. | M2 |
| B11 | **Kontaktknöpfe** | Kleiner Baustein `ContactActions` mit «Anrufen» (`tel:`) und «E-Mail» (`mailto:`) als 44-px-Icon-Knöpfe mit Text für Bildschirmleser. Einsatz in Personenkarten, Firmenseite, Lead- und Deal-Panel und Kontaktblock. Telefonnummern werden für `tel:` von Leerzeichen befreit. | H4 |
| B12 | **Feldtypen** | `type="tel"` + `autocomplete="tel"` für Telefon, `autocomplete="email"`/`name`/`organization`/`street-address`/`postal-code`/`address-level2` in Firma, Person und Lead. Betrag in der Buchung: `type="text"` + `inputmode="decimal"`, Komma wird als Punkt gelesen (mit Test). Suchfelder: `enterkeyhint="search"`. Masken: `enterkeyhint="next"`/`"done"`. | M9 |
| B13 | **Ladezustände** | Skelette mit `role="status"` und unsichtbarem Text «wird geladen». `aria-busy` an Listen, solange sie laden. | M11 |
| B14 | **Querformat und Ränder** | Seitenmenü (Overlay) und Blätter mit `env(safe-area-inset-left/right)`. Kein Überlauf bei 320 px (Prüfung zusätzlich zu 375). | K3 |

Container Queries setze ich dort ein, wo dieselbe Karte in verschiedenen Breiten steht: Kennzahlkarten (`KPICard`, Datensatz-Highlights) und Cockpit-Karten. Damit greift die Spaltenzahl nach der Kartenbreite, nicht nach dem Bildschirm. Das Tailwind-Plugin `@tailwindcss/container-queries` wäre eine neue Abhängigkeit. Ohne Plugin geht es mit ein paar Zeilen eigenem CSS (`container-type: inline-size` und `@container`) in `index.css`. Das ist mein Vorschlag (E8).

---

## 4. Zielbild pro Seite

Sortiert nach deinen Abläufen unterwegs.

### 4.1 Cockpit `/`
- **Neu oben (nur unter `md`): Schnellaktionen** als eine Zeile mit vier gleich breiten Kacheln (Icon + Wort, 64 px hoch, Token `surface`):
  - **Timer**: starten, oder anzeigen und stoppen, wenn er läuft;
  - **Beleg**: Buchung mit Kamera;
  - **Rechnungen**: `/rechnungen?ansicht=offen`;
  - **Anrufen**: Personen, sortiert nach zuletzt bearbeitet.

  Das sind **keine** Pills; die Seite hat weiterhin keine Pill.
- «Zu erledigen» bleibt zuerst; die Zeilen werden 48 px hoch.
- Die Liquidität zeigt ihre drei Werte untereinander statt in drei abgeschnittenen Spalten (Container Query).
- «Kontostand erfassen» wird ein richtiger Knopf (44 px).
- Reihenfolge der Karten am Handy unverändert; die Gruppe «Weitere Kennzahlen» bleibt zugeklappt. **Nichts fällt weg.**

### 4.2 Zeiterfassung `/zeiterfassung`
- Die Schnellerfassung bleibt oben. «Erfassen» und «Timer» stehen nebeneinander in voller Breite (je 50 %, 48 px).
- Stunden: zusätzlich Schnellwahl-Chips «0.25 / 0.5 / 1 / 2». Die Chips füllen nur das Feld; Eingabe von Hand bleibt.
- Liste darunter mit kompaktem Kopf (B8). Die Auswertung bleibt im Tab.
- Die Diagramme der Auswertung bekommen eine schmalere y-Achse und eine feste Höhe (N3).
- Der Timer ist über die Leiste unten bzw. die Timer-Leiste erreichbar (B7). Der Knopf oben bleibt für den Desktop.

### 4.3 Buchungen `/buchungen` und Maske «Neue Buchung»
- **Am Handy beginnt die Maske mit dem Beleg:**
  - zwei grosse Knöpfe «Foto aufnehmen» (`capture="environment"`) und «Datei wählen»;
  - nach der Aufnahme erscheint eine Vorschau als Miniatur;
  - danach Betrag (`inputmode="decimal"`, Fokus), Datum (vorbelegt heute), Kategorie, Lieferant;
  - «Weitere Angaben» bleibt eingeklappt.

  Ab `sm` bleibt die heutige Reihenfolge.
- Speichern steht in der festen Fussleiste (B5).
- Option «Speichern und nächste»: Die Maske bleibt offen und wird geleert, für mehrere Belege nacheinander (E4).
- Die Buchungsdetails (Drawer) zeigen den Beleg als Bild in voller Breite. PDF als Link «Beleg öffnen» statt iframe.

### 4.4 Rechnungen `/rechnungen` und `/rechnungen/:id`
- Liste mit kompaktem Kopf (B8). Die Karten zeigen Nr, Firma, Betrag und Status-Badge, wie heute.
- Neu: «bezahlt am 29.05.» bzw. «seit 13 Tagen überfällig» als zweite Zeile, damit die Frage «bezahlt?» ohne Öffnen beantwortet ist.
- **Standardansicht am Handy «Offen»** statt «Alle»? Siehe E5.
- Detail:
  - Highlights 2-spaltig, Firma umbrechend statt abgeschnitten;
  - «Als bezahlt markieren» als Hauptaktion in einer festen Leiste unten (über der Leiste unten);
  - PDF-Vorschau am Handy ersetzt durch «PDF öffnen» und «Teilen» (Web Share API, falls vorhanden; sonst nur Öffnen). Ab `md` bleibt die Vorschau.
- «Zahlungsdaten nachtragen»: am Handy eine Karte pro Rechnung (Nr, Firma, Betrag, Datumsfeld in voller Breite, «Fälligkeit übernehmen») statt Tabelle (H9).

### 4.5 Kontakte `/kontakte`, Firmenseite, Personen
- Personenkarte: Name und Funktion links, rechts **Anrufen** und **E-Mail** als Icon-Knöpfe (B11). Das «…»-Menü bleibt.
- Firmenkarte: Ort, offener Betrag und, falls vorhanden, Anrufen der Hauptperson.
- Zeilenmenü der Personen: neu «Anrufen» neben «E-Mail schreiben».
- Firmenseite:
  - Kontaktblock ohne Überlauf;
  - E-Mail und Telefon als Knöpfe;
  - Adresse als Link auf die Karten-App (`https://maps.apple.com/?q=…`). Das ist ein externer Link, den nur du antippst; es werden keine Daten übertragen, solange du nicht tippst (E9).
  - Tabs nach B9.
- Umschalter Firmen/Lieferanten/Personen 44 px hoch.

### 4.6 Leads `/leads` und Pipeline `/pipeline`
- Leads:
  - Karte mit «nächster Schritt» und Status;
  - Checkbox mit 44-px-Trefferfläche;
  - im Panel Telefon und E-Mail mit Anruf- bzw. Mailknopf daneben, Status als Umschalter statt Select;
  - **«Neuer Lead» aus der Suche reparieren** (H6).
- Pipeline:
  - am Handy standardmässig **Tabelle (Kartenliste nach Phase gruppiert)**, das Board bleibt per Umschalter erreichbar (E6);
  - im Board: Spalten mit `scroll-snap`, 85 % Bildschirmbreite, Karten nicht abgeschnitten;
  - Ziehen auf Touch erst nach 250 ms Halten (`TouchSensor` aus dnd-kit, schon installiert), damit Wischen scrollt;
  - Phasenwechsel ohne Ziehen über das Panel (Phase-Chips, 44 px).

### 4.7 Offerten, Projekte
- Liste nach B8.
- Offerte-Detail wie Rechnung (PDF öffnen statt iframe).
- «Neue Offerte»: doppelten Titel entfernen, Positionskopf umbrechen (M12), Fussleiste fest.
- Projektseite: Zeitenliste als Karten statt Tabelle (Überlauf H8). «Zeit erfassen» bleibt die Pill.
- **«Neues Projekt» und «Neue Firma» aus der Suche reparieren** (H6).

### 4.8 Berichte, Jahresabschluss, Einstellungen
- Diese Seiten werden am Handy selten gebraucht; Ziel ist **lesbar und ohne Überlauf**, nicht neu gestaltet.
- Berichte: Tabellen Erfolgsrechnung mit Beträgen ohne Umbruch (`whitespace-nowrap`, Konto als eigene kleine Zeile). Diagramme mit schmaler Achse.
- Jahresabschluss: sichtbare Beschriftungen über den Eingabefeldern am Handy (M10). «Jahr abschliessen» bleibt erreichbar; ich schlage **keine** Sperre am Handy vor.
- Einstellungen:
  - Kategorien als Karten statt Zeilen (220 px Überlauf);
  - Kontostände als Karten;
  - Leistungen mit umbrechendem Umschalter;
  - Pipeline-Phasen mit 44-px-Pfeilen und Löschknopf.

### 4.9 Kopfzeile, Menü, Suche, Login
- Kopfzeile am Handy:
  - Hamburger 44 px;
  - Mitte: **Kürzel des aktiven Unternehmens** (z. B. «Blauwasser IT», gekürzt), damit klar ist, welche Zahlen du siehst (N5);
  - rechts: Benutzermenü 44 px.
  - Der Timer wandert am Handy in die Leiste unten bzw. die Timer-Leiste (E1). Am Desktop bleibt er oben.
- Seitenmenü: Einträge 44 px, Safe Area, schliesst bei Escape und bei Tap auf den Hintergrund (bereits so).
- Suche (Befehlspalette) am Handy als Vollbild-Blatt von oben:
  - Eingabe 16 px, `enterkeyhint="go"`;
  - Treffer 48 px hoch;
  - Ringfokus statt `outline-none`.
- Login: 16 px, sonst gut.

---

## 5. Liste aller Änderungen (Phase B, ein Commit pro Baustein bzw. Seite)

| Reihenfolge | Commit | Dateien (voraussichtlich) |
|---|---|---|
| 1 | Grundgerüst: dvh, viewport-fit, Safe Area, theme-color, Toast-Position | `index.html`, `index.css`, `BentoLayout.tsx`, `MobileBar.tsx`, `main.tsx`, `utils/theme.ts` |
| 2 | Formularschrift 16 px unter md | `index.css` |
| 3 | Fokus: outline-none ersetzen, scroll-padding | `DataTable.tsx`, `RowMenu.tsx`, `CommandPalette.tsx`, `BentoLayout.tsx` |
| 4 | Touch-Ziele: `.tap`, Kopfzeile, Checkboxen, Tabs, Selects, Umschalter | `index.css`, `BentoHeader.tsx`, `TimerButton.tsx`, `DataTable.tsx`, `ViewTabs.tsx`, `ListPage.tsx`, `ui/SegmentedControl.tsx` |
| 5 | Blatt mit fester Fussleiste (Modal, Drawer) und Umstellung der Masken | `Modal.tsx`, `Drawer.tsx`, Formulare (Buchung, Rechnung, Offerte, Deal/Lead, Firma, Person, Projekt, Zeit) |
| 6 | Aktionsblatt für RowMenu unter md | `RowMenu.tsx` (+ Test) |
| 7 | Listen-Kopf kompakt: KPI-Zeile, Filterblatt, Hinweis einzeilig | `ListPage.tsx`, `KpiStrip.tsx`, Seiten mit Filtern |
| 8 | Tabs: Snap, aktiver Tab sichtbar | `ViewTabs.tsx` |
| 9 | Fehler `?neu=1` bei Kontakte, Projekte, Leads | `Kontakte.tsx`, `Projekte.tsx`, `Leads.tsx` (+ Test) |
| 10 | Kontaktknöpfe und Feldtypen (tel, autocomplete, enterkeyhint, Betrag mit Komma) | neu `components/ContactActions.tsx`, `Kontakte.tsx`, `FirmaDetail.tsx`, `OpportunityDrawer.tsx`, `contacts/Editors.tsx`, `TransactionForm.tsx` (+ Test Komma) |
| 11 | Leiste unten und Timer-Leiste | `MobileBar.tsx`, `TimerButton.tsx`/Timer-Kontext |
| 12 | Cockpit: Schnellaktionen, Liquidität, Container Queries | `Cockpit.tsx`, `cockpit/CockpitCard.tsx`, `index.css` |
| 13 | Buchungsmaske: Beleg zuerst am Handy | `TransactionForm.tsx`, `BookingDrawer.tsx` |
| 14 | Rechnungen und Offerten: Karten, Detail, PDF öffnen, Zahlungsdaten als Karten | `Rechnungen.tsx`, `RechnungDetail.tsx`, `OfferteDetail.tsx`, Zahlungsdaten-Dialog |
| 15 | Pipeline: Touch-Sensor, Snap, Handy-Standard | `Pipeline.tsx` |
| 16 | Überlauf: Firma, Projekt, Einstellungen (Kategorien, Kontostände, Leistungen, Phasen), Jahresabschluss | betreffende Seiten |
| 17 | Ladezustände, Diagrammachsen, Kleinigkeiten (N1–N4) | diverse |
| 18 | Bilder `docs/mobile/nachher/` + Vergleich 1440 px + Bericht | `docs/mobile/` |

Nach jedem Commit: `npm test`, `npm run lint` (0 Fehler), `npm run build`, `node scripts/smoke-pages.mjs`. Zusätzlich `node scripts/mobile-audit.mjs` für die betroffenen Ansichten. Danach Push auf `feature/mobile-2026` und Prüfung der Vercel-Vorschau. **Kein Merge auf main ohne deine Freigabe.**

Neue Tests (Vitest/Testing Library):
- `RowMenu` als Blatt unter md;
- `?neu=1` öffnet die Maske;
- Betrag mit Komma;
- `tel:`-Normalisierung;
- Fussleiste in `Drawer`/`Modal` vorhanden.

---

## 6. Was am Handy wegfällt, versteckt oder verschoben würde

**Nichts wird entfernt.** Verschoben oder hinter einen Tap gelegt würde Folgendes, jeweils nur unter `md`:

| Funktion | Heute am Handy | Vorschlag | Erreichbar über |
|---|---|---|---|
| Filter-Selects (Firma, Projekt, Jahr, Kategorie, Lieferant, Quelle) | sichtbar untereinander | hinter «Filter (n)» im Blatt | 1 Tap mehr; aktive Filter als Zahl sichtbar |
| Kennzahlkarten der Listen | 2×2-Raster | wischbare Zeile | wischen |
| Timer-Knöpfe in der Kopfzeile | oben rechts | Leiste unten bzw. Timer-Leiste; oben ausgeblendet | Leiste unten, Cockpit-Kachel, Suche «Timer starten» |
| PDF-Vorschau (iframe) Rechnung/Offerte | eingebettet (auf iOS unvollständig) | Knopf «PDF öffnen» | 1 Tap |
| Pipeline-Board als Standard | Board | Kartenliste nach Phase als Standard | Umschalter «Board» (bleibt in der URL) |
| Buchungsmaske, Reihenfolge | Beleg als 7. Feld | Beleg zuerst | – |
| Rechnungen-Standardansicht | «Alle» | «Offen» (nur falls E5 = ja) | Tab «Alle» |
| Hinweisbalken-Knopf | Knopf neben Text | Textlink in derselben Zeile | gleich |

---

## 7. Entscheide für dich

| # | Frage | Mein Vorschlag |
|---|---|---|
| E1 | **Leiste unten:** (a) wie heute Cockpit / Zeit / Buchung / Suche, plus Timer-Leiste darüber, wenn er läuft; oder (b) Cockpit / Zeit / **Timer** / Beleg / Suche (5 Ziele). | **(a)**: vier Ziele bleiben ruhiger. Timer starten über die Cockpit-Kachel und «Zeit erfassen»; ein laufender Timer ist immer sichtbar. |
| E2 | «Buchung» in der Leiste umbenennen in **«Beleg»**? | Ja, das ist der Ablauf unterwegs. |
| E3 | Cockpit am Handy: **Schnellaktionen-Zeile** oben (Timer, Beleg, Rechnungen, Anrufen)? | Ja. |
| E4 | Buchungsmaske: Knopf **«Speichern und nächste»** für mehrere Belege nacheinander? | Ja, als Zweitknopf in der Fussleiste. |
| E5 | Rechnungen am Handy standardmässig **«Offen»** (versendet + überfällig) statt «Alle»? Die URL legt das fest; der Desktop bliebe bei «Alle». | Nein: Ich würde «Alle» lassen und dafür «bezahlt am»/«überfällig seit» in der Karte zeigen. Gleiches Verhalten auf allen Geräten ist weniger überraschend. |
| E6 | Pipeline am Handy standardmässig als **Kartenliste nach Phase**, Board per Umschalter? | Ja. |
| E7 | Wisch-Hinweis bei Tabs als Verlauf aus der Hintergrundfarbe: zählt das für dich als «neuer Effekt»? Alternative: kein Verlauf, nur Snap und angeschnittener letzter Tab wie heute. | Verlauf; er nutzt nur den Token `canvas`. |
| E8 | Container Queries **ohne Plugin** (eigenes CSS in `index.css`) statt `@tailwindcss/container-queries`? | Ohne Plugin, also ohne neue Abhängigkeit. |
| E9 | Adresse auf der Firmenseite als Link auf **Apple Karten** (`maps.apple.com`, öffnet auf Android Google Maps im Browser)? | Ja; kein Datenfluss ohne Tap. |
| E10 | Bilder im Repo: alle 312 + ganze Seiten (26 MB) **oder** nur 390 px hell/Tiefsee + ganze Seiten (rund 9 MB), Rest lokal? Gilt auch für `nachher/`. | Nur 390 px im Repo, das Skript erzeugt die anderen jederzeit. |
| E11 | Fehler H6 (`?neu=1` bei Kontakte, Projekte, Leads) betrifft auch den Desktop. Im selben Branch beheben? | Ja, eigener Commit. |

### PWA-Vorschlag (nicht umsetzen ohne Auftrag)

Eine Installation auf dem Home-Bildschirm würde unterwegs viel bringen:
- Vollbild ohne Browserleiste;
- eigenes Icon (Zeichen «B», liegt schon in `design-system/blauwasser/logos/`);
- Kurzbefehle per Langdruck auf das Icon («Zeit erfassen», «Beleg», «Timer»).

Dafür braucht es:
- `manifest.webmanifest` mit `display: standalone`, `theme_color`, Icons 192/512 und maskable, `shortcuts`;
- `apple-touch-icon`.

Ein **Service Worker** ist für die Installation in iOS nicht nötig, für Offline-Nutzung schon. Offline bei einem Finanz-CRM wirft eigene Fragen auf:
- veraltete Zahlen;
- Konflikte beim Speichern;
- zwischengespeicherte Kundendaten auf dem Gerät.

Mein Vorschlag wäre: nur Manifest und Icons (ohne Service Worker, also ohne Offline). Das wäre ein eigener, kleiner Auftrag. Wichtig dabei: `viewport-fit=cover` und Safe Area (B1) sind die Voraussetzung, damit eine installierte App sauber aussieht.

---

## 8. Offene Punkte und Grenzen des Audits

- **Echte Geräte:** Die Emulation zeigt keine iOS-Eigenheiten wie Zoom, Tastatur über festen Elementen und Browserleiste. Diese prüfe ich nach Phase B in der Vercel-Vorschau; die Prüfung auf deinem iPhone kann ich nicht ersetzen.
- **Kontrast:** Die Token-Paare sind laut `docs/design-review/` geprüft. Neue Kombinationen (Timer-Leiste, Aktionsblatt) prüfe ich mit `scripts/contrast-check.mjs`.
- **Bildschirmleser:** Struktur (Überschriften, Landmarken, Beschriftungen) ist automatisch geprüft. Alle Felder in den gemessenen Ansichten haben eine Beschriftung. VoiceOver von Hand ist nicht getestet.
- **Mock-Grenzen:**
  - Die Beleg-Vorschau zeigt im Mock JSON statt eines Bildes (Mock liefert keine Datei).
  - Rechnungs- und Offertvorschau melden «Vorschau nicht möglich», weil der Testfirma Adresse und IBAN fehlen.

  Beides sind keine App-Fehler.
