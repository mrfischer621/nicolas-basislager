import { describe, it, expect } from 'vitest';
import { buildTimeline } from './timeline';

describe('Zeitstrahl einer Firma', () => {
  it('sortiert neueste zuerst und fasst Zeiten pro Monat zusammen', () => {
    const t = buildTimeline({
      invoices: [{ id: 'r1', invoice_number: 'RE-1', created_at: '2026-08-03T09:00:00Z', sent_at: '2026-08-04T09:00:00Z', paid_at: '2026-08-25T12:00:00Z', status: 'bezahlt', total: 100 }],
      quotes: [{ id: 'q1', quote_number: 'OF-1', created_at: '2026-07-01T09:00:00Z', sent_at: null, converted_at: '2026-08-03T08:00:00Z', status: 'bestaetigt' }],
      deals: [{ id: 'd1', title: 'Shop', created_at: '2026-06-15T09:00:00Z', is_lost: false }],
      time: [{ date: '2026-07-10', hours: 2 }, { date: '2026-07-20', hours: 1.5 }],
      notes: [{ id: 'n1', created_at: '2026-09-01T09:00:00Z', body: 'Telefonat' }],
    });
    expect(t.map((e) => [e.day, e.text])).toEqual([
      ['2026-09-01', 'Telefonat'],
      ['2026-08-25', 'Rechnung RE-1 bezahlt'],
      ['2026-08-04', 'Rechnung RE-1 versendet'],
      ['2026-08-03', 'Offerte OF-1 in Rechnung umgewandelt'],
      ['2026-08-03', 'Rechnung RE-1 erstellt'],
      ['2026-07-31', '3.50 h erfasst im Juli 2026'],
      ['2026-07-01', 'Offerte OF-1 erstellt'],
      ['2026-06-15', 'Deal «Shop» angelegt'],
    ]);
  });

  it('ist leer ohne Daten', () => {
    expect(buildTimeline({ invoices: [], quotes: [], deals: [], time: [], notes: [] })).toEqual([]);
  });
});
