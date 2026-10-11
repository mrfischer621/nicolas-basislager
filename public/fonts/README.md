# PDF-Schriften

Schriften für die PDF-Dokumente (Rechnung, Offerte, Jahresabschluss). Sie stammen
aus dem Blauwasser-Design-System-Paket (`design-system/blauwasser/project/fonts/`,
Lizenz SIL OFL) und wurden mit fontTools unverändert von WOFF2 nach TTF gewandelt,
weil jsPDF nur TTF einbetten kann. Abgedeckt ist der ganze Latin-1-Bereich, den der
PDF-Generator ohnehin erzwingt.

| Datei | Verwendung |
|---|---|
| `Montserrat-Regular.ttf` | Text, Tabellen (400) |
| `Montserrat-Bold.ttf` | Hervorhebungen im Text (700) |
| `AlbertSans-Bold.ttf` | Etiketten, Spaltenköpfe, Beträge (700) |
| `AlbertSans-Black.ttf` | Dokumenttitel, Total (900) |

Fehlen die Dateien, fällt der Generator still auf Helvetica zurück. Die QR-Rechnung
verwendet immer Helvetica (Vorgabe Swiss Payment Standards).

Neu erzeugen:

```
pip install fonttools brotli
python -c "from fontTools.ttLib import TTFont; f=TTFont('AlbertSans-900.woff2'); f.flavor=None; f.save('AlbertSans-Black.ttf')"
```
