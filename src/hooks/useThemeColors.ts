import { useEffect, useState } from 'react';

/**
 * Token-Farben fuer Bibliotheken, die keine CSS-Variablen verstehen (recharts).
 * Liest die aktuellen Werte aus src/styles/tokens.css und aktualisiert sie,
 * wenn Thema (data-theme) oder Systemeinstellung wechseln.
 */
const NAMES = ['cta', 'fg', 'fg-muted', 'fg-subtle', 'line', 'surface', 'canvas', 'accent-subtle'] as const;
export type ThemeColors = Record<(typeof NAMES)[number], string>;

function read(): ThemeColors {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    NAMES.map((n) => [n, `rgb(${style.getPropertyValue(`--bw-${n}`).trim().replace(/\s+/g, ', ')})`])
  ) as ThemeColors;
}

export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(read);
  useEffect(() => {
    const update = () => setColors(read());
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      media.removeEventListener('change', update);
      observer.disconnect();
    };
  }, []);
  return colors;
}
