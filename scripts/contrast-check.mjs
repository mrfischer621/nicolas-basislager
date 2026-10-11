// Kontrastpruefung aller Text-Hintergrund-Paare der App (WCAG 2.2 AA),
// Werte direkt aus src/styles/tokens.css (Hell und Tiefsee).
// Aufruf: node scripts/contrast-check.mjs > docs/design-review/kontrast.md
import fs from 'node:fs';

const css = fs.readFileSync('src/styles/tokens.css', 'utf8');
const block = (re) => Object.fromEntries([...re.exec(css)[1].matchAll(/--bw-([\w-]+): (\d+) (\d+) (\d+);/g)].map((m) => [m[1], [+m[2], +m[3], +m[4]]]));
const light = block(/:root \{([\s\S]*?)\n\}/);
const dark = { ...light, ...block(/:root\[data-theme='dark'\] \{([\s\S]*?)\n\}/) };

const lum = ([r, g, b]) => {
  const c = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');

// [Text, Hintergrund, Verwendung, Mindestwert]
const pairs = [
  ['fg', 'canvas', 'Fliesstext, Titel auf dem Grund', 4.5],
  ['fg', 'surface', 'Text in Karten, Tabellen, Formularen', 4.5],
  ['fg', 'raised', 'Text auf getoenter Flaeche (Hover, Badge neutral)', 4.5],
  ['fg-muted', 'canvas', 'Gedaempfter Text auf dem Grund', 4.5],
  ['fg-muted', 'surface', 'Gedaempfter Text in Karten', 4.5],
  ['fg-muted', 'raised', 'Gedaempfter Text auf getoenter Flaeche', 4.5],
  ['fg-subtle', 'surface', 'Platzhalter in Eingabefeldern', 4.5],
  ['fg', 'accent-subtle', 'Text auf hellblauer Hinterlegung (Badge, Auswahl)', 4.5],
  ['accent-fg', 'accent', 'Primaerknopf, aktiver Umschalter', 4.5],
  ['cta-fg', 'cta', 'Pill (nur grosse, fette Versalien, dokumentierte Ausnahme)', 3.0],
  ['fg-inverted', 'ink', 'Seitenleiste: aktiver Punkt, Firmenname', 4.5],
  ['fg-inverted-muted', 'ink', 'Seitenleiste: Menuepunkte, Gruppentitel', 4.5],
  ['fg-inverted', 'ink-raised', 'Seitenleiste: aktiver/gehoverter Punkt', 4.5],
  ['fg-inverted-muted', 'ink-raised', 'Seitenleiste: Hover', 4.5],
  ['success', 'success-subtle', 'Badge/Meldung Erfolg', 4.5],
  ['warning', 'warning-subtle', 'Badge/Meldung Warnung', 4.5],
  ['danger', 'danger-subtle', 'Badge/Meldung Fehler', 4.5],
  ['line-strong', 'surface', 'Rand von Eingabefeldern (Nicht-Text, 1.4.11)', 3.0],
  ['line-strong', 'canvas', 'Rand von Umschaltern auf dem Grund (1.4.11)', 3.0],
  ['focus', 'surface', 'Fokusring auf Karten (2.4.13 / 1.4.11)', 3.0],
  ['focus', 'canvas', 'Fokusring auf dem Grund', 3.0],
  ['focus-inverted', 'ink', 'Fokusring in der Seitenleiste', 3.0],
  ['cta', 'surface', 'Chart: Einnahmen-Balken (Grafik, 1.4.11)', 3.0],
  ['fg', 'surface', 'Chart: Ausgaben-Balken (Grafik, 1.4.11)', 3.0],
];

let out = '# Kontrastpruefung (WCAG 2.2 AA)\n\n';
out += 'Erzeugt mit `node scripts/contrast-check.mjs` aus `src/styles/tokens.css`. Mindestwerte: Text 4.5:1, grosse fette Schrift und Nicht-Text (Raender, Fokus, Grafik) 3:1.\n\n';
let fails = 0;
for (const [name, theme] of [['Hell', light], ['Tiefsee (dunkel)', dark]]) {
  out += `## ${name}\n\n| Text / Vordergrund | Hintergrund | Verwendung | Kontrast | Minimum | Ergebnis |\n|---|---|---|---|---|---|\n`;
  for (const [fg, bg, use, min] of pairs) {
    // Statusfarben bleiben im Thema dark hell (Meldung auf heller Statusflaeche)
    const r = ratio(theme[fg], theme[bg]);
    const ok = r >= min;
    if (!ok) fails++;
    out += `| \`${fg}\` ${hex(theme[fg])} | \`${bg}\` ${hex(theme[bg])} | ${use} | ${r.toFixed(2)}:1 | ${min}:1 | ${ok ? 'bestanden' : '**nicht bestanden**'} |\n`;
  }
  out += '\n';
}
out += fails ? `\n**${fails} Paare unter dem Minimum.**\n` : '\nAlle Paare bestehen.\n';
process.stdout.write(out);
if (fails) process.exitCode = 1;
