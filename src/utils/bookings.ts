import type { FinanceEntry } from './financeAggregation';
import { presetRange, type RangePreset } from './financeAggregation';

/** Ansichten der Buchungsliste. */
export type BookingView = 'alle' | 'ausgaben' | 'einnahmen' | 'unvollstaendig';

export const BOOKING_VIEWS: { value: BookingView; label: string }[] = [
  { value: 'alle', label: 'Alle' },
  { value: 'ausgaben', label: 'Ausgaben' },
  { value: 'einnahmen', label: 'Einnahmen' },
  { value: 'unvollstaendig', label: 'Unvollständig' },
];

/** Unvollstaendig: Ausgabe ohne Beleg, ohne Kategorie oder ohne Lieferant. */
export function isIncomplete(e: FinanceEntry): boolean {
  return e.source === 'transaction' && e.type === 'ausgabe' && (!e.receiptUrl || !e.category || !e.counterparty);
}

export function missingParts(e: FinanceEntry): string[] {
  const parts: string[] = [];
  if (!e.receiptUrl) parts.push('Beleg');
  if (!e.category) parts.push('Kategorie');
  if (!e.counterparty) parts.push('Lieferant');
  return parts;
}

export function matchesBookingView(e: FinanceEntry, view: BookingView): boolean {
  if (view === 'ausgaben') return e.type === 'ausgabe';
  if (view === 'einnahmen') return e.type === 'einnahme';
  if (view === 'unvollstaendig') return isIncomplete(e);
  return true;
}

export const PERIODS: { value: string; label: string }[] = [
  { value: 'last_30_days', label: 'Letzte 30 Tage' },
  { value: 'last_90_days', label: 'Letzte 90 Tage' },
  { value: 'current_year', label: 'Dieses Jahr' },
  { value: 'last_year', label: 'Letztes Jahr' },
  { value: 'last_365_days', label: 'Letzte 365 Tage' },
];

/** Filter ausser der Ansicht: Zeitraum, Kategorie, Lieferant, Suche. */
export function filterBookings(entries: FinanceEntry[], state: Record<string, string>, today: string): FinanceEntry[] {
  const range = state.zeitraum && PERIODS.some((p) => p.value === state.zeitraum) ? presetRange(state.zeitraum as RangePreset, today) : null;
  const q = state.q?.trim().toLocaleLowerCase('de-CH');
  return entries.filter(
    (e) =>
      (!range || (e.date >= range.from && e.date <= range.to)) &&
      (!state.kategorie || (state.kategorie === '_ohne' ? !e.category : e.category === state.kategorie)) &&
      (!state.lieferant || (state.lieferant === '_ohne' ? !e.counterparty : e.counterparty === state.lieferant)) &&
      (!q || [e.description, e.counterparty, e.number, e.category].some((v) => v?.toLocaleLowerCase('de-CH').includes(q)))
  );
}

export interface SupplierGroup {
  key: string;
  label: string;
  ids: string[];
  total: number;
  suggestion: string;
}

/**
 * Buchungen ohne Lieferant nach Text gruppieren ("Lieferanten nachtragen").
 * Vorschlag: ein bekannter Lieferant, dessen Name im Text vorkommt.
 */
export function supplierGroups(entries: FinanceEntry[], known: string[]): SupplierGroup[] {
  const groups = new Map<string, SupplierGroup>();
  for (const e of entries) {
    if (e.source !== 'transaction' || e.counterparty) continue;
    const label = (e.description ?? '').trim() || e.category || 'Ohne Text';
    const key = label.toLocaleLowerCase('de-CH');
    const g = groups.get(key) ?? { key, label, ids: [], total: 0, suggestion: '' };
    g.ids.push(e.id);
    g.total = Math.round((g.total + e.amount) * 100) / 100;
    groups.set(key, g);
  }
  const knownLower = known.map((k) => [k, k.toLocaleLowerCase('de-CH')] as const);
  return [...groups.values()]
    .map((g) => ({ ...g, suggestion: knownLower.find(([, k]) => k.length > 2 && g.key.includes(k))?.[0] ?? '' }))
    .sort((a, b) => b.ids.length - a.ids.length || b.total - a.total);
}
