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

const scalar = (group, prefix) =>
  t[group].tokens.map((x) => `  --bw-${prefix}${x.name}: ${x.value};`).join('\n');

const css = `/* GENERIERT aus ${src} durch scripts/build-tokens.mjs. Nicht von Hand aendern. */
/* Farben als RGB-Kanaele, damit Tailwind Deckkraft (z.B. bg-ink/50) bilden kann. */

:root {
${block('light')}
${scalar('radius', '')}
${scalar('shadow', '')}
${scalar('spacing', '')}
  --bw-font-display: ${t.type.families.display};
  --bw-font-body: ${t.type.families.body};
  color-scheme: light;
}

/* Thema dark (Tiefsee): folgt dem System, ausser der Benutzer hat "Hell" gewaehlt */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
${block('dark').replace(/^/gm, '  ')}
    color-scheme: dark;
  }
}
:root[data-theme='dark'] {
${block('dark')}
  color-scheme: dark;
}
`;
fs.writeFileSync(out, css);
console.log(`geschrieben: ${out}`);
