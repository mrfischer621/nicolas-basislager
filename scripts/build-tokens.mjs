// Erzeugt src/styles/tokens.css aus design-system/blauwasser/project/tokens.json.
// Die Tokens sind die einzige Quelle fuer Farben, Radien, Schatten, Abstaende
// und Schriften der App. Aufruf: node scripts/build-tokens.mjs
import fs from 'node:fs';

const src = 'design-system/blauwasser/project/tokens.json';
const out = 'src/styles/tokens.css';
const t = JSON.parse(fs.readFileSync(src, 'utf8'));

const byName = Object.fromEntries(t.color.tokens.map((c) => [c.name, c.value]));
const resolve = (v, theme) => {
  if (typeof v === 'object') v = v[theme] ?? v.light;
  const ref = /^\{(.+)\}$/.exec(v);
  return ref ? resolve(byName[ref[1]], theme) : v;
};
const channels = (hex) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

// App-Namen -> Token-Namen des Design Systems
const map = {
  canvas: 'background',
  surface: 'surface',
  raised: 'surface-raised',
  sunken: 'surface-sunken',
  ink: 'surface-inverted',
  'ink-raised': 'surface-inverted-raised',
  fg: 'foreground',
  'fg-muted': 'foreground-muted',
  'fg-subtle': 'foreground-subtle',
  'fg-inverted': 'foreground-inverted',
  'fg-inverted-muted': 'foreground-inverted-muted',
  line: 'border',
  'line-strong': 'border-strong',
  'line-inverted': 'border-inverted',
  accent: 'accent',
  'accent-hover': 'accent-hover',
  'accent-fg': 'accent-foreground',
  'accent-subtle': 'accent-subtle',
  'accent-border': 'accent-border',
  cta: 'cta',
  'cta-hover': 'cta-hover',
  'cta-fg': 'cta-foreground',
  success: 'success',
  'success-subtle': 'success-subtle',
  warning: 'warning',
  'warning-subtle': 'warning-subtle',
  danger: 'danger',
  'danger-subtle': 'danger-subtle',
  focus: 'focus',
  'focus-inverted': 'focus-on-inverted',
};

// Statusfarben sind im Design System "nur light". Im Thema dark (Tiefsee)
// stehen Meldungen deshalb auf einer hellen Statusflaeche mit dunklem Text:
// dafuer bleiben success/warning/danger und ihre subtle-Flaechen unveraendert.
const block = (theme) =>
  Object.entries(map)
    .map(([app, token]) => `  --bw-${app}: ${channels(resolve(byName[token], theme))}; /* ${token} */`)
    .join('\n');

// ---------------------------------------------------------------------------
// Erweiterung CRM, nicht Teil des Blauwasser Design Systems.
// Satte Statusfarben (Freigabe 11.10.2026): gleiche Leuchtkraft und Saettigung
// wie cta #0a95ff (OKLCH etwa L 0.66, C 0.19).
//   solid    = Flaechen, Balken, Linien, Icons, Punkte (nie Fliesstext auf hell)
//   text     = Text auf dem Thema (hell: dunklere Textvariante >= 4.5:1,
//              Tiefsee: satte Farbe, Rot aufgehellt fuer >= 4.5:1)
//   subtle   = heller Hintergrund (Badge, Banner), in beiden Themen gleich
//   on-subtle= Text auf subtle (>= 4.5:1), in beiden Themen gleich
// Textvarianten gegenueber dem Vorschlag leicht abgedunkelt, damit sie auch
// auf subtle und dem Grund 4.5:1 halten (siehe docs/design-review/kontrast.md).
const STATUS = {
  positive: { solid: '#0cb655', text: '#047a37', textDark: '#0cb655', subtle: '#e2f9e6' },
  negative: { solid: '#ed4042', text: '#cc272e', textDark: '#ee4b4d', subtle: '#ffe9e6' },
  warning: { solid: '#f57400', text: '#a95009', textDark: '#f57400', subtle: '#ffecdd' },
  attention: { solid: '#f5c40d', text: '#816500', textDark: '#f5c40d', subtle: '#fbf1d8' },
  info: { solid: '#0a95ff', text: '#0b1220', textDark: '#f4f7fb', subtle: '#e1f4ff' },
};
const statusBlock = (theme) =>
  Object.entries(STATUS)
    .flatMap(([k, v]) => [
      `  --bw-${k}: ${channels(v.solid)};`,
      `  --bw-${k}-text: ${channels(theme === 'dark' ? v.textDark : v.text)};`,
      `  --bw-${k}-subtle: ${channels(v.subtle)};`,
      `  --bw-${k}-on-subtle: ${channels(v.text)};`,
    ])
    .concat([
      // Tinte auf hellen Status-Flaechen, in beiden Themen gleich
      `  --bw-fg-on-light: ${channels('#0b1220')};`,
    ])
    .join('\n');

const scalar = (group, prefix) =>
  t[group].tokens.map((x) => `  --bw-${prefix}${x.name}: ${x.value};`).join('\n');

const css = `/* GENERIERT aus ${src} durch scripts/build-tokens.mjs. Nicht von Hand aendern. */
/* Farben als RGB-Kanaele, damit Tailwind Deckkraft (z.B. bg-ink/50) bilden kann. */

:root {
${block('light')}
  /* Erweiterung CRM, nicht Teil des Blauwasser Design Systems: Statusfarben */
${statusBlock('light')}
${scalar('radius', '')}
${scalar('shadow', '')}
${scalar('spacing', '')}
  --bw-font-display: ${t.type.families.display};
  --bw-font-body: ${t.type.families.body};
  color-scheme: light;
}

/* Thema dark (Tiefsee): nur, wenn es in den Einstellungen ausdruecklich
   gewaehlt ist. Standard ist immer hell, unabhaengig vom Betriebssystem. */
:root[data-theme='dark'] {
${block('dark')}
  /* Erweiterung CRM, nicht Teil des Blauwasser Design Systems: Statusfarben */
${statusBlock('dark')}
  color-scheme: dark;
}
`;
fs.writeFileSync(out, css);
console.log(`geschrieben: ${out}`);
