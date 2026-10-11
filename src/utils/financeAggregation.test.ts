import { describe, it, expect } from 'vitest';
import {
  addDays,
  buildFinanceEntries,
  buildTimeline,
  byCategory,
  defaultGranularity,
  filterRange,
  isoWeek,
  presetRange,
  summarize,
  toDay,
  weekStart,
  type FinanceInvoiceInput,
  type FinanceTransactionInput,
} from './financeAggregation';

const tx = (
  id: string,
  type: 'einnahme' | 'ausgabe',
  date: string,
  amount: number | string,
  extra: Partial<FinanceTransactionInput> = {}
): FinanceTransactionInput => ({
  id,
  type,
  date,
  amount,
  category: 'Informatik & Telekom',
  description: null,
  customer_id: null,
  invoice_id: null,
  transaction_number: id,
  ...extra,
});

const inv = (id: string, paid_at: string | null, total: number | string, status = 'bezahlt'): FinanceInvoiceInput => ({
  id,
  invoice_number: `R-${id}`,
  status,
  total,
  issue_date: '2026-01-01',
  paid_at,
  customer_id: 'k1',
  customers: { name: 'Kunde AG' },
});

describe('Datum', () => {
  it('rechnet paid_at (timestamptz) in Zuercher Kalendertage um', () => {
    // 23:30 UTC am 30.09. ist in Zuerich (Sommerzeit) bereits der 01.10.
    expect(toDay('2026-09-30T23:30:00+00:00')).toBe('2026-10-01');
    expect(toDay('2026-07-30')).toBe('2026-07-30');
  });

  it('addiert Tage ueber Monats- und Jahresgrenzen', () => {
    expect(addDays('2026-10-11', -89)).toBe('2026-07-14');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30'); // Zeitumstellung egal
  });

  it('kennt ISO-Wochen', () => {
    expect(weekStart('2026-10-11')).toBe('2026-10-05'); // Sonntag -> Montag davor
    expect(isoWeek('2026-10-11')).toBe(41);
    expect(isoWeek('2027-01-01')).toBe(53);
  });

  it('liefert "letzte 90 Tage" inklusive Stichtag', () => {
    expect(presetRange('last_90_days', '2026-10-11')).toEqual({ from: '2026-07-14', to: '2026-10-11' });
    expect(presetRange('last_month', '2026-03-15')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(presetRange('last_year', '2026-10-11')).toEqual({ from: '2025-01-01', to: '2025-12-31' });
  });
});

describe('buildFinanceEntries', () => {
  it('zaehlt Einnahmen aus bezahlten Rechnungen und Buchungen, Ausgaben aus Buchungen', () => {
    const { entries } = buildFinanceEntries(
      [inv('1', '2026-08-01T10:00:00+00:00', 1000), inv('2', null, 500, 'versendet')],
      [tx('A1', 'ausgabe', '2026-08-02', '80.65'), tx('E1', 'einnahme', '2026-08-03', 200)]
    );
    expect(summarize(entries)).toEqual({ income: 1200, expense: 80.65, profit: 1119.35, count: 3 });
  });

  it('raet nicht: bezahlte Rechnung ohne paid_at wird gemeldet statt gezaehlt', () => {
    const { entries, paidWithoutDate } = buildFinanceEntries([inv('1', null, 1000)], []);
    expect(entries).toHaveLength(0);
    expect(paidWithoutDate.map((i) => i.id)).toEqual(['1']);
  });

  it('zaehlt eine Einnahmen-Buchung zu einer Rechnung nicht doppelt', () => {
    const { entries } = buildFinanceEntries(
      [inv('1', '2026-08-01', 1000)],
      [tx('E1', 'einnahme', '2026-08-01', 1000, { invoice_id: '1' })]
    );
    expect(summarize(entries).income).toBe(1000);
  });

  it('wandelt numeric-Strings aus Supabase in Zahlen', () => {
    const { entries } = buildFinanceEntries([], [tx('A1', 'ausgabe', '2026-08-02', '19.90')]);
    expect(entries[0].amount).toBe(19.9);
  });

  it('summiert ohne Gleitkommafehler', () => {
    const many = Array.from({ length: 10 }, (_, i) => tx(`A${i}`, 'ausgabe', '2026-01-01', 0.1));
    expect(summarize(buildFinanceEntries([], many).entries).expense).toBe(1);
  });
});

describe('filterRange', () => {
  const { entries } = buildFinanceEntries(
    [],
    [
      tx('vorher', 'ausgabe', '2026-07-13', 1),
      tx('rand-start', 'ausgabe', '2026-07-14', 2),
      tx('rand-ende', 'ausgabe', '2026-10-11', 4),
      tx('nachher', 'ausgabe', '2026-10-12', 8),
    ]
  );

  it('nimmt Buchungen genau auf dem Rand mit, die ausserhalb nicht', () => {
    const inRange = filterRange(entries, presetRange('last_90_days', '2026-10-11'));
    expect(inRange.map((e) => e.id)).toEqual(['rand-start', 'rand-ende']);
    expect(summarize(inRange).expense).toBe(6);
  });

  it('liefert fuer einen leeren Zeitraum Nullsummen', () => {
    expect(summarize(filterRange(entries, { from: '2025-01-01', to: '2025-12-31' }))).toEqual({
      income: 0,
      expense: 0,
      profit: 0,
      count: 0,
    });
  });
});

describe('buildTimeline', () => {
  const range = presetRange('last_90_days', '2026-10-11');
  const { entries } = buildFinanceEntries(
    [inv('1', '2026-10-11T08:00:00+00:00', 500)],
    [tx('A016', 'ausgabe', '2026-07-30', 18.6), tx('A002', 'ausgabe', '2026-10-11', 70.05)]
  );

  it('ordnet jede Buchung einer angelegten Woche zu (Dashboard-Fehler)', () => {
    const weeks = buildTimeline(filterRange(entries, range), range, 'week');
    const total = weeks.reduce((s, w) => s + w.expense, 0);
    expect(Math.round(total * 100) / 100).toBe(88.65);
    expect(weeks[0].key).toBe('2026-07-13'); // Montag der Woche des 14.07.
    expect(weeks[weeks.length - 1].key).toBe('2026-10-05');
    expect(weeks.find((w) => w.key === '2026-10-05')).toMatchObject({ income: 500, expense: 70.05 });
  });

  it('stimmt in jeder Aufloesung mit summarize ueberein', () => {
    const filtered = filterRange(entries, range);
    const totals = summarize(filtered);
    for (const g of ['day', 'week', 'month'] as const) {
      const tl = buildTimeline(filtered, range, g);
      expect(Math.round(tl.reduce((s, p) => s + p.expense, 0) * 100) / 100).toBe(totals.expense);
      expect(Math.round(tl.reduce((s, p) => s + p.income, 0) * 100) / 100).toBe(totals.income);
      expect(tl[tl.length - 1].cumulativeProfit).toBe(totals.profit);
    }
  });

  it('legt Tage lueckenlos an, auch ohne Buchungen', () => {
    const tl = buildTimeline([], { from: '2026-10-05', to: '2026-10-11' }, 'day');
    expect(tl).toHaveLength(7);
    expect(tl.every((p) => p.income === 0 && p.expense === 0)).toBe(true);
    expect(tl[0].label).toBe('05.10.');
  });

  it('waehlt eine sinnvolle Aufloesung', () => {
    expect(defaultGranularity(presetRange('last_30_days', '2026-10-11'))).toBe('day');
    expect(defaultGranularity(range)).toBe('week');
    expect(defaultGranularity({ from: '2026-01-01', to: '2026-12-31' })).toBe('month');
  });
});

describe('byCategory', () => {
  it('fasst nach Kategorie und Typ zusammen, leere Kategorie als "Ohne Kategorie"', () => {
    const { entries } = buildFinanceEntries(
      [],
      [
        tx('A1', 'ausgabe', '2026-01-01', 10),
        tx('A2', 'ausgabe', '2026-01-02', 5),
        tx('A3', 'ausgabe', '2026-01-03', 1, { category: '' }),
      ]
    );
    expect(byCategory(entries)).toEqual([
      { key: 'Informatik & Telekom', type: 'ausgabe', amount: 15, count: 2 },
      { key: 'Ohne Kategorie', type: 'ausgabe', amount: 1, count: 1 },
    ]);
  });
});
