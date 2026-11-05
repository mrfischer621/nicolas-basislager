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

  it('meldet die letzte abgeschlossene Periode eines wiederkehrenden Projekts, ohne Zeiten doppelt zu zaehlen', () => {
    // Erfundene Projekte; heute 05.11.2026, also ist Oktober die letzte abgeschlossene Periode
    const wartung = { id: 'w', name: 'Muster Wartung', budget: 130, budget_period: 'monat' as const, budget_hours: 1, budget_start: '2026-09-01', is_active: true };
    const row = (id: string, project_id: string, date: string, hours: number, invoice_id: string | null = null) => ({ id, project_id, date, hours, rate: 130, billable: true, invoice_id, manual_status: null, description: null });
    const todos = buildTodos({
      ...base,
      today: '2026-11-05',
      lastBalanceDate: '2026-11-01',
      projects: [wartung, { ...wartung, id: 'alt', name: 'Archiviert', is_active: false }, { id: 'g', name: 'Gesamt', budget: 1000, is_active: true }],
      time: [
        row('sep', 'w', '2026-09-20', 1), // aeltere Periode: bleibt im 30-Tage-Eintrag
        row('okt1', 'w', '2026-10-02', 1.5), // aelter als 30 Tage, aber Teil der Periode
        row('okt2', 'w', '2026-10-28', 0.5),
        row('okt3', 'w', '2026-10-29', 1, 'r'), // verrechnet
        row('nov', 'w', '2026-11-02', 1), // laufende Periode
        row('arch', 'alt', '2026-10-02', 3), // archiviertes Projekt: nur 30-Tage-Eintrag
        row('g1', 'g', '2026-09-01', 2),
      ],
    });
    expect(todos.map((t) => [t.key, t.count, t.text, t.to, t.tone])).toEqual([
      ['periode-w', 2, 'Muster Wartung: Oktober 2026 verrechnen (2.00 h)', '/projekte/w?tab=perioden', 'attention'],
      ['zeiten', 3, '6.00 h nicht verrechnet, älter als 30 Tage', '/zeiterfassung?ansicht=offen&bis=2026-10-06', 'attention'],
    ]);
  });

  it('meldet nichts, wenn die letzte Periode verrechnet ist', () => {
    const wartung = { id: 'w', name: 'Muster Wartung', budget: null, budget_period: 'monat' as const, budget_hours: 1, budget_start: '2026-09-01', is_active: true };
    const todos = buildTodos({ ...base, projects: [wartung], time: [{ id: 'a', project_id: 'w', date: '2026-09-15', hours: 1, rate: 130, billable: true, invoice_id: 'r', manual_status: null, description: null }] });
    expect(todos).toEqual([]);
  });

  it('meldet einen fehlenden Kontostand', () => {
    expect(buildTodos({ ...base, lastBalanceDate: null })[0].text).toBe('Noch kein Kontostand erfasst');
  });
});
