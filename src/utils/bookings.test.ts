import { describe, it, expect } from 'vitest';
import type { FinanceEntry } from './financeAggregation';
import { filterBookings, isIncomplete, matchesBookingView, missingParts, supplierGroups } from './bookings';

const e = (id: string, over: Partial<FinanceEntry> = {}): FinanceEntry => ({
  id, source: 'transaction', sourceId: id, type: 'ausgabe', date: '2026-10-01', amount: 10, category: 'Informatik', counterparty: 'Anthropic',
  description: 'Abo', customerId: null, projectId: null, invoiceId: null, receiptUrl: 'r.pdf', tags: [], number: 'A1', recurrence: null, ...over,
});

describe('Buchungen', () => {
  it('erkennt unvollstaendige Ausgaben', () => {
    expect(isIncomplete(e('1'))).toBe(false);
    expect(missingParts(e('1', { receiptUrl: null, counterparty: null }))).toEqual(['Beleg', 'Lieferant']);
    expect(isIncomplete(e('1', { type: 'einnahme', receiptUrl: null }))).toBe(false);
    expect(isIncomplete(e('1', { source: 'invoice', receiptUrl: null }))).toBe(false);
  });

  it('filtert nach Ansicht, Zeitraum, Kategorie, Lieferant und Text', () => {
    const list = [e('1'), e('2', { type: 'einnahme', date: '2026-01-05' }), e('3', { category: null, counterparty: null, description: 'Druckerpatronen' })];
    expect(list.filter((x) => matchesBookingView(x, 'einnahmen')).map((x) => x.id)).toEqual(['2']);
    expect(filterBookings(list, { zeitraum: 'last_30_days' }, '2026-10-11').map((x) => x.id)).toEqual(['1', '3']);
    expect(filterBookings(list, { kategorie: '_ohne' }, '2026-10-11').map((x) => x.id)).toEqual(['3']);
    expect(filterBookings(list, { lieferant: 'Anthropic' }, '2026-10-11').map((x) => x.id)).toEqual(['1', '2']);
    expect(filterBookings(list, { q: 'drucker' }, '2026-10-11').map((x) => x.id)).toEqual(['3']);
  });

  it('gruppiert Buchungen ohne Lieferant und schlaegt bekannte Namen vor', () => {
    const g = supplierGroups(
      [
        e('1', { counterparty: null, description: 'Claude Abo (Pro)' }),
        e('2', { counterparty: null, description: 'claude abo (pro)', amount: 20 }),
        e('3', { counterparty: null, description: 'Hosting Infomaniak' }),
        e('4'),
      ],
      ['Infomaniak', 'Anthropic']
    );
    expect(g.map((x) => [x.label, x.ids, x.total, x.suggestion])).toEqual([
      ['Claude Abo (Pro)', ['1', '2'], 30, ''],
      ['Hosting Infomaniak', ['3'], 10, 'Infomaniak'],
    ]);
  });
});
