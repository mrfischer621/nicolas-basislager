import { describe, it, expect } from 'vitest';
import {
  applyDueDate,
  daysUntilDue,
  draftError,
  draftUpdates,
  initialDrafts,
  invoiceState,
  invoiceSummarySentence,
  setDraftDay,
  summarizeInvoices,
  viewFilter,
  type InvoiceSummaryRow,
} from './invoiceViews';

const TODAY = '2026-10-11';
const row = (id: string, status: InvoiceSummaryRow['status'], total: number, due: string | null, paid: string | null = null, issue = '2026-09-01'): InvoiceSummaryRow => ({
  id, status, total, due_date: due, issue_date: issue, paid_at: paid, customer_id: 'k1', invoice_number: `RE-${id}`,
});

describe('Rechnungsstatus', () => {
  it('leitet ueberfaellig aus der Faelligkeit ab', () => {
    expect(invoiceState(row('1', 'versendet', 1, '2026-10-10'), TODAY)).toBe('ueberfaellig');
    expect(invoiceState(row('1', 'versendet', 1, '2026-10-11'), TODAY)).toBe('versendet');
    expect(invoiceState(row('1', 'versendet', 1, null), TODAY)).toBe('versendet');
  });

  it('behandelt den alten Wert überfällig wie versendet', () => {
    expect(invoiceState(row('1', 'überfällig', 1, '2026-12-01'), TODAY)).toBe('versendet');
    expect(invoiceState(row('1', 'überfällig', 1, '2026-01-01'), TODAY)).toBe('ueberfaellig');
  });

  it('rechnet Tage bis zur Faelligkeit', () => {
    expect(daysUntilDue('2026-10-14', TODAY)).toBe(3);
    expect(daysUntilDue('2026-10-01', TODAY)).toBe(-10);
    expect(daysUntilDue(null, TODAY)).toBeNull();
  });

  it('liefert die Filter fuer die Datenbank', () => {
    expect(viewFilter('ueberfaellig', TODAY)).toEqual({ status: ['versendet', 'überfällig'], dueBefore: TODAY });
    expect(viewFilter('alle', TODAY)).toEqual({});
  });
});

describe('Kennzahlen der Rechnungsliste', () => {
  const rows = [
    row('1', 'entwurf', 760, '2026-11-01'),
    row('2', 'versendet', 1490, '2026-09-28'),
    row('3', 'versendet', 500, '2026-10-30'),
    row('4', 'bezahlt', 2400, '2026-02-02', '2026-02-20T12:00:00Z'),
    row('5', 'bezahlt', 980, '2026-09-01', null),
    row('6', 'bezahlt', 300, '2025-12-01', '2025-12-20T12:00:00Z'),
  ];

  it('zaehlt und summiert pro Ansicht', () => {
    const s = summarizeInvoices(rows, TODAY);
    expect(s.counts).toEqual({ alle: 6, entwurf: 1, versendet: 1, ueberfaellig: 1, bezahlt: 3 });
    expect(s.sums.ueberfaellig).toBe(1490);
    expect(s.sums.versendet).toBe(500);
    expect(s.paidThisYear).toBe(2400);
    expect(s.missingPaidDate.map((r) => r.id)).toEqual(['5']);
  });

  it('formuliert die Lage in einem Satz', () => {
    expect(invoiceSummarySentence(summarizeInvoices(rows, TODAY))).toBe("2 offene Rechnungen, CHF 1'490 überfällig, 1 Entwurf.");
    expect(invoiceSummarySentence(summarizeInvoices([], TODAY))).toBe('Keine offenen Rechnungen.');
  });
});

describe('Sammeldialog Zahlungsdatum', () => {
  const missing = [row('a', 'bezahlt', 100, '2026-03-31', null, '2026-03-01'), row('b', 'bezahlt', 200, null, null, '2026-04-01'), row('c', 'bezahlt', 300, '2026-05-31', null, '2026-05-01')];

  it('belegt nichts vor', () => {
    const d = initialDrafts(missing);
    expect(d.every((x) => x.day === '')).toBe(true);
    expect(draftUpdates(d, TODAY)).toEqual([]);
  });

  it('uebernimmt die Faelligkeit nur auf Wunsch und markiert die Herkunft', () => {
    const all = applyDueDate(initialDrafts(missing));
    expect(all.map((x) => [x.day, x.source])).toEqual([
      ['2026-03-31', 'faelligkeit'],
      ['', 'erfasst'], // ohne Faelligkeit bleibt die Zeile leer
      ['2026-05-31', 'faelligkeit'],
    ]);
    const one = applyDueDate(initialDrafts(missing), ['c']);
    expect(one.map((x) => x.day)).toEqual(['', '', '2026-05-31']);
  });

  it('ein von Hand gesetztes Datum gilt als erfasst', () => {
    const d = setDraftDay(applyDueDate(initialDrafts(missing)), 'a', '2026-04-12');
    expect(d[0]).toMatchObject({ day: '2026-04-12', source: 'erfasst' });
  });

  it('speichert nur ausgefuellte, gueltige Zeilen', () => {
    let d = initialDrafts(missing);
    d = setDraftDay(d, 'a', '2026-04-12');
    d = setDraftDay(d, 'c', '2027-01-01'); // Zukunft
    expect(draftError(d[2], TODAY)).toBe('Liegt in der Zukunft');
    expect(draftUpdates(d, TODAY)).toEqual([{ id: 'a', paid_at: '2026-04-12T12:00:00Z', paid_at_source: 'erfasst' }]);
  });

  it('lehnt ein Datum vor dem Rechnungsdatum ab', () => {
    const d = setDraftDay(initialDrafts(missing), 'b', '2026-03-15');
    expect(draftError(d[1], TODAY)).toBe('Vor dem Rechnungsdatum');
  });
});
