import { describe, it, expect } from 'vitest';
import { nextQuoteNumber, quoteState, quoteViewFilter, summarizeQuotes, type QuoteSummaryRow } from './quoteViews';

const TODAY = '2026-10-11';
const q = (id: string, status: QuoteSummaryRow['status'], total: number, valid_until = '2026-12-31', issue_date = '2026-06-01'): QuoteSummaryRow => ({
  id, quote_number: `OF-${id}`, status, total, valid_until, issue_date, customer_id: 'k', opportunity_id: null,
});

describe('Offerten', () => {
  it('leitet die Ansicht aus Status und Gueltigkeit ab', () => {
    expect(quoteState(q('1', 'offen', 1), TODAY)).toBe('entwurf');
    expect(quoteState(q('1', 'versendet', 1), TODAY)).toBe('versendet');
    expect(quoteState(q('1', 'versendet', 1, '2026-10-10'), TODAY)).toBe('abgelaufen');
    expect(quoteState(q('1', 'ueberfallig', 1), TODAY)).toBe('abgelaufen');
    expect(quoteState(q('1', 'bestaetigt', 1), TODAY)).toBe('umgewandelt');
  });

  it('zaehlt pro Ansicht und rechnet die Annahmequote', () => {
    const s = summarizeQuotes(
      [q('1', 'offen', 100), q('2', 'versendet', 4490), q('3', 'akzeptiert', 490), q('4', 'bestaetigt', 8000), q('5', 'abgelehnt', 1200), q('6', 'versendet', 300, '2026-09-01'), q('7', 'abgelehnt', 999, '2025-01-01', '2025-01-01')],
      TODAY
    );
    expect(s.counts).toMatchObject({ alle: 7, entwurf: 1, versendet: 1, akzeptiert: 1, umgewandelt: 1, abgelehnt: 2, abgelaufen: 1 });
    expect(s.sums.versendet).toBe(4490);
    expect(s.acceptance).toBe(50); // 2 gewonnen von 4 entschiedenen (ohne die alte Offerte)
    expect(summarizeQuotes([], TODAY).acceptance).toBeNull();
  });

  it('liefert Datenbankfilter fuer abgeleitete Ansichten', () => {
    expect(quoteViewFilter('abgelaufen', TODAY).orExpired).toBe('status.eq.ueberfallig,and(status.eq.versendet,valid_until.lt.2026-10-11)');
    expect(quoteViewFilter('versendet', TODAY)).toEqual({ status: ['versendet'], validFromOrNull: TODAY });
  });

  it('fuehrt die Nummern mit OF- fort', () => {
    expect(nextQuoteNumber(['AN-2026-006', 'AN-2025-010'], 2026)).toBe('OF-2026-007');
    expect(nextQuoteNumber(['OF-2026-007', 'AN-2026-006'], 2026)).toBe('OF-2026-008');
    expect(nextQuoteNumber([], 2027)).toBe('OF-2027-001');
  });
});
