import { describe, it, expect } from 'vitest';
import { matchesProjectView, projectStats } from './projects';
import type { TimeRow } from './timeEntries';

const t = (hours: number, over: Partial<TimeRow> = {}): TimeRow => ({ id: String(Math.random()), project_id: 'p', date: '2026-10-01', hours, rate: 100, billable: true, invoice_id: null, manual_status: null, description: null, ...over });

describe('Projekte', () => {
  it('rechnet Verbrauch, offene Zeiten und Budgetstufe', () => {
    const s = projectStats({ id: 'p', budget: 1000 }, [t(5, { invoice_id: 'r' }), t(3), t(2, { billable: false }), t(9, { project_id: 'x' })]);
    expect(s).toEqual({ hours: 10, amount: 800, unbilledHours: 3, unbilledAmount: 300, budgetUsed: 80, level: 'warning' });
  });

  it('ohne Budget keine Stufe, ohne Zeiten null', () => {
    expect(projectStats({ id: 'p', budget: null }, [])).toEqual({ hours: 0, amount: 0, unbilledHours: 0, unbilledAmount: 0, budgetUsed: null, level: 'ok' });
    expect(projectStats({ id: 'p', budget: 500 }, [t(6)]).level).toBe('negative');
  });

  it('zeigt archivierte nur im Archiv', () => {
    expect(matchesProjectView({ status: 'laufend', is_active: false }, 'laufend')).toBe(false);
    expect(matchesProjectView({ status: 'laufend', is_active: false }, 'archiviert')).toBe(true);
    expect(matchesProjectView({ status: 'offen', is_active: true }, 'offen')).toBe(true);
  });
});
