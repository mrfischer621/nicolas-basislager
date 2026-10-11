import { toDay } from './financeAggregation';

/**
 * Einheitliche Anzeigeformate. Datum immer TT.MM.JJJJ (nicht "20.1.2026"),
 * Stunden mit zwei Nachkommastellen, Prozent ohne Nachkommastellen.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '–';
  const day = toDay(value);
  const [y, m, d] = day.split('-');
  if (!y || !m || !d) return '–';
  return `${d}.${m}.${y}`;
}

/** Kurz ohne Jahr, fuer dichte Listen: "28.09." */
export function formatDateShort(value: string | null | undefined): string {
  return formatDate(value).slice(0, 6);
}

export function formatHours(hours: number): string {
  return `${(Math.round(hours * 100) / 100).toFixed(2)} h`;
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '–';
  return `${Math.round(value)} %`;
}

/** "1 Rechnung" / "3 Rechnungen" */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
