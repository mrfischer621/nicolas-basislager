// Einmalige Umstellung: Tailwind-Palettenklassen (gray-500, blue-600, ...) auf
// die Blauwasser-Tokens. Danach von Hand pro Seite verfeinert.
// Aufruf: node scripts/codemod-colors.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';

const dry = process.argv.includes('--dry');
const NEUTRAL = ['gray', 'slate', 'zinc', 'neutral', 'stone', 'sage'];
const BLUE = ['blue', 'sky', 'indigo', 'cyan', 'violet', 'purple', 'fuchsia', 'pink', 'teal'];
const GREEN = ['green', 'emerald', 'lime'];
const RED = ['red', 'rose'];
const YELLOW = ['yellow', 'amber', 'orange'];

// Ziel je Eigenschaft (bg | text | border | ring | other) und Stufe
function target(kind, family, shade) {
  const s = Number(shade);
  if (NEUTRAL.includes(family)) {
    if (kind === 'bg') return s <= 50 ? 'canvas' : s <= 100 ? 'raised' : s <= 300 ? 'sunken' : s <= 600 ? 'fg-muted' : 'ink';
    if (kind === 'text') return s <= 300 ? 'fg-subtle' : s <= 400 ? 'fg-subtle' : s <= 600 ? 'fg-muted' : 'fg';
    if (kind === 'border') return s <= 200 ? 'line' : s <= 400 ? 'line-strong' : 'line-strong';
    if (kind === 'ring') return s <= 300 ? 'line' : 'focus';
    return s <= 300 ? 'line' : 'fg-muted';
  }
  if (BLUE.includes(family)) {
    if (kind === 'bg') return s <= 100 ? 'accent-subtle' : s <= 300 ? 'accent-border' : 'accent';
    if (kind === 'text') return 'accent';
    if (kind === 'border') return s <= 300 ? 'accent-border' : 'accent';
    if (kind === 'ring') return 'focus';
    return 'accent';
  }
  const status = GREEN.includes(family) ? 'success' : RED.includes(family) ? 'danger' : 'warning';
  if (kind === 'bg') return s <= 200 ? `${status}-subtle` : status;
  if (kind === 'text') return status;
  if (kind === 'border') return s <= 200 ? `${status}-subtle` : status;
  if (kind === 'ring') return status;
  return status;
}

const KINDS = { bg: 'bg', text: 'text', border: 'border', 'border-t': 'border', 'border-b': 'border', 'border-l': 'border', 'border-r': 'border', 'border-x': 'border', 'border-y': 'border', divide: 'border', ring: 'ring', 'ring-offset': 'ring', outline: 'border', placeholder: 'text', from: 'bg', via: 'bg', to: 'bg', fill: 'text', stroke: 'text', decoration: 'text', accent: 'bg', caret: 'text' };
const FAMILIES = [...NEUTRAL, ...BLUE, ...GREEN, ...RED, ...YELLOW];
const re = new RegExp(
  `(?<![\\w-])((?:[\\w-]+:)*)(${Object.keys(KINDS).sort((a, b) => b.length - a.length).join('|')})-(${FAMILIES.join('|')})-(\\d{2,3})(\\/\\d{1,3})?(?![\\w-])`,
  'g'
);
const reWhiteBlack = /(?<![\w-])((?:[\w-]+:)*)(bg|text|border|ring|divide|from|to)-(white|black)(\/\d{1,3})?(?![\w-])/g;

function convert(src) {
  let n = 0;
  let out = src.replace(re, (_m, variants, prop, family, shade, alpha = '') => {
    n++;
    return `${variants}${prop}-${target(KINDS[prop], family, shade)}${alpha}`;
  });
  out = out.replace(reWhiteBlack, (m, variants, prop, color, alpha = '') => {
    n++;
    if (color === 'white') {
      if (prop === 'bg') return `${variants}bg-surface${alpha}`;
      if (prop === 'text') return `${variants}text-white${alpha}`; // spaeter je nach Flaeche
      return `${variants}${prop}-surface${alpha}`;
    }
    if (prop === 'bg') return `${variants}bg-ink${alpha}`;
    return `${variants}${prop}-fg${alpha}`;
  });
  // Weisse Schrift auf Tinte-Flaeche (accent) wird im dunklen Thema hell auf hell:
  // in denselben Klassenlisten auf accent-fg umstellen.
  out = out.replace(/(["'`])([^"'`]*?)\1/g, (m, q, body) => {
    if (/(?:^|\s|:)bg-(?:accent|brand)(?:\s|$|\/)/.test(body) && /(?:^|\s)text-white(?:\s|$)/.test(body)) {
      n++;
      return q + body.replace(/(^|\s)text-white(?=\s|$)/g, '$1text-accent-fg') + q;
    }
    return m;
  });
  // bg-opacity-50 (Tailwind 2) beim Overlay
  out = out.replace(/bg-ink bg-opacity-(\d+)/g, (_m, o) => (n++, `bg-ink/${o}`));
  return { out, n };
}

const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(p) && !/\.test\./.test(p)) files.push(p);
  }
})('src');

let total = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const { out, n } = convert(src);
  if (n) {
    total += n;
    console.log(String(n).padStart(4), f);
    if (!dry) fs.writeFileSync(f, out);
  }
}
console.log('Ersetzungen gesamt:', total);
