/**
 * Darstellung Hell / Dunkel (Tiefsee) / System.
 * Gespeichert pro Geraet im localStorage, angewendet ueber data-theme auf
 * <html>; die Farben selbst kommen aus src/styles/tokens.css.
 * "system" entfernt data-theme, dann gilt prefers-color-scheme.
 */
export type ThemePreference = 'system' | 'light' | 'dark';
const KEY = 'bw-theme';

export function getThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(pref: ThemePreference = getThemePreference()): void {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
}

export function setThemePreference(pref: ThemePreference): void {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // ohne Speicher gilt die Wahl nur bis zum Neuladen
  }
  applyTheme(pref);
}
