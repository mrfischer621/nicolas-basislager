import { describe, it, expect } from 'vitest';
import type { FinanceEntry } from './financeAggregation';
import { agencyMetrics, change, incomeByCustomer, previousYearRange } from './reports';
import type { TimeRow } from './timeEntries';

const entry = (amount: number, over: Partial<FinanceEntry> = {}): FinanceEntry => ({
  id: String(Math.random()), source: 'invoice', sourceId: 'x', type: 'einnahme', date: '2026-05-01', amount, category: null, counterparty: null,
  description: null, customerId: null, projectId: null, invoiceId: null, receiptUrl: null, tags: [], number: null, recurrence: null, ...over,
});

describe('Berichte', () => {
  it('verschiebt den Zeitraum um ein Jahr', () => {
    expect(previousYearRange({ from: '2026-01-01', to: '2026-10-11' })).toEqual({ from: '2025-01-01', to: '2025-10-11' });
    expect(previousYearRange({ from: '2028-02-29', to: '2028-03-31' })).toEqual({ from: '2027-02-28', to: '2027-03-31' });
  });

  it('rechnet die Veraenderung', () => {
    expect(change(150, 100)).toBe(50);
    expect(change(50, 0)).toBeNull();
    expect(change(-50, -100)).toBe(50);
  });

  it('summiert Einnahmen pro Firma und ordnet Zahlernamen zu', () => {
    const names = new Map([['a', 'Alpha AG']]);
    const r = incomeByCustomer([entry(300, { customerId: 'a' }), entry(100, { source: 'transaction', counterparty: 'Alpha AG' }), entry(100, { source: 'transaction', counterparty: 'Verein' }), entry(50, { type: 'ausgabe' })], names);
    expect(r.map((x) => [x.name, x.amount, x.share])).toEqual([['Alpha AG', 400, 80], ['Verein', 100, 20]]);
  });

  it('rechnet Quote und effektiven Satz der verrechneten Zeiten', () => {
    const t = (hours: number, rate: number, over: Partial<TimeRow> = {}): TimeRow => ({ id: String(Math.random()), project_id: 'p', date: '2026-05-01', hours, rate, billable: true, invoice_id: 'r', manual_status: null, description: null, ...over });
    const m = agencyMetrics([t(4, 130), t(2, 100), t(2, 130, { billable: false, invoice_id: null }), t(2, 130, { invoice_id: null }), t(5, 130, { date: '2025-01-01' })], { from: '2026-01-01', to: '2026-12-31' });
    expect(m).toEqual({ hours: 10, billableHours: 8, billedHours: 6, billableShare: 80, effectiveRate: 120 });
    expect(agencyMetrics([], { from: '2026-01-01', to: '2026-12-31' })).toMatchObject({ billableShare: null, effectiveRate: null });
  });
});
