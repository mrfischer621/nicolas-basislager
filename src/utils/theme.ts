/**
 * Darstellung Hell (Standard) oder Dunkel (Tiefsee).
 * Standard ist immer hell, auch wenn das Betriebssystem im Dunkelmodus
 * laeuft. Dunkel gilt nur, wenn es in den Einstellungen gewaehlt ist; die
 * Wahl wird pro Geraet im localStorage gespeichert und ueber data-theme auf
 * <html> angewendet. Die Farben kommen aus src/styles/tokens.css.
 */
export type ThemePreference = 'light' | 'dark';
const KEY = 'bw-theme';

export function getThemePreference(): ThemePreference {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(pref: ThemePreference = getThemePreference()): void {
  const root = document.documentElement;
  if (pref === 'dark') root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');
}

export function setThemePreference(pref: ThemePreference): void {
  try {
    if (pref === 'dark') localStorage.setItem(KEY, 'dark');
    else localStorage.removeItem(KEY);
  } catch {
    // ohne Speicher gilt die Wahl nur bis zum Neuladen
  }
  applyTheme(pref);
}
