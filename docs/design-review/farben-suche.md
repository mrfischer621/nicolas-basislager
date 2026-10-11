# Suche nach fest codierten Farbwerten

Stand nach dem Umbau (Punkt 8). Befehle und vollständige Ausgabe.

## 1. Hex- und rgb-Werte ausserhalb der Token-Datei

```
$ grep -rnE "#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}|rgba?\(\s*[0-9]" src | grep -v "src/styles/tokens.css|\.test\.|var(--bw"
src/utils/pdfGenerator.ts:1291: * Header row: accent green #6b8a5e, white text.
src/pages/Settings.tsx:134:  const [newCategoryColor, setNewCategoryColor] = useState('#6B7280');
src/pages/Settings.tsx:294:      setNewCategoryColor('#6B7280');
src/pages/Settings.tsx:623:          color: '#6B7280',
src/pages/Settings.tsx:767:    { value: '#6B7280', label: 'Grau' },
src/pages/Settings.tsx:768:    { value: '#3B82F6', label: 'Blau' },
src/pages/Settings.tsx:769:    { value: '#8B5CF6', label: 'Lila' },
src/pages/Settings.tsx:770:    { value: '#F59E0B', label: 'Gelb' },
src/pages/Settings.tsx:771:    { value: '#EF4444', label: 'Rot' },
src/pages/Settings.tsx:772:    { value: '#10B981', label: 'Grün' },
src/pages/Settings.tsx:773:    { value: '#EC4899', label: 'Pink' },
src/pages/Settings.tsx:774:    { value: '#14B8A6', label: 'Türkis' },
```

## 2. Tailwind-Palettenklassen

```
$ grep -rnE "(bg|text|border|ring|divide|from|to|via|fill|stroke|placeholder)-(gray|slate|...|rose)-[0-9]" src | wc -l
0
```

Die Standardpalette ist in `tailwind.config.js` zudem entfernt: Eine solche Klasse würde keine Farbe mehr erzeugen.

## Bewertung der verbleibenden Treffer

- `src/utils/pdfGenerator.ts`: nur ein Kommentar. Das PDF-Layout gehört nicht zu Punkt 8 und bleibt unverändert.
- `src/pages/Settings.tsx`: Farbauswahl für **Kategorien und Pipeline-Stufen**. Das sind Werte, die als Daten in der Datenbank gespeichert werden (`categories.color`, `pipeline_stages.color`), keine Gestaltung der App. Sie bleiben, damit bestehende Daten gültig sind.
