import { describe, it, expect } from 'vitest';
import { buildTodos } from './cockpitTodos';

const TODAY = '2026-10-11';
const base = { today: TODAY, invoices: [], deals: [], newLeads: 0, time: [], entries: [], deadlines: [], lastBalanceDate: '2026-10-01' };

describe('Zu erledigen', () => {
  it('ist leer, wenn nichts ansteht', () => {
    expect(buildTodos(base)).toEqual([]);
  });

  it('sammelt Rechnungen, Fristen, Zeiten und Kontostand mit Ziel', () => {
    const todos = buildTodos({
      ...base,
      invoices: [
        { id: '1', invoice_number: 'RE-1', status: 'versendet', total: 100, due_date: '2026-10-01', issue_date: '2026-09-01', paid_at: null, customer_id: 'k' },
        { id: '2', invoice_number: 'RE-2', status: 'bezahlt', total: 100, due_date: '2026-10-01', issue_date: '2026-09-01', paid_at: null, customer_id: 'k' },
      ],
      deadlines: [{ id: 'd', company_id: 'c', title: 'AHV-Akonto', due_date: '2026-10-20', recurrence: 'quartalsweise', done_at: null, note: null, created_at: '' }],
      time: [{ id: 't', project_id: 'p', date: '2026-08-01', hours: 2, rate: 130, billable: true, invoice_id: null, manual_status: null, description: null }],
      newLeads: 3,
      lastBalanceDate: '2026-08-01',
    });
    expect(todos.map((t) => [t.key, t.text, t.to ?? t.action])).toEqual([
      ['ueberfaellig', '1 überfällige Rechnung', '/rechnungen?ansicht=ueberfaellig'],
      ['zahlungsdatum', '1 bezahlte Rechnung ohne Zahlungsdatum', 'zahlungsdaten'],
      ['fristen', 'Frist: AHV-Akonto', '/einstellungen/fristen'],
      ['leads', '3 neue Leads', '/leads?ansicht=neu'],
      ['zeiten', '2.00 h nicht verrechnet, älter als 30 Tage', '/zeiterfassung?ansicht=offen&bis=2026-09-11'],
      ['kontostand', 'Kontostand älter als 30 Tage', 'kontostand'],
    ]);
  });

  it('meldet einen fehlenden Kontostand', () => {
    expect(buildTodos({ ...base, lastBalanceDate: null })[0].text).toBe('Noch kein Kontostand erfasst');
  });
});
