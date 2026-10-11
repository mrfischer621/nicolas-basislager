# Konzept: Struktur und Übersichtlichkeit des CRM

Stand 11.10.2026. Grundlage ist der Branch `feature/crm-anpassungen-okt26` (noch nicht gemergt). Die Umsetzung kommt nach deinem Okay auf `feature/ux-struktur`, der auf diesem Branch aufbaut.

Die Screenshots in `vorher/` zeigen **nur erfundene Testdaten** (Mock «ZZ Testfirma»), weil das Repository öffentlich ist. Eine gespeicherte Sitzung (`.auth/`) gab es nicht; die Zahlen zur echten Nutzung stammen aus lesenden Abfragen auf der Datenbank. Erzeugt werden die Bilder mit `node scripts/ux-audit-screens.mjs docs/ux-struktur/vorher 1440` (bzw. `390` für das Handy). Die Mock-Daten habe ich dafür um Pipeline, Zeiten, Offerten, Projekte und Kontakte ergänzt.

**Was du entscheiden musst, steht gesammelt in Abschnitt 9.**

---

## 1. Befund

### 1.1 Zahlen aus der echten Datenbank (nur gelesen)

| Bereich | Befund | Folge für das Konzept |
|---|---|---|
| Pipeline Blauwasser | Recherche 24, Kontaktaufnahme 1, Bedarfsanalyse 1 (verloren), Angebot 0, Verhandlung 0, Gewonnen 0. **Kein Deal hat einen Betrag.** Alle 24 Recherche-Einträge haben ein «nächste Aktion»-Datum und Notizen. | Deine Diagnose stimmt: Die Pipeline ist heute eine Lead-Liste. Summen pro Spalte und ein gewichteter Wert ergeben erst Sinn, wenn Beträge erfasst werden. |
| Website-Anfragen | Die Funktion `website_anfrage_ablegen` legt Anfragen als Deal in der Stufe **mit dem Namen «Kontaktaufnahme»** ab (Einstellung `website_ablage.einstellungen.stufe_name`). Fehlt dieser Name, landen sie in der ersten Spalte. | **Ein Umbenennen der Stufe bricht die Ablage stillschweigend.** Die Migration muss die Einstellung mitziehen (siehe 7.3). |
| Pipeline Freiluftchuchi | Eigene Stufen, ein einziger Deal (gewonnen). | Freiluftchuchi läuft aus. Ich ändere dort nur, was nötig ist (Wahrscheinlichkeiten), und benenne nichts um. |
| Rechnungen | 23 (11 Blauwasser, 12 Freiluftchuchi). **22 bezahlte ohne Zahlungsdatum** (3 aus 2025, 19 aus 2026). Kein Jahr ist abgeschlossen; der Jahresabschluss 2026 ist ein Entwurf. | Der Sammeldialog ist der erste wirkliche Nutzen dieser Runde. Zahlungsdauer (DSO) und Klumpenrisiko sind bis zum Nachtragen wertlos. |
| Zeiten | 85 Einträge, alle verrechenbar, alle schon auf einer Rechnung (81 bezahlt, 4 versendet). Sätze 100, 120 und 130. `invoiced` ist überall `false` (Altfeld, wird nie gesetzt). `manual_status = 'bezahlt'` kommt vor. | Die Ansicht «Nicht verrechnet» ist heute leer. Das ist korrekt und soll als guter Zustand erscheinen, nicht als Fehler. |
| Stundensatz 160 | 160 ist im Code an drei Stellen fest gesetzt (Schnellerfassung, Maske, Timer) und erscheint als Vorbelegung, **bevor** ein Projekt gewählt ist. Die Einträge haben 130, weil der Satz vom Projekt kommt. | Kein Widerspruch in den Daten, aber eine irreführende Anzeige. Lösung: Standardsatz als Einstellung, Feld leer bis ein Projekt gewählt ist. |
| Offerten | 6 (4 «bestätigt» = in Rechnung umgewandelt, 2 abgelehnt). `quotes.opportunity_id` wird nur beim Anlegen aus der Pipeline gesetzt und ist heute überall leer. | Die Verknüpfung Deal und Offerte ist im Schema schon vorhanden; ich nutze sie, ohne Migration. |
| Buchungen | 40, alle Ausgaben. **Lieferant ist bei allen leer** (Feld seit dieser Woche vorhanden). Die häufigsten Texte sind zwei Claude-Abos (8 und 9 Mal). | «Fixkosten nach Lieferant» braucht den Lieferanten. Vorschlag: ein Sammeldialog «Lieferant nachtragen» mit Vorschlag aus dem Text (siehe 6.10). |
| Kontakte | 19 Firmen, 18 Personen (17 als Hauptperson). Daneben steht das alte Textfeld `customers.contact_person` bei 15 Firmen. | Die Verknüpfung «eine Firma, mehrere Personen, eine Hauptperson» besteht schon. Das alte Textfeld wird nur noch gelesen, nicht mehr gepflegt. |
| Wiederkehrende Rechnungen | Gibt es nicht, weder als Funktion noch als Markierung. Monatliche Rechnungen wie «Zusammenarbeit März/April/September» sind von Hand erstellt. | Die Markierung «wiederkehrender Umsatz» ist neu (Migration). |

### 1.2 Befund pro Seite

Kurzform: Zweck, Hauptaufgabe, Probleme. Die geplante Änderung steht in Abschnitt 6.

| Seite (heute) | Zweck und Hauptaufgabe | Probleme (Auswahl, mit Beleg) |
|---|---|---|
| Dashboard `/` | Finanzlage im Zeitraum | Nur Finanzen. Keine Aufgaben, Pipeline oder Zeiten. Zwei Umschalter (Tage/Jahr, 7/30/90). «Offene Rechnungen» zählt nur `versendet` und nicht `überfällig`, während Kunden beides zählt. Zeilen sind nicht klickbar. `vorher/cockpit-1440.png` |
| Sales Pipeline `/sales` | Akquise | Siehe 1.1. Die Karten sind hoch, haben zwei grosse Knöpfe und dominante rote Hinweise. «Neuer Deal» öffnet ein Formular **oberhalb** des Boards statt eines Dialogs. Umbenennen einer Spalte per `window.prompt`. Bei erfolgreicher Umwandlung in einen Kunden erscheint eine **Fehlermeldung** (Fehler im Code). `vorher/pipeline-1440.png`, `vorher/pipeline-maske-1440.png` |
| Offerten `/angebote` | Offerten erstellen, versenden, umwandeln | Seitentitel «Angebote», in der Navigation «Offerten», Nummer «AN-», PDF «Offerte». Keine Suche, kein Filter. Stift ausgegraut sichtbar. Beim Umwandeln gehen Rabatt und Texte verloren. Datum «20.1.2026» und Betrag «CHF 8000.00» ohne Tausendertrennung. `vorher/offerten-1440.png` |
| Projekte `/projekte` | Projekte mit Satz und Budget | Keine Detailseite und keine Suche. Zwei sich überlagernde Lebenszyklen (Status offen/laufend/abgeschlossen **und** archiviert). Budget ohne Verbrauch. «8000.00 CHF» in anderem Format. `vorher/projekte-1440.png` |
| Zeiterfassung `/zeiterfassung` | Zeit erfassen, Überblick | Siehe deine Diagnose; sie stimmt. Dazu: «Detailliert» öffnet eine fast identische Maske. Die Tabelle läuft rechts aus dem Bild (Status abgeschnitten). Nach dem Speichern über den Timer wird die Liste nicht neu geladen. Archivierte Projekte stehen in der Auswahl. Am Handy läuft der Kopf über. `vorher/zeiterfassung-1440.png`, `vorher/zeiterfassung-390.png` |
| Rechnungen `/rechnungen` | Rechnungen erstellen, Zahlung verfolgen | Siehe deine Diagnose; sie stimmt. Die Inline-Erfassung des Zahlungsdatums habe ich in der letzten Runde selbst eingebaut, als Notlösung; sie wird ersetzt. Dazu: «Überfällig» wird nie automatisch gesetzt. `?customerId=` aus der Kundenseite wird ignoriert. Ein Deep Link auf eine bezahlte Rechnung endet in einer Fehlermeldung. Am Handy nur horizontales Scrollen. `vorher/rechnungen-1440.png`, `vorher/rechnungen-390.png` |
| Buchungen `/buchungen` | Ausgaben und Einnahmen mit Beleg | Bereits am besten gelöst (Zeilenmenü, Handy-Liste, Kamera). Es fehlen: Kategorie- und Lieferantenfilter, Ansicht «Unvollständig», Belegvorschau. `vorher/buchungen-1440.png` |
| Auswertungen `/auswertungen` | Zahlen für einen Zeitraum | Siehe deine Diagnose; sie stimmt. Der CSV-Export für den Treuhänder steht hier, der Jahresabschluss hat einen eigenen. `vorher/auswertungen-1440.png` |
| Jahresabschluss `/jahresabschluss` | Milchbüechli-Abschluss | Inhaltlich vollständig (letzte Runde). Gehört aber zu den Berichten. |
| Kunden `/kunden` | Firmenliste | Suche nur im Browser. Drei Icons pro Zeile. Die Personenzahl verlinkt auf eine eigene Seite, die den Tab der Detailseite doppelt. `vorher/kunden-1440.png` |
| Kunde `/kunden/:id` | Firmenseite | Tabs Übersicht, Kontakte, Projekte, Rechnungen. Leere Adresse zeigt ein einsames Icon. **Notizen werden nicht angezeigt**, obwohl sie gespeichert werden. Keine Offerten, Deals oder Zeiten. «Zu Rechnungen» springt auf eine ungefilterte Liste. `vorher/kunde-detail-1440.png` |
| Kontakte `/kunden/:id/kontakte`, `/kontakte` | Personen | Drei Implementierungen für dasselbe (Tab, eigene Seite, Gesamtliste). In der Gesamtliste lassen sich Personen nicht bearbeiten. `vorher/kunde-kontakte-1440.png`, `vorher/kontakte-1440.png` |
| Produkte `/produkte` | Leistungen für Positionen | Wird selten bearbeitet; die Maske hat einen doppelten Titel. |
| Einstellungen `/settings` | Firma, Profil, Texte, Kategorien, Pipeline | Sechs Tabs. Es fehlen Standardsatz, Zahlungsfrist und Nummernkreise. Ein Phasenwechsel per URL greift nur beim ersten Laden. Phasen lassen sich nicht umsortieren. `vorher/einstellungen-1440.png` |
| Kopfzeile, Suche | Suche (Ctrl+K) | Ctrl+K setzt nur den Fokus ins Suchfeld; es gibt **keine Palette und keine Aktionen**. Offerten, Personen, Deals und Zeiten werden nicht durchsucht. Auf dem Handy gibt es **keine Suche**. |

### 1.3 Übergreifende Muster

1. **Uneinheitliche Begriffe:** Angebot/Offerte, Kunde/Firma/Interessent/Kontakt, «Firma» auch für das eigene Unternehmen.
2. **Uneinheitliche Bausteine:** drei Arten von Meldungen (Toast, eigene Toasts, Banner), Formular inline oder als Dialog, Aktionen als Icons, Menü oder ausgegraut.
3. **Keine Filter in der URL:** Links von einer Seite auf eine gefilterte Liste (`?customerId=`) laufen ins Leere.
4. **Alles wird ungefiltert geladen**, gefiltert wird im Browser. Bei 85 Zeiten und 23 Rechnungen ist das heute kein Leistungsproblem, aber es verhindert Lesezeichen und wird mit den Jahren langsamer.
5. **Uneinheitliche Formate:** «CHF 8000.00», «8000.00 CHF», «CHF 8'000.00»; «20.1.2026» neben «20.01.2026».
6. **Handy:** Nur die Buchungen haben eine Kartenliste.

---

## 2. Kritische Prüfung deines Vorschlags

Grösstenteils übernehme ich ihn so. Wo ich abweiche oder ergänze, steht hier die Begründung.

### 2.1 Übernommen

Navigation entlang des Ablaufs, ein Listen-Template, Status als Tabs mit Anzahl, Hinweise gesammelt in «Zu erledigen», eine Hauptaktion pro Seite, Sammeldialog für Zahlungsdaten, Zahlungsdatum bei jedem «bezahlt», Berichte als eine Seite mit Tabs, Leads getrennt von Deals, kompakte Karten mit Summen, Befehlspalette mit Schnellaktionen, Glossar.

### 2.2 Abweichungen und Ergänzungen

**A. Leads nicht als eigene Tabelle, sondern als Art in `opportunities`.**
Eine neue Tabelle `leads` hiesse: 24 Einträge kopieren und die Originale stehen lassen (löschen ist verboten), also doppelte Daten. Dazu schreibt die Website-Ablage in `opportunities`, und «In Pipeline übernehmen» müsste Daten zwischen Tabellen verschieben.
Vorschlag: neue Spalte `opportunities.kind` (`lead` oder `deal`, Standard `deal`) plus `lead_status` und `source`. Ein Lead wird zum Deal, indem `kind` umgestellt und eine Phase gesetzt wird. Die ID bleibt gleich, Notizen und Verlauf bleiben erhalten, und die Migration lässt sich zurücknehmen. Für dich sieht es trotzdem aus wie zwei getrennte Listen.

**B. «Verloren» als Filter, nicht als Spalte.**
Heute gibt es `is_lost`, unabhängig von der Phase. Das ist besser als eine Spalte «Verloren», denn so sehe ich später, **in welcher Phase** ein Deal verloren ging. Ich behalte das so und blende Verlorene über den Filter ein. «Gewonnen» bleibt eine Spalte, wird aber eingeklappt, sobald sie mehr als drei Karten hat.

**C. Das Wort «Firma» ist doppelt belegt.**
In der App heisst heute auch dein **eigenes** Unternehmen «Firma» (Firmenprofil, «Neue Firma erstellen», Firmenwechsel). Wenn Kunden ebenfalls «Firma» heissen, ist «Firma und Logo» in den Einstellungen missverständlich.
Vorschlag: Kunden und Interessenten heissen **Firma** und **Person**; dein eigenes heisst **Unternehmen** (Einstellungen «Unternehmen und Logo», «Unternehmen wechseln»). Steht so im Glossar.

**D. Navigationspunkt «Kontakte» statt «Firmen und Personen».**
Unter der Gruppe «Kontakte» stünde sonst ein einziger, langer Punkt. Vorschlag: Der Punkt heisst «Kontakte», die Seite hat den Umschalter «Firmen | Personen». Gruppen mit nur einem Eintrag (Übersicht, Kontakte) bekommen keine Gruppenüberschrift.

**E. Datensatzseite in zwei statt drei Spalten.**
Bei 1440 px bleiben nach der Seitenleiste rund 1150 px. Drei Spalten würden die Tabs in der Mitte auf etwa 600 px quetschen, gerade bei Rechnungen und Zeiten.
Vorschlag: Highlights über die ganze Breite, darunter links Tabs (rund zwei Drittel), rechts eine Spalte «Verknüpft» (rund ein Drittel). Unter 1280 px rutscht die rechte Spalte unter die Tabs. Kerndaten und Schnellaktionen stehen in den Highlights statt in einer eigenen linken Spalte.

**F. Rechnung als Seite, Drawer nur für kleine Änderungen.**
Eine PDF-Vorschau im Drawer ist zu schmal zum Lesen. Vorschlag:
- `/rechnungen/:id` ist eine Seite mit Vorschau, Zahlung, Verlauf und Menü.
- Der Drawer dient für Zahlungsdatum, Status und Fälligkeit, ohne die Liste zu verlassen.
- Deals öffnen im Drawer, weil man im Board bleiben will.

**G. Aktivitäten und Dateien: was es heute gibt und was neu ist.**
Es gibt keine Aktivitäten, nur ein Notizfeld pro Firma und pro Deal. Ein vollständiges Aktivitätenmodul (Anrufe, Mails, Aufgaben) wäre eine eigene Runde.
Vorschlag für jetzt:
- Der Zeitstrahl **wird aus vorhandenen Ereignissen abgeleitet**: Offerte erstellt, Rechnung erstellt, versendet, bezahlt, Zeit erfasst, Deal-Phase gewechselt. Dazu kommen **Notizen** in einer neuen, kleinen Tabelle `notes`.
- Für «versendet» fehlt ein Datum. Deshalb gibt es neu `invoices.sent_at` und `quotes.sent_at`, gesetzt beim Statuswechsel.
- Der Tab «Dateien» zeigt vorerst die PDFs der Rechnungen und Offerten sowie Belege, die mit dieser Firma verknüpft sind. Ein eigener Dateiablage-Bereich pro Firma ist eine spätere Ausbaustufe.

**H. Zahlungsdatum: Fälligkeitsdatum nicht automatisch vorbelegen.**
Wenn alle 22 Rechnungen das Fälligkeitsdatum bekommen, beträgt die Zahlungsdauer überall exakt die Zahlungsfrist. DSO und «Kunden mit Verspätung» wären dann erfunden. Dazu entscheidet `paid_at`, **in welchem Jahr** eine Einnahme zählt.
Vorschlag: Die Felder sind leer. Ein Knopf «Fälligkeitsdatum übernehmen» gilt für alle oder pro Zeile, als bewusste Wahl. So kannst du die echten Daten aus dem E-Banking eintragen, wo du sie findest, und den Rest bewusst schätzen.
Rechnungen mit übernommenem Datum werden markiert (`paid_at_source = 'faelligkeit'`). DSO lässt diese Rechnungen weg und weist die Zahl offen aus («3 Rechnungen ohne echtes Zahlungsdatum nicht berücksichtigt»).

**I. Überfällig automatisch ableiten.**
Heute ist «überfällig» ein von Hand gesetzter Status, und Dashboard und Kunden zählen ihn unterschiedlich. Vorschlag: «Überfällig» ist eine **abgeleitete Ansicht**: versendet und Fälligkeit vor heute. Der gespeicherte Status bleibt `versendet`. Der alte Wert `überfällig` wird weiterhin gelesen und wie «versendet» behandelt. Keine Datenänderung.

**J. MWST-Schwelle und AHV: nur pro Unternehmen.**
Rechtlich gelten MWST-Grenze und AHV für die Person, also für beide Einzelfirmen zusammen. **Entscheid vom 11.10.2026:** Die Freiluftchuchi läuft aus, deshalb rechnet das Cockpit **nur das gewählte Unternehmen** (Blauwasser IT) und vermischt die beiden nicht. Für die Schwelle zählt der vereinbarte Umsatz (Rechnungen nach Rechnungsdatum, ohne Entwürfe).

**K. Rückstellungen genauer rechnen.**
- **AHV/IV/EO:** 10 Prozent, wie von dir vorgeschlagen. Der Tooltip nennt zwei Punkte:
  - die sinkende Skala unter rund CHF 60'000 Einkommen;
  - die Verwaltungskosten der Ausgleichskasse und die FAK-Beiträge, die je nach Kanton dazukommen.
  
  Den Satz kannst du anpassen.
- **Steuern:** Die AHV-Beiträge sind abzugsfähig. Deshalb rechne ich die Steuer auf (Gewinn − AHV-Rückstellung), nicht auf den Gewinn. Sonst wird die Steuer leicht überschätzt.
- Fusszeile wie gewünscht: «Schätzung, ersetzt keine Steuerberatung.»

**L. Wiederkehrende Ausgaben: Markierung an der Buchung, mit klarer Regel.**
Die Markierung `is_recurring` an jeder Buchung (dein Vorschlag) lässt offen, welche Buchung die Vorlage ist und wann ein Abo endet. Ich übernehme sie trotzdem, denn sie ist einfach und passt zur Buchungsmaske. Dazu kommt eine feste Regel:
- Eine Serie ist alles mit gleichem Lieferanten (ersatzweise gleicher Kategorie und gleichem Text) und Markierung.
- Der aktuelle Betrag ist die jüngste Buchung der Serie.
- Eine Serie gilt als beendet, wenn zwei Intervalle lang keine Buchung kam.

Diese Regel ist eine reine Funktion mit Tests. Eine eigene Tabelle «Abos» wäre sauberer, ist aber Doppelerfassung; die lasse ich weg.

**M. Wiederkehrender Umsatz auf Rechnungsebene.**
Die Markierung kommt an die Rechnung, nicht an die Position. Deine monatlichen Rechnungen sind entweder ganz Retainer oder gar nicht. Eine Markierung pro Position lässt sich später ergänzen.
Neu ist auch «Kopie als neue Rechnung». Sie ersetzt fehlende wiederkehrende Rechnungen fürs Erste: Kopie, Datum anpassen, fertig.

**N. Leistung: Filter über die Datenbank, wo es zählt.**
Rechnungen, Offerten, Zeiten, Buchungen und Kontakte laden mit Filter und Seitenweise (50) aus der Datenbank, der Filter steht in der URL. Die **Summen** der Tabs und Kennzahlen kommen aus einer schlanken Abfrage (nur Status, Betrag, Datum) und nicht aus der ganzen Liste. Ausnahme: Cockpit und Berichte rechnen weiterhin über die zentrale Aggregation, denn ein Gewinn braucht alle Buchungen eines Jahres.

**O. Cockpit: Gefahr der Überladung.**
Deine Liste umfasst rund 15 Blöcke. Damit das Cockpit ruhig bleibt:
- «Zu erledigen» ist eine **kompakte Liste**, keine Karten.
- Die erste Priorität sind **fünf Karten** in zwei Spalten.
- Kennzahlen und Verlauf stehen in einer Zeile mit vier Werten und einem Chart.
- Die zweite Priorität ist **eine** einklappbare Gruppe «Weitere Kennzahlen», standardmässig zu.
- Karten ohne Daten zeigen statt leerer Werte einen einzigen Satz und die Aktion (zum Beispiel «Jahresziel festlegen»).

**P. Gutschrift.**
Gibt es heute nicht. Eine Gutschrift mit QR-Teil ist fachlich heikel, denn ein negativer Betrag darf nicht auf den QR-Teil. Ich biete im Menü bezahlter Rechnungen «Kopie als neue Rechnung» an. Die Gutschrift kommt in die Liste für später.

---

## 3. Neue Navigation

```
Cockpit                        /
Kontakte                       /kontakte          (Firmen | Personen)
VERKAUF
  Leads                        /leads
  Pipeline                     /pipeline
  Offerten                     /offerten
ARBEIT
  Projekte                     /projekte
  Zeiterfassung                /zeiterfassung
FINANZEN
  Rechnungen                   /rechnungen
  Buchungen                    /buchungen
  Berichte                     /berichte          (Übersicht | Erfolgsrechnung | Jahresabschluss | Export)
────────
Einstellungen                  /einstellungen
```

Zähler in der Navigation (dezentes, neutrales Badge): Leads «neu», Rechnungen überfällig. Keine weiteren, sonst wird die Leiste laut.

**Weiterleitungen** (Lesezeichen funktionieren weiter, Parameter bleiben erhalten):

| Alt | Neu |
|---|---|
| `/sales` | `/pipeline` |
| `/angebote` | `/offerten` |
| `/kunden` | `/kontakte?ansicht=firmen` |
| `/kunden/:id` | `/kontakte/firmen/:id` |
| `/kunden/:id/kontakte` | `/kontakte/firmen/:id?tab=personen` |
| `/kontakte` (alte Gesamtliste) | `/kontakte?ansicht=personen` |
| `/produkte` | `/einstellungen/leistungen` |
| `/auswertungen` | `/berichte?tab=uebersicht` |
| `/jahresabschluss` | `/berichte?tab=jahresabschluss` |
| `/settings?tab=…` | `/einstellungen/<bereich>` |
| `/rechnungen?filter=ohne-zahlungsdatum` | `/rechnungen?ansicht=bezahlt&ohne-zahlungsdatum=1` |

Die Website-Ablage und PDFs verwenden keine dieser URLs; es gibt keine externen Links, die brechen.

Auf dem Handy bleibt das Menü links (Hamburger). Neu kommt unten eine Leiste mit vier Zielen: Cockpit, Zeit erfassen, Buchung erfassen, Suche. Das sind die drei Abläufe, die du am Handy brauchst.

---

## 4. Gemeinsame Bausteine

Alles aus vorhandenen Tokens und Klassen (`btn-cta`, `toggle-group`, `badge-*`, `card`, `table`). Keine neuen Farben, Schriften oder Effekte, keine neue Bibliothek. Drag-and-drop gibt es schon (dnd-kit); Virtualisierung braucht es bei diesen Mengen nicht, Paginierung genügt.

### 4.1 Listen-Template `ListPage`

```
┌──────────────────────────────────────────────────────────────┐
│ RECHNUNGEN                               [Export]  (+ NEUE)  │  Kopf: Titel, 1 Satz Lage, 1 Pill
│ 1 offen · CHF 1'490 überfällig                               │
├──────────────────────────────────────────────────────────────┤
│ [Offen CHF 1'490] [Überfällig CHF 1'490] [Bezahlt 2026 …] [Entwürfe 1] │  Kennzahlen = Filter
├──────────────────────────────────────────────────────────────┤
│ Alle 6 │ Entwurf 1 │ Versendet 1 │ Überfällig 1 │ Bezahlt 4  │  Tabs mit Anzahl (URL)
├──────────────────────────────────────────────────────────────┤
│ ⌕ Suchen…   Firma ▾   Zeitraum ▾                    3 Filter ✕│  Werkzeugleiste
├──────────────────────────────────────────────────────────────┤
│ ☐ Nr ▴     Firma            Datum      Fällig     Betrag  ⋯  │  Kopf bleibt stehen
│ ☐ RE-…005  Muster Treuh…    28.09.     28.09.  1'490.00  ⋯  │  feste Höhe 48 px
├──────────────────────────────────────────────────────────────┤
│ 2 ausgewählt   [Als bezahlt markieren]  [Export]   ✕         │  Sammelleiste (nur bei Auswahl)
└──────────────────────────────────────────────────────────────┘
```

- **URL-Zustand:** `ansicht`, `q`, `firma`, `projekt`, `von`, `bis`, `seite`, `sort`. Ein Hook `useListState()` liest und schreibt das über `useSearchParams`. Getestet.
- **Beträge** immer `formatChfDisplay` (CHF 1'234.50), rechtsbündig, tabellarische Ziffern. **Datum** immer `TT.MM.JJJJ`.
- **Zeilenmenü (⋯):** ein Knopf pro Zeile mit Beschriftung für Bildschirmleser. Nicht mögliche Aktionen sind **ausgeblendet**. Löschen steht immer zuletzt und getrennt.
- **Zeilenklick** öffnet die Detailansicht. Checkbox und Menü fangen den Klick ab. Mit der Tastatur: Pfeil hoch/runter, Enter, Leertaste zum Auswählen.
- **Handy:** Die Tabelle wird zur Kartenliste (wie heute bei Buchungen), mit Titel, Betrag, Status und Menü.
- **Leerzustand:** ein Satz und die passende Aktion. Ein gefilterter Leerzustand hat «Filter zurücksetzen». Die Ansicht «Nicht verrechnet» ohne Einträge sagt «Alle Zeiten sind verrechnet.»
- **Laden:** Skeleton in Zeilenform. **Ab 50 Einträgen** gibt es Seiten (`range()` in der Abfrage).

### 4.2 Weitere Bausteine

| Baustein | Zweck | Grundlage |
|---|---|---|
| `Drawer` | Seitenpanel rechts, 480 px, auf dem Handy als Blatt. Fokusfalle, Escape, Titel, Fussleiste mit Aktionen | `Modal.tsx` (Fokusfalle) |
| `RowMenu` | Menü ⋯ mit Einträgen, Trennlinie, gefährlicher Aktion | Menü aus `TransactionTable` |
| `BulkBar` | Leiste mit Aktionen für die Auswahl | neu |
| `ViewTabs` | Tabs mit Anzahl (und optional Summe), an die URL gebunden | `SegmentedControl` |
| `KpiStrip` | 3–4 kompakte Kennzahlen, klickbar als Filter, aktiver Zustand mit Ring | `KPICard` (kompakte Variante) |
| `RecordHeader` | Highlights einer Datensatzseite: Titel, Status-Badge, 3–5 Werte, Hauptaktion, Menü | `PageHeader` |
| `Timeline` | Zeitstrahl aus Ereignissen und Notizen | neu |
| `TodoList` | «Zu erledigen»: Zeile mit Anzahl, Satz und Ziel-Link | neu |
| `CommandPalette` | Ctrl+K: Suche und Schnellaktionen, Pfeiltasten, Enter | ersetzt das heutige Suchfeld-Verhalten |
| Meldungen | **nur** `react-hot-toast` für Rückmeldungen, `Notice` für bleibende Hinweise | die beiden eigenen Toast-Varianten entfallen |

### 4.3 Datensatzseite

```
← Kontakte
┌───────────────────────────────────────────────────────────────┐
│ BEISPIEL GMBH  [Aktiv]                     (+ NEUE RECHNUNG) ⋯│
│ Umsatz 2026 CHF 3'200 │ Offen CHF 0 │ Nicht verrechnet 9.5 h │ 1 Projekt │
├───────────────────────────────────────┬───────────────────────┤
│ Übersicht │ Verlauf │ Verkauf │ Zeiten │ Dateien │ PERSONEN (2)  + │
│                                       │ ★ Anna Beispiel       │
│  (Tab-Inhalt)                         │ PROJEKTE (1)        + │
│                                       │ DEALS (0)           + │
│                                       │ ADRESSE, NOTIZ        │
└───────────────────────────────────────┴───────────────────────┘
```

- **Tabs** in der URL (`?tab=`): Übersicht, Verlauf (Zeitstrahl und Notizen), Verkauf (Deals, Offerten, Rechnungen), Zeiten, Dateien.
- Die **rechte Spalte** hat pro Verknüpfung einen Kopf mit Anzahl und «+» als Schnellanlage mit vorbelegter Firma.
- Die **Hauptaktion** passt zum Datensatz: Firma «Neue Rechnung», Projekt «Zeit erfassen», Deal «Offerte erstellen», Offerte «In Rechnung umwandeln» (wenn akzeptiert), Rechnung «Als bezahlt markieren» (wenn offen).
- **Pfad** bei Deals: Phasen als Leiste, Klick wechselt die Phase (mit Rückgängig im Toast).

---

## 5. Begriffe (Auszug, vollständig in `docs/glossar.md` in Phase B)

| Begriff | Bedeutung | Nicht mehr |
|---|---|---|
| Unternehmen | dein eigenes Geschäft (Blauwasser IT, Freiluftchuchi) | Firma (für das eigene) |
| Firma | Kunde oder Interessent als Organisation | Kunde (in der Oberfläche), Organisation |
| Person | Ansprechperson einer Firma | Kontakt, Kontaktperson |
| Lead | noch nicht qualifizierter Interessent | Recherche-Deal |
| Deal | Verkaufschance ab Erstgespräch | Opportunity, Chance |
| Offerte | Angebot an eine Firma | Angebot |
| Rechnung | | Faktura |
| Buchung | Einnahme oder Ausgabe im Milchbüechli | Transaktion |
| Lieferant / Zahler | Gegenpartei einer Buchung | |
| Leistung | Produkt oder Dienstleistung für Positionen | Produkt (in der Navigation) |
| verrechenbar | eine Zeit darf in Rechnung gestellt werden | |
| verrechnet | eine Zeit steht auf einer Rechnung | |

Die Nummern neuer Offerten beginnen mit `OF-` statt `AN-`. Bestehende Nummern bleiben unverändert, denn sie stehen auf versendeten PDFs.

---

## 6. Seite für Seite

Geplante Änderung je Seite. Mit **entfällt** markiert ist jede Funktion, die es danach nicht mehr gibt (Liste in 6.13).

### 6.1 Cockpit (bisher Dashboard)

Untertitel als Lagesatz, zum Beispiel «3 Dinge zu erledigen, CHF 1'490 offen». Die Zeitraum-Umschalter oben **entfallen**; das Chart hat einen eigenen Umschalter 12 Monate / 90 Tage.

1. **Zu erledigen** (nur wenn etwas da ist), eine Zeile je Punkt mit Anzahl und Ziel:

   | Punkt | Ziel |
   |---|---|
   | Überfällige Rechnungen | `/rechnungen?ansicht=ueberfaellig` |
   | Bezahlt ohne Zahlungsdatum | Sammeldialog |
   | Deals mit fälliger nächster Aktion | `/pipeline?ansicht=faellig` |
   | Nicht verrechnete Stunden älter als 30 Tage | `/zeiterfassung?ansicht=offen&bis=…` |
   | Buchungen ohne Beleg oder Kategorie | `/buchungen?ansicht=unvollstaendig` |
   | Fristen in den nächsten 14 Tagen | Frist-Drawer |
   | Kontostand älter als 30 Tage | Maske «Kontostand erfassen» |
   | Neue Leads | `/leads?ansicht=neu` |

2. **Steuerung** (5 Karten, 2 Spalten):
   - a) **Frei verfügbar:**
     - gestapelter Balken AHV / Steuern / frei, darunter die drei Beträge;
     - Steuer auf (Gewinn − AHV), siehe 2.2 K;
     - Fusszeile «Schätzung, ersetzt keine Steuerberatung.»
   - b) **Liquidität in 30 / 60 / 90 Tagen:**
     - drei Werte und eine kleine Linie;
     - überfällige Rechnungen separat, nicht eingerechnet;
     - `warning` unter der Mindestreserve, `negative` unter 0;
     - ohne Kontostand nur der Knopf «Kontostand erfassen».
   - c) **Abhängigkeit (12 Monate):**
     - Top 3 Firmen mit Prozent und Balken;
     - `warning` ab 50 %, `negative` ab 70 %, Tooltip wie vorgeschlagen.
   - d) **Ziel gegen Ist:**
     - Balken mit Zeitmarke;
     - nötig pro Monat;
     - gewichtete Pipeline der nächsten drei Monate im Vergleich zur Lücke;
     - ohne Ziel nur «Jahresziel festlegen».
   - e) **MWST-Schwelle:**
     - 12 Monate, nur das gewählte Unternehmen (2.2 J);
     - `warning` ab 80 %, `negative` ab 100 % mit «MWST-Pflicht prüfen, Anmeldung bei der ESTV nötig»;
     - ausgeblendet bei `vat_registered`.
3. **Kennzahlen und Verlauf:**
   - Einnahmen dieses Jahr (mit Vorjahr bis zum gleichen Tag), offene Debitoren, nicht verrechnete Leistungen CHF, Ausgaben dieses Monats;
   - Chart Einnahmen/Ausgaben (bestehender `FinancialChart`, 12 Monate oder 90 Tage);
   - daneben die Kurzlisten «Nächste Fälligkeiten» und «Nächste Aktionen», je 5 Zeilen, klickbar.
4. **Weitere Kennzahlen** (eingeklappt, Zustand pro Gerät gespeichert): f) Auslastung und effektiver Stundensatz, g) wiederkehrender Umsatz und MRR, h) Fixkosten pro Monat nach Lieferant mit Hinweis über 10 %, i) Zahlungsdauer gesamt und pro Firma, j) Fristen, k) Akquise.

Alle Berechnungen sind reine Funktionen in `src/utils/cockpit/`, je mit Tests inklusive leerer Daten. Sie bauen auf `buildFinanceEntries`/`summarize` auf.

### 6.2 Kontakte (bisher Kunden, Alle Kontakte, Kunden-Kontakte)

- **Liste mit Umschalter Firmen | Personen** (`?ansicht=`):
  - Firmen-Spalten: Name, Hauptperson, Ort, Umsatz 12 Monate, Offen, Status.
  - Personen-Spalten: Name, Funktion, Firma, E-Mail, Telefon.
- Tabs Aktiv | Archiviert | Alle. Suche über die Datenbank.
- Zeilenmenü:
  - Firmen: Bearbeiten, Archivieren/Wiederherstellen, Löschen (nur ohne Verknüpfungen, sonst ausgeblendet mit Hinweis im Menü).
  - Personen: Bearbeiten, Als Hauptperson, Löschen.
- **Firmenseite** `/kontakte/firmen/:id` nach 4.3: Highlights Umsatz dieses Jahr, Offen, Nicht verrechnet (h und CHF), laufende Projekte. **Notizen werden angezeigt.**
- Die Seite `/kunden/:id/kontakte` **entfällt** (Weiterleitung auf den Tab), ebenso die Kartenansicht der alten Gesamtliste (ersetzt durch die Personenliste).
- Personen anlegen und bearbeiten: **eine** Maske statt drei.
- Das alte Feld «Kontaktperson» der Firma erscheint in der Maske nicht mehr. Beim Anlegen einer Firma entsteht wie heute direkt eine Hauptperson. Die Daten bleiben in der Spalte erhalten.

### 6.3 Leads (neu)

- Liste mit Firma, Person, Quelle, letzter Kontakt, nächster Schritt (Datum und Text), Status.
- Tabs Neu | Kontaktiert | Kein Interesse | Alle.
- Hauptaktion «Neuer Lead».
- Zeilenmenü: «In Pipeline übernehmen» (wählt Phase Erstgespräch, fragt nach Titel und Betrag), «Als Firma anlegen», «Kein Interesse», Löschen.
- Sammelaktionen: Status setzen, In Pipeline übernehmen.
- Der Hinweis auf alten Kontakt ist ein kleines orangefarbenes Uhr-Icon mit Tooltip (`attention`), kein Block.

### 6.4 Pipeline

- **Board | Tabelle** (`?darstellung=`). Filter «Nur fällige nächste Aktionen», «Verlorene anzeigen».
- **Spaltenkopf:** Name, Anzahl, Summe CHF, gewichtet (klein, gedämpft).
- **Karte** (rund 88 px hoch): Firma, Titel, Betrag (oder «ohne Betrag» gedämpft), nächstes Aktionsdatum, Icon bei überfälliger Aktion, Menü ⋯ (Offerte erstellen, Als Firma anlegen, Verloren, Löschen). Die zwei grossen Knöpfe **entfallen** zugunsten von Menü und Drawer.
- **Klick öffnet den Deal-Drawer:** Pfad, Kerndaten, nächste Aktion, Notizen, verknüpfte Offerten, Aktionen.
- «Neuer Deal» öffnet den Drawer statt des Formulars über dem Board. Umbenennen per `window.prompt` **entfällt**; Phasen werden in den Einstellungen verwaltet und sortiert.
- Fehler beheben: Die erfolgreiche Umwandlung zeigt Erfolg statt Fehler.
- **Offerte und Deal:** Eine aus dem Deal erstellte Offerte trägt `opportunity_id`.
  - Beim Versenden fragt ein Toast «Deal in Phase Offerte verschieben?».
  - Bei Akzeptiert lautet die Frage «Deal als gewonnen markieren?».
  - Bei Abgelehnt ist kein Automatismus vorgesehen.

### 6.5 Offerten

- Listen-Template. Kennzahlen: Offen CHF, Akzeptiert (noch nicht umgewandelt) CHF, Annahmequote 12 Monate.
- Tabs Entwurf | Versendet | Akzeptiert | Abgelehnt | Abgelaufen | Umgewandelt | Alle.
  - «Entwurf» entspricht dem heutigen Status `offen`.
  - «Abgelaufen» wird abgeleitet: versendet und `valid_until` vor heute.
  - Der Status `ueberfallig` wird als «Abgelaufen» gelesen.
  - «Umgewandelt» entspricht `bestaetigt`.

  Die Status-Werte bleiben, nur die Beschriftung ändert.
- **Detailseite** `/offerten/:id`: Vorschau, Verknüpfung zu Firma und Deal, Verlauf, Hauptaktion «In Rechnung umwandeln» bei Akzeptiert.
- Beim Umwandeln gehen Rabatt sowie Einleitung und Schluss neu **mit** (heute gehen sie verloren). Die Zahlungsfrist kommt aus den Einstellungen statt der festen 30 Tage.
- «Bearbeiten» ist bei umgewandelten Offerten ausgeblendet. Im Menü gibt es stattdessen «Kopie als neue Offerte».

### 6.6 Projekte

- Liste mit Firma, Status, Budget, verbraucht (h und CHF) mit Fortschrittsbalken (`warning` ab 80 %, `negative` ab 100 %) und nicht verrechnet.
- Tabs Laufend | Offen | Abgeschlossen | Archiviert | Alle. Das Archiv bleibt als eigenes Flag, erscheint aber nur als Tab.
- **Projektseite** `/projekte/:id`: Highlights Budget, verbraucht, nicht verrechnet, Satz (mit Herkunft). Tabs Zeiten, Rechnungen, Notizen. Hauptaktion «Zeit erfassen». Im Menü «Rechnung aus offenen Zeiten».

### 6.7 Zeiterfassung

- **Schnellerfassung** oben bleibt.
  - Der Satz ist leer, bis ein Projekt gewählt ist. Dann steht er mit Herkunft als Text da («CHF 130 vom Projekt»), statt des Badges P/K/S.
  - Standardsatz aus den Einstellungen statt fest 160.
  - Der **Timer** aus der Kopfzeile erscheint zusätzlich als Knopf «Timer starten» in der Schnellerfassung, mit vorgewähltem Projekt.
  - Nach dem Speichern über den Timer wird die Liste neu geladen. Das «Play» nach abgebrochenem Speichern verliert die Zeit nicht mehr.
- «Detailliert» **entfällt**. Die Schnellerfassung bekommt das fehlende Feld (der Betrag wird ohnehin angezeigt), Bearbeiten läuft über den Drawer.
- **Tabs:** Nicht verrechnet (Standard) | Diese Woche | Dieser Monat | Verrechnet | Alle | Auswertung.
- **Gruppierung:** Woche | Firma | Projekt (`?gruppe=`). Jede Gruppe hat eine Kopfzeile mit Zwischensumme h und CHF; oben steht die Gesamtsumme der Ansicht.
- **Zwei Spalten** statt einer:
  - **Verrechenbar:** Ja/Nein.
  - **Verrechnung:**
    - «offen»;
    - «auf Rechnung RE-… (Entwurf/versendet)» mit Link;
    - «bezahlt» mit Link;
    - «bezahlt (manuell)» bei `manual_status`.
  - Das Popover «Status setzen» bleibt im Zeilenmenü.
- **Sammelaktion «Rechnung erstellen»:**
  - nur bei Zeiten **einer** Firma, sonst ist der Knopf deaktiviert und erklärt das;
  - öffnet die Rechnungsmaske mit diesen Zeiten, gebündelt wie beim bestehenden Import (Woche × Projekt);
  - der vorhandene `TimeEntryImportModal` wird dafür so umgebaut, dass er eine Vorauswahl annimmt.

  Der Satz kommt aus der Erfassung (Snapshot), nicht neu vom Projekt. Das behebt die Abweichung im heutigen Import.
- **Auswertung** (bisher Reporting): bleibt mit Stunden pro Firma und Projekt, verrechenbarem Anteil und effektivem Satz.
- Auswahllisten zeigen nur aktive Projekte.

### 6.8 Rechnungen

- Kennzahlen: Offen CHF, Überfällig CHF, Bezahlt dieses Jahr CHF, Entwürfe (Anzahl).
- Tabs Alle | Entwurf | Versendet | Überfällig (abgeleitet, 2.2 I) | Bezahlt.
- Suche über Nummer, Titel und Firma. Filter Firma, Projekt, Zeitraum.
- **Zeilen ohne Inline-Formular.** Über der Liste steht ein Hinweis: «22 bezahlte Rechnungen ohne Zahlungsdatum. Sie fehlen in Einnahmen und Berichten.» Der Knopf «Zahlungsdaten nachtragen» öffnet den **Sammeldialog**:
  - Tabelle mit Nr, Firma, Rechnungsdatum, Fällig, Betrag und einem Datumsfeld je Zeile;
  - «Fälligkeitsdatum übernehmen» für alle oder je Zeile (2.2 H);
  - ein «Speichern» für alle und eine Zusammenfassung «19 gespeichert, 3 leer gelassen».
- **«Als bezahlt markieren»** einzeln (Drawer) und als Sammelaktion fragt immer das Datum ab, Standard heute. Beim Wechsel auf «bezahlt» in der Maske ist das Datum Pflicht.
- **Zeilenmenü:**

  | Rechnung | Aktionen |
  |---|---|
  | offen | Bearbeiten, Vorschau, PDF, Als versendet markieren, Als bezahlt markieren, Löschen |
  | bezahlt | Vorschau, PDF, Zahlungsdatum ändern, Kopie als neue Rechnung |

  Bearbeiten ist bei bezahlten Rechnungen ausgeblendet.
- **Detailseite** `/rechnungen/:id`: Vorschau (bestehende PDF-Erzeugung), Zahlung, Verlauf (erstellt, versendet `sent_at`, bezahlt), verknüpfte Zeiten und Offerte, Menü. Ein Deep Link auf eine bezahlte Rechnung öffnet diese Seite statt einer Fehlermeldung.
- Die Markierung «Wiederkehrender Umsatz» steht als Schalter in der Maske.

### 6.9 Buchungen

- Tabs Alle | Ausgaben | Einnahmen | **Unvollständig** (ohne Beleg, ohne Kategorie oder ohne Lieferant).
- Filter Kategorie, Lieferant, Zeitraum; Suche. Heutige Paginierung (10) wird 50.
- **Drawer mit Belegvorschau** (Bild oder PDF) und den Feldern. Bearbeiten im Drawer.
- In der Buchungsmaske gibt es einen Schalter «Wiederkehrend» mit Intervall.
- **Sammelaktion «Lieferant setzen»**. Dazu gibt es einen Hinweis-Dialog «Lieferanten nachtragen», der aus dem Text Vorschläge macht. Du bestätigst nur.
- Virtuelle Einnahmen aus Rechnungen bleiben sichtbar und verlinken auf die Rechnung.

### 6.10 Berichte (bisher Auswertungen und Jahresabschluss)

- `/berichte` mit Tabs Übersicht | Erfolgsrechnung | Jahresabschluss | Export.
- **Übersicht:** Zeitraum-Auswahl wie heute. Kennzahlen mit Vorjahresvergleich, darunter das Chart, darunter vier Tabellen (Einnahmen nach Kategorie und Firma, Ausgaben nach Kategorie und Lieferant).
  - Agentur-Kennzahlen: Umsatz pro Firma (Top 5), effektiver Satz, verrechenbare Quote.
  - Der Umschalter Buchungen/Charts **entfällt**.
  - Leere Bereiche erscheinen als eine Zeile.
- **Erfolgsrechnung:** Darstellung «Milchbüechli | Gliederung OR» aus dem Jahresabschluss, frei für jeden Zeitraum.
- **Jahresabschluss:** unverändert (letzte Runde), nur verschoben.
- **Export:** CSV für den Treuhänder (heute bei Auswertungen) und die Exporte des Jahresabschlusses an einem Ort.

### 6.11 Einstellungen

Die linke Unternavigation ersetzt die Tabs. Jeder Bereich hat eine eigene URL `/einstellungen/<bereich>`:

| Bereich | Inhalt | Neu oder verschoben |
|---|---|---|
| Unternehmen und Logo | heutiges Firmenprofil | verschoben |
| Ziele und Schätzungen | Umsatzziel je Jahr, Stundenziel je Woche, AHV-Satz, Steuersatz, Mindestreserve, MWST-Grenze, Schwellen Klumpenrisiko | neu |
| Pipeline | Phasen mit Wahrscheinlichkeit, Reihenfolge per Ziehen, Lead-Quellen | erweitert |
| Kontostände | Liste und Maske (Datum, Betrag, Konto, Notiz) | neu |
| Fristen | Liste, Maske, Wiederholung, Vorlagen (Steuererklärung, AHV-Akonto quartalsweise) | neu |
| Rechnungen und Offerten | Textvorlagen, Zahlungsfrist, Standardsatz, MWST (aus dem Firmenprofil), Nummernkreise | teils neu |
| Leistungen und Produkte | heutige Seite Produkte und Produktkategorien | verschoben |
| Kategorien und Konten | heutige Buchungskategorien | verschoben |
| Darstellung | Hell/Dunkel | aus Benutzerprofil |
| Benutzer | Name, Passwort | aus Benutzerprofil |

### 6.12 Übergreifend

- **Befehlspalette (Ctrl+K und Knopf am Handy):**
  - Suche über Firmen, Personen, Leads/Deals, Offerten, Rechnungen, Projekte, Buchungen und Leistungen.
  - Schnellaktionen: «Neue Buchung», «Zeit erfassen», «Timer starten», «Neue Rechnung», «Neue Offerte», «Neuer Lead», «Kontostand erfassen».
  - Bedienung mit Pfeiltasten, Enter, Escape. Der Status erscheint als Wort statt als Rohwert.
- **Untertitel** als Lagesatz, durchgehend Du-Form. Die heutigen «Verwalten Sie …» **entfallen**.
- **Handy:** Kartenlisten in allen Listen, Leiste unten (Abschnitt 3), Suche erreichbar.
- **Tastatur:** Drawer, Dialoge und Palette mit Escape. Listen mit Pfeiltasten.
- Auswahllisten zeigen nur aktive Firmen und Projekte. Bei Bearbeitung bleibt der gespeicherte Eintrag sichtbar, auch wenn er archiviert ist.

### 6.13 Funktionen, die entfallen oder verschoben werden

| Funktion | Was stattdessen |
|---|---|
| Zeitraum-Umschalter Tage/Jahr und 7/30/90 Tage im Dashboard | Cockpit mit festen Bezügen; frei wählbare Zeiträume unter Berichte › Übersicht |
| Inline-Zahlungsdatum in der Rechnungszeile | Sammeldialog und Drawer |
| Seite `/kunden/:id/kontakte` | Tab «Personen» der Firmenseite (Weiterleitung) |
| Kartenraster «Alle Kontakte» | Personenliste (jetzt mit Bearbeiten) |
| Knopf «Detailliert» in der Zeiterfassung | Schnellerfassung und Drawer |
| Umschalter Datum/KW | Gruppierung Woche/Firma/Projekt |
| Umschalter Buchungen/Charts in Auswertungen | eine Seite |
| Knöpfe «Bearbeiten» und «Als Kunde anlegen» auf der Pipeline-Karte | Drawer und Kartenmenü |
| Formular «Neuer Deal» über dem Board | Drawer |
| Spalte umbenennen per Klick auf den Titel | Einstellungen › Pipeline |
| Eigene Toast-Komponente in Offerten | `react-hot-toast` |
| Navigationspunkte Produkte, Jahresabschluss, Auswertungen | Einstellungen › Leistungen, Berichte |

Keine Funktion verschwindet ersatzlos.

---

## 7. Datenänderungen (Migrationen)

Alle Migrationen sind rückwärtskompatibel: nur neue Tabellen und neue, nullbare Spalten oder Spalten mit Standardwert. Nichts wird gelöscht oder umbenannt. RLS gilt pro Unternehmen über `user_companies`, wie bei den bestehenden Tabellen. Vor der ersten Migration erstelle ich eine frische, verschlüsselte Sicherung (Datenbank und Belege) wie am 11.10.

### 7.1 Neue Tabellen

| Tabelle | Spalten | Zweck |
|---|---|---|
| `company_settings` | `company_id` (PK, FK), `weekly_hours_target` numeric, `ahv_rate` numeric default 10, `tax_rate` numeric, `min_reserve` numeric, `vat_threshold` numeric default 100000, `concentration_warn` int default 50, `concentration_alert` int default 70, `default_hourly_rate` numeric, `payment_terms_days` int default 30, `updated_at` | Ziele, Schätzungen, Standards |
| `company_revenue_targets` | `company_id`, `year`, `revenue_target`, PK (`company_id`, `year`) | Umsatzziel je Jahr; bleibt für Vorjahresvergleiche erhalten |
| `bank_balances` | `id`, `company_id`, `date`, `amount`, `account_label`, `note`, `created_at` | Kontostände; später durch Bankimport ersetzbar |
| `deadlines` | `id`, `company_id`, `title`, `due_date`, `recurrence` (`einmalig`, `monatlich`, `quartalsweise`, `jaehrlich`), `done_at`, `note`, `created_at` | Fristen. Beim Erledigen einer wiederkehrenden Frist entsteht die nächste als neue Zeile, die Historie bleibt |
| `notes` | `id`, `company_id`, `customer_id` null, `opportunity_id` null, `project_id` null, `body`, `created_at`, `created_by`; Check: mindestens ein Bezug | Notizen im Zeitstrahl |

**Warum `company_settings` als eigene Tabelle und nicht als Spalten in `companies`:**
- `companies` hat schon 31 Spalten, die vor allem Rechnungs- und PDF-Stammdaten sind.
- Die neuen Werte sind Schätzungen und Ziele, die nur Cockpit und Masken lesen.
- Eine eigene Tabelle hält Standardwerte in der Datenbank, berührt weder den Firmenwechsel (`get_user_companies` gibt Spalten von `companies` zurück) noch die PDF-Erzeugung, und lässt sich bei Bedarf ganz zurücknehmen.
- Das Umsatzziel bekommt eine eigene Tabelle je Jahr, damit das Ziel 2026 nicht verloren geht, wenn du 2027 ein neues setzt.

### 7.2 Neue Spalten

| Tabelle | Spalte | Zweck |
|---|---|---|
| `transactions` | `is_recurring` boolean default false, `recurrence_interval` text null (`monatlich`, `quartalsweise`, `jaehrlich`) | Fixkosten, Liquidität |
| `invoices` | `is_recurring_revenue` boolean default false | MRR, wiederkehrender Anteil |
| `invoices` | `sent_at` timestamptz null | Verlauf, versendet |
| `invoices` | `paid_at_source` text null (`erfasst`, `faelligkeit`) | ehrliche DSO (2.2 H) |
| `quotes` | `sent_at` timestamptz null | Verlauf |
| `opportunities` | `kind` text default `'deal'` check (`lead`, `deal`), `lead_status` text null (`neu`, `kontaktiert`, `kein_interesse`), `source` text null | Leads (2.2 A) |
| `pipeline_stages` | `probability` int null (0–100), `is_won` boolean default false | gewichtete Pipeline, Abschluss |

Die Sperre abgeschlossener Jahre (Trigger aus der letzten Runde) gilt weiter. Das Setzen von `sent_at` oder `paid_at` in einem gesperrten Jahr wird abgelehnt; der Dialog zeigt das als Fehler je Zeile.

### 7.3 Datenänderung Pipeline (nur nach deinem Okay)

Für das Unternehmen Blauwasser IT (heute «Nicolas Fischer»):

| Heute | Neu | Wahrscheinlichkeit | Deals |
|---|---|---|---|
| Recherche (24) | bleibt als Stufe bestehen, die 24 Einträge werden **Leads** (`kind='lead'`, `lead_status='neu'`, `source='Recherche'`). Die Stufe erscheint nicht mehr im Board | – | 24 → Leads |
| Kontaktaufnahme (1) | **Erstgespräch** | 10 % | 1 |
| Bedarfsanalyse (1, verloren) | **Analyse** (Beschreibung «gemeinsame Analyse, CHF 490») | 30 % | 1 (bleibt verloren) |
| Angebot | **Offerte** | 50 % | 0 |
| Verhandlung | Verhandlung | 70 % | 0 |
| Gewonnen | Gewonnen (`is_won = true`) | 100 % | 0 |

Die Umbenennung ist eine Änderung bestehender Werte (`pipeline_stages.name`). Deshalb lege ich sie dir vor. Die Stufen-IDs bleiben gleich, kein Deal wechselt die Stufe, nichts wird gelöscht. Die Rücknahme ist ein einfaches Zurückbenennen, das alte SQL lege ich bei.

**Website-Ablage:**
- **Variante 1:** In derselben Migration wird `website_ablage.einstellungen.stufe_name` von «Kontaktaufnahme» auf «Erstgespräch» gesetzt. Anfragen landen dann weiter als Deal im Erstgespräch.
- **Variante 2 (meine Empfehlung):** Anfragen landen als **Lead** mit Status «neu» und Quelle «Website», sodass du sie zuerst qualifizierst. Dazu ändere ich die Funktion `website_anfrage_ablegen` so, dass sie `kind='lead'` setzt. Die Signatur bleibt gleich; die Website muss nichts anpassen.

Freiluftchuchi: Namen bleiben. Nur `probability` und `is_won` (Gewonnen) werden gesetzt.

### 7.4 Keine Migration nötig

- Überfällig wird aus den Daten abgeleitet.
- «Abgelaufen» bei Offerten wird abgeleitet.
- Für Deal und Offerte nutze ich die vorhandene Spalte `opportunity_id`.
- Der Stundensatz läuft über die vorhandene Funktion `resolve_hourly_rate`; der Standard kommt neu aus `company_settings`.

### 7.5 Später (nicht in dieser Runde)

Bankimport (camt.053), der Kontostand und Zahlungseingang automatisch zuordnet. Belegerkennung (Betrag, Datum, Lieferant aus Foto oder PDF als Vorschlag zum Bestätigen). Gutschriften. Wiederkehrende Rechnungen als Automatik. Dateiablage pro Firma. Aktivitäten mit Aufgaben und Erinnerungen. MWST-Abrechnung nach Anmeldung.

---

## 8. Reihenfolge der Umsetzung (Phase B)

Ein Commit pro Schritt, damit sich jeder Teil einzeln zurücknehmen lässt. Vor dem ersten Migrationsschritt kommt die Sicherung.

| # | Schritt | Migration | Tests (neu) |
|---|---|---|---|
| 1 | Bausteine: `useListState`, `ListPage`, `ViewTabs`, `KpiStrip`, `RowMenu`, `BulkBar`, `Drawer`, Kartenliste fürs Handy | – | URL-Filter lesen und schreiben, Auswahl und Sammelaktion, Escape im Drawer |
| 2 | Navigation, Routen, Weiterleitungen, Handy-Leiste | – | jede alte URL landet auf der neuen |
| 3 | Sicherung, dann Migrationen 7.1 und 7.2 (ohne Pipeline-Daten) | ja | – |
| 4 | Rechnungen: Liste, Sammeldialog Zahlungsdatum, bezahlt mit Datum, Detailseite, Drawer | – | Sammeldialog (leer lassen, übernehmen, gesperrtes Jahr), abgeleitet überfällig |
| 5 | Zeiterfassung: Ansichten, Gruppen, Summen, Spalten, Sammelaktion Rechnung, Timer-Fixes | – | Rechnung aus Zeiten (eine Firma, Satz aus Snapshot), Gruppensummen |
| 6 | Pipeline-Datenänderung 7.3 **nach deinem Okay**, dann Leads, Pipeline-Board und Tabelle, Deal-Drawer | ja | Spaltensummen, gewichteter Wert, Lead zu Deal |
| 7 | Einstellungen mit Unternavigation, Ziele, Kontostände, Fristen, Rechnungen und Offerten, Leistungen | – | Fristwiederholung |
| 8 | Cockpit, erste Priorität und «Zu erledigen» | – | Rückstellungen, Liquidität, Klumpenrisiko, Ziel/Ist, MWST-Schwelle, je mit leeren Daten |
| 9 | Cockpit, zweite Priorität | – | Auslastung, MRR, Fixkosten (Serienregel, +10 %), DSO |
| 10 | Berichte mit Tabs | – | – |
| 11 | Buchungen: Unvollständig, Filter, Drawer mit Beleg, Wiederkehrend, Lieferant nachtragen | – | Serienregel der Fixkosten |
| 12 | Offerten: Liste, Detailseite, Umwandeln mit Rabatt und Texten, Deal-Verknüpfung | – | Umwandlung übernimmt Rabatt |
| 13 | Projekte: Liste mit Budget, Projektseite | – | Budgetverbrauch |
| 14 | Kontakte: Firmen und Personen, Firmenseite mit Zeitstrahl und Notizen | – | Zeitstrahl-Reihenfolge |
| 15 | Befehlspalette, Glossar, Begriffe, Untertitel | – | Palette führt Aktion aus |
| 16 | Screenshots `nachher/`, Schlussbericht, Preview | – | – |

Schreibende Tests laufen nur in «ZZ Testfirma» und werden danach entfernt. Es gibt nur Branch und Preview, kein Merge auf `main`.

---

## 9. Entscheide

Am 11.10.2026 freigegeben: alle Empfehlungen aus 2.2 und Abschnitt 9 der Vorlage (Navigation mit «Kontakte», Begriffe Firma/Person/Unternehmen, Leads als Art in `opportunities`, Pipeline-Phasen wie 7.3, Website-Anfragen als Lead, Zahlungsdatum ohne Vorbelegung, Datensatzseite in zwei Spalten, Rechnung als Seite). Blauwasser IT und Freiluftchuchi sind Einzelfirmen, werden aber **nicht** zusammengezählt (2.2 J).
