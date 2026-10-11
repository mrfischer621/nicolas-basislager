/** Eingabefelder fuer Zahlen (Einstellungen, Masken). */

/** "1'234.5" oder "" -> Zahl oder null */
export function parseNumber(v: string): number | null {
  const cleaned = v.replace(/['\s]/g, '').replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function toField(n: number | null | undefined): string {
  return n === null || n === undefined ? '' : String(n);
}
