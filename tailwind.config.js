/** @type {import('tailwindcss').Config} */

// Blauwasser Design System (design-system/blauwasser/project/tokens.json).
// Alle Farben kommen aus CSS-Variablen in src/styles/tokens.css (generiert mit
// scripts/build-tokens.mjs). Die Standardpalette von Tailwind (gray-500,
// blue-600, ...) ist bewusst NICHT verfuegbar: Farben nur ueber Tokens.
// Hell und Tiefsee (dunkel) wechseln ueber die Variablen, nicht ueber dark:.

const token = (name) => `rgb(var(--bw-${name}) / <alpha-value>)`;

const colors = {
  transparent: 'transparent',
  current: 'currentColor',
  inherit: 'inherit',

  canvas: token('canvas'), // Grund (Seitenhintergrund)
  surface: {
    DEFAULT: token('surface'), // Papier (Karten, Tabellen, Formulare)
    // Aliasse der bisherigen Klassen
    base: token('canvas'),
    card: token('surface'),
    inset: token('raised'),
    border: token('line'),
  },
  raised: token('raised'),
  sunken: token('sunken'),
  ink: { DEFAULT: token('ink'), raised: token('ink-raised') }, // Tinte als Flaeche (Seitenleiste)
  fg: {
    DEFAULT: token('fg'),
    muted: token('fg-muted'),
    subtle: token('fg-subtle'),
    inverted: token('fg-inverted'),
    'inverted-muted': token('fg-inverted-muted'),
  },
  line: { DEFAULT: token('line'), strong: token('line-strong'), inverted: token('line-inverted') },
  accent: {
    DEFAULT: token('accent'), // Tinte fuer Interaktives (Links, Sekundaerknopf, aktive Auswahl)
    hover: token('accent-hover'),
    fg: token('accent-fg'),
    subtle: token('accent-subtle'),
    border: token('accent-border'),
  },
  cta: { DEFAULT: token('cta'), hover: token('cta-hover'), fg: token('cta-fg') }, // das eine Hellblau
  success: { DEFAULT: token('success'), subtle: token('success-subtle'), light: token('success-subtle'), dark: token('success') },
  warning: { DEFAULT: token('warning'), subtle: token('warning-subtle'), light: token('warning-subtle'), dark: token('warning') },
  danger: { DEFAULT: token('danger'), subtle: token('danger-subtle'), light: token('danger-subtle'), dark: token('danger') },
  focus: { DEFAULT: token('focus'), inverted: token('focus-inverted') },
  white: token('cta-fg'), // Weiss nur als Schrift auf cta/success/danger

  // Aliasse der bisherigen Namen, damit nichts ohne Farbe bleibt
  brand: { light: token('accent-subtle'), DEFAULT: token('accent'), dark: token('accent-hover'), darker: token('accent-hover') },
  content: { heading: token('fg'), body: token('fg'), secondary: token('fg-muted'), tertiary: token('fg-muted'), inverse: token('fg-inverted') },
  text: { primary: token('fg'), secondary: token('fg-muted'), tertiary: token('fg-muted'), inverse: token('fg-inverted') },
  app: { bg: token('canvas') },
  sidebar: { bg: token('ink'), hover: token('ink-raised'), text: token('fg-inverted-muted'), 'text-active': token('fg-inverted'), border: token('line-inverted') },
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    colors,
    fontFamily: {
      display: ['"Albert Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      sans: ['Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
    },
    extend: {
      borderRadius: {
        badge: 'var(--bw-radius-badge)',
        lg: 'var(--bw-radius-lg)', // Eingabefelder, Knoepfe
        tile: 'var(--bw-radius-tile)', // Kacheln
        card: 'var(--bw-radius-card)', // Karten
        xl: 'var(--bw-radius-tile)',
        '2xl': 'var(--bw-radius-card)',
        button: 'var(--bw-radius-lg)',
        input: 'var(--bw-radius-lg)',
      },
      boxShadow: {
        card: 'var(--bw-shadow-card)',
        sm: 'var(--bw-shadow-sm)',
        DEFAULT: 'var(--bw-shadow-sm)',
        md: 'var(--bw-shadow-md)',
        lg: 'var(--bw-shadow-lg)',
        xl: 'var(--bw-shadow-lg)',
        '2xl': 'var(--bw-shadow-lg)',
        cta: 'var(--bw-shadow-cta)',
        // Aliasse der bisherigen Namen
        rest: 'var(--bw-shadow-card)',
        hover: 'var(--bw-shadow-md)',
        elevated: 'var(--bw-shadow-lg)',
        floating: 'var(--bw-shadow-lg)',
        'spatial-1': 'var(--bw-shadow-md)',
        'spatial-2': 'var(--bw-shadow-lg)',
      },
      spacing: {
        stack: 'var(--bw-space-stack)',
        'card-pad': 'var(--bw-space-card)',
        'stack-lg': 'var(--bw-space-stack-lg)',
      },
      letterSpacing: {
        caps: '0.12em',
        tighter: '-0.025em',
      },
      gap: { bento: '16px', 'bento-lg': '24px' },
      transitionTimingFunction: { swiss: 'cubic-bezier(0, 0, 0.58, 1)' },
      transitionDuration: { fast: '150ms', normal: '200ms' },
      ringColor: { DEFAULT: token('focus') },
      ringOffsetColor: { DEFAULT: token('surface') },
    },
  },
  plugins: [],
};
