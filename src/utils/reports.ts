import type { DayRange, FinanceEntry } from './financeAggregation';
import { isBilled, type TimeRow } from './timeEntries';
import { roundRappen, sumRappen } from './money';

/** Gleicher Zeitraum ein Jahr frueher (29.02. -> 28.02.). */
export function previousYearRange(range: DayRange): DayRange {
  const shift = (day: string) => {
    const y = Number(day.slice(0, 4)) - 1;
    const md = day.slice(5) === '02-29' ? '02-28' : day.slice(5);
    return `${y}-${md}`;
  };
  return { from: shift(range.from), to: shift(range.to) };
}

/** Veraenderung in Prozent, null ohne Vergleichswert. */
export function change(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Einnahmen pro Firma. Buchungen ohne Firma, deren Zahler wie eine Firma
 * heisst, zaehlen zu dieser Firma (gleiche Regel wie im Cockpit).
 */
export function incomeByCustomer(entries: FinanceEntry[], names: Map<string, string>): { key: string; name: string; amount: number; share: number }[] {
  const idByName = new Map([...names.entries()].map(([id, name]) => [name.trim().toLowerCase(), id]));
  const income = entries.filter((e) => e.type === 'einnahme');
  const total = sumRappen(income.map((e) => e.amount));
  const sums = new Map<string, number>();
  for (const e of income) {
    const matched = !e.customerId && e.counterparty ? idByName.get(e.counterparty.trim().toLowerCase()) : undefined;
    const key = e.customerId ?? matched ?? `ohne:${e.counterparty ?? ''}`;
    sums.set(key, (sums.get(key) ?? 0) + Math.round(e.amount * 100));
  }
  return [...sums.entries()]
    .map(([key, rappen]) => ({
      key,
      name: key.startsWith('ohne:') ? key.slice(5) || 'Ohne Firma' : names.get(key) ?? 'Unbekannte Firma',
      amount: rappen / 100,
      share: total > 0 ? (rappen / 100 / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export interface AgencyMetrics {
  hours: number;
  billableHours: number;
  billedHours: number;
  /** verrechenbare Stunden / alle Stunden */
  billableShare: number | null;
  /** Umsatz aus verrechneten Zeiten / verrechnete Stunden */
  effectiveRate: number | null;
}

export function agencyMetrics(rows: TimeRow[], range: DayRange): AgencyMetrics {
  const inRange = rows.filter((r) => r.date >= range.from && r.date <= range.to);
  const sum = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) * 100) / 100;
  const hours = sum(inRange.map((r) => Number(r.hours)));
  const billableHours = sum(inRange.filter((r) => r.billable).map((r) => Number(r.hours)));
  const billed = inRange.filter((r) => r.billable && isBilled(r));
  const billedHours = sum(billed.map((r) => Number(r.hours)));
  const billedRevenue = sumRappen(billed.map((r) => Number(r.hours) * Number(r.rate)));
  return {
    hours,
    billableHours,
    billedHours,
    billableShare: hours > 0 ? (billableHours / hours) * 100 : null,
    effectiveRate: billedHours > 0 ? roundRappen(billedRevenue / billedHours) : null,
  };
}
