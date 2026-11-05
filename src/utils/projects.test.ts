import { describe, it, expect } from 'vitest';
import { budgetPeriodOf, formatBudgetDiff, matchesProjectView, periodHistory, projectStats, withRecurringDefaults } from './projects';
import type { TimeRow } from './timeEntries';

const t = (hours: number, over: Partial<TimeRow> = {}): TimeRow => ({ id: String(Math.random()), project_id: 'p', date: '2026-10-01', hours, rate: 100, billable: true, invoice_id: null, manual_status: null, description: null, ...over });

describe('Projekte', () => {
  it('rechnet Verbrauch, offene Zeiten und Budgetstufe', () => {
    const s = projectStats({ id: 'p', budget: 1000 }, [t(5, { invoice_id: 'r' }), t(3), t(2, { billable: false }), t(9, { project_id: 'x' })]);
    expect(s).toEqual({ hours: 10, amount: 800, unbilledHours: 3, unbilledAmount: 300, budgetUsed: 80, level: 'warning', budgetMode: 'total', period: null });
  });

  it('ohne Budget keine Stufe, ohne Zeiten null', () => {
    expect(projectStats({ id: 'p', budget: null }, [])).toEqual({ hours: 0, amount: 0, unbilledHours: 0, unbilledAmount: 0, budgetUsed: null, level: 'ok', budgetMode: 'none', period: null });
    expect(projectStats({ id: 'p', budget: 500 }, [t(6)]).level).toBe('negative');
  });

  it('zeigt archivierte nur im Archiv', () => {
    expect(matchesProjectView({ status: 'laufend', is_active: false }, 'laufend')).toBe(false);
    expect(matchesProjectView({ status: 'laufend', is_active: false }, 'archiviert')).toBe(true);
    expect(matchesProjectView({ status: 'offen', is_active: true }, 'offen')).toBe(true);
  });

  describe('Wiederkehrendes Budget', () => {
    // Erfundenes Wartungsprojekt: 1 h pro Monat zu CHF 130
    const wartung = { id: 'p', name: 'Muster Wartung', budget: 130, budget_period: 'monat' as const, budget_hours: 1, budget_start: '2026-09-01' };
    const w = (date: string, hours: number, over: Partial<TimeRow> = {}) => t(hours, { date, rate: 130, ...over });

    it('liefert Kalenderperioden mit Label, vor dem Beginn null', () => {
      expect(budgetPeriodOf('2026-11-05', 'monat', '2026-09-01')).toEqual({ from: '2026-11-01', to: '2026-11-30', label: 'November 2026' });
      expect(budgetPeriodOf('2028-02-10', 'monat', '2026-09-01')).toEqual({ from: '2028-02-01', to: '2028-02-29', label: 'Februar 2028' });
      expect(budgetPeriodOf('2026-11-05', 'quartal', '2026-01-01')).toEqual({ from: '2026-10-01', to: '2026-12-31', label: 'Q4 2026' });
      expect(budgetPeriodOf('2026-05-31', 'quartal', '2026-01-01')).toEqual({ from: '2026-04-01', to: '2026-06-30', label: 'Q2 2026' });
      expect(budgetPeriodOf('2026-11-05', 'jahr', '2025-03-01')).toEqual({ from: '2026-01-01', to: '2026-12-31', label: '2026' });
      expect(budgetPeriodOf('2026-08-31', 'monat', '2026-09-01')).toBeNull();
    });

    it('beginnt mitten im Monat ohne anteiliges Budget', () => {
      expect(budgetPeriodOf('2026-09-20', 'monat', '2026-09-15')).toEqual({ from: '2026-09-15', to: '2026-09-30', label: 'September 2026' });
      const [sep] = periodHistory({ ...wartung, budget_start: '2026-09-15' }, [w('2026-09-10', 3), w('2026-09-16', 0.5)], '2026-09-20');
      expect(sep).toMatchObject({ from: '2026-09-15', hours: 0.5, budgetHours: 1, usedPercent: 50, overHours: -0.5 });
    });

    it('wechselt am Monatsende in die neue Periode und zeigt den Verlauf', () => {
      const rows = [w('2026-09-10', 1, { invoice_id: 'r' }), w('2026-10-31', 2), w('2026-11-01', 0.5)];
      const oct = periodHistory(wartung, rows, '2026-10-31');
      expect(oct.map((p) => [p.label, p.hours, p.isCurrent, p.isClosed])).toEqual([
        ['Oktober 2026', 2, true, false],
        ['September 2026', 1, false, true],
      ]);
      const nov = periodHistory(wartung, rows, '2026-11-01');
      expect(nov.map((p) => [p.label, p.hours, p.unbilledHours])).toEqual([
        ['November 2026', 0.5, 0.5],
        ['Oktober 2026', 2, 2],
        ['September 2026', 1, 0],
      ]);
      expect(periodHistory(wartung, rows, '2027-12-15', 3)).toHaveLength(3);
    });

    it('ignoriert Zeiten vor dem Beginn und nicht verrechenbare Zeiten', () => {
      const rows = [w('2026-08-31', 5), w('2026-09-05', 0.5), w('2026-09-06', 4, { billable: false }), w('2026-09-07', 1, { project_id: 'x' })];
      const [sep] = periodHistory(wartung, rows, '2026-09-30');
      expect(sep).toMatchObject({ hours: 0.5, amount: 65, usedPercent: 50, overHours: -0.5, overAmount: -65 });
      expect(periodHistory(wartung, rows, '2026-08-31')).toEqual([]);
    });

    it('zeigt Mehraufwand und bezieht die Ampel auf die laufende Periode', () => {
      const rows = [w('2026-09-05', 1), w('2026-10-02', 1.5), w('2026-11-03', 0.5)];
      const [, oct] = periodHistory(wartung, rows, '2026-11-05');
      expect(oct).toMatchObject({ overHours: 0.5, overAmount: 65, usedPercent: 150, isClosed: true });
      const s = projectStats(wartung, rows, '2026-11-05');
      expect(s.budgetMode).toBe('recurring');
      expect(s.budgetUsed).toBe(50);
      expect(s.level).toBe('ok');
      expect(s.period?.label).toBe('November 2026');
      // Gesamtzahlen bleiben ueber die ganze Laufzeit
      expect(s.hours).toBe(3);
      expect(projectStats(wartung, [...rows, w('2026-11-04', 0.4)], '2026-11-05').level).toBe('warning');
      expect(projectStats(wartung, [...rows, w('2026-11-04', 0.5)], '2026-11-05').level).toBe('negative');
    });

    it('vergleicht nur Stunden oder nur Betrag', () => {
      const rows = [w('2026-11-02', 2, { rate: 100 })];
      const onlyHours = projectStats({ ...wartung, budget: null, budget_hours: 4 }, rows, '2026-11-05');
      expect(onlyHours.period).toMatchObject({ budgetAmount: null, overAmount: null, usedPercent: 50, overHours: -2 });
      const onlyAmount = projectStats({ ...wartung, budget: 400, budget_hours: null }, rows, '2026-11-05');
      expect(onlyAmount.period).toMatchObject({ budgetHours: null, overHours: null, amount: 200, usedPercent: 50, overAmount: -200 });
    });

    it('hat vor dem Beginn keine laufende Periode', () => {
      const s = projectStats({ ...wartung, budget_start: '2026-12-01' }, [w('2026-11-02', 2)], '2026-11-05');
      expect(s).toMatchObject({ budgetMode: 'recurring', period: null, budgetUsed: null, level: 'ok' });
    });

    it('rechnet Quartal und Jahr', () => {
      const rows = [w('2026-07-01', 2), w('2026-09-30', 1), w('2026-10-01', 3)];
      const q = periodHistory({ ...wartung, budget_period: 'quartal', budget_hours: 4, budget_start: '2026-07-01' }, rows, '2026-11-05');
      expect(q.map((p) => [p.label, p.hours, p.overHours])).toEqual([['Q4 2026', 3, -1], ['Q3 2026', 3, -1]]);
      const y = periodHistory({ ...wartung, budget_period: 'jahr', budget_hours: 5, budget_start: '2025-01-01' }, rows, '2026-11-05');
      expect(y.map((p) => [p.label, p.hours, p.overHours])).toEqual([['2026', 6, 1], ['2025', 0, -5]]);
    });

    it('schlaegt Titel und wiederkehrenden Umsatz fuer den Rechnungsentwurf vor', () => {
      const preset = { customerId: 'k', projectId: 'p', items: [], hours: 2, amount: 260 };
      const rows = [w('2026-11-02', 1), w('2026-10-20', 1)];
      expect(withRecurringDefaults(preset, wartung, rows)).toMatchObject({ title: 'Muster Wartung Oktober 2026', isRecurringRevenue: true });
      expect(withRecurringDefaults(preset, { ...wartung, budget_period: null }, rows)).toBe(preset);
      expect(withRecurringDefaults({ ...preset, projectId: null }, wartung, rows)).toEqual({ ...preset, projectId: null });
    });

    it('formatiert die Differenz mit Vorzeichen und Wort', () => {
      const chf = (n: number) => `CHF ${n}`;
      expect(formatBudgetDiff(1, 'h', chf)).toBe('+1.00 h Mehraufwand');
      expect(formatBudgetDiff(-0.5, 'h', chf)).toBe('−0.50 h Rest');
      expect(formatBudgetDiff(-65, 'chf', chf)).toBe('−CHF 65 Rest');
    });
  });
});
