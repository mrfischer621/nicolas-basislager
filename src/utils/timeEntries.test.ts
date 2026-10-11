import { describe, it, expect } from 'vitest';
import { billingState, buildInvoicePreset, groupTimeEntries, isUnbilled, matchesView, totals, type TimeRow } from './timeEntries';

const TODAY = '2026-10-11'; // Sonntag, KW 41
const e = (id: string, date: string, hours: number, over: Partial<TimeRow> = {}): TimeRow => ({
  id, date, hours, rate: 130, billable: true, invoice_id: null, manual_status: null, description: null,
  project_id: 'p1', projectName: 'Website', customerId: 'k1', customerName: 'Beispiel GmbH', ...over,
});

describe('Zeiterfassung: Ansichten und Status', () => {
  it('erkennt nicht verrechnete Zeiten', () => {
    expect(isUnbilled(e('1', TODAY, 1))).toBe(true);
    expect(isUnbilled(e('1', TODAY, 1, { billable: false }))).toBe(false);
    expect(isUnbilled(e('1', TODAY, 1, { invoice_id: 'r1' }))).toBe(false);
    expect(isUnbilled(e('1', TODAY, 1, { manual_status: 'bezahlt' }))).toBe(false);
    expect(isUnbilled(e('1', TODAY, 1, { manual_status: 'offen' }))).toBe(true);
  });

  it('filtert Woche und Monat ab Montag bzw. Monatsanfang', () => {
    expect(matchesView(e('1', '2026-10-05', 1), 'woche', TODAY)).toBe(true);
    expect(matchesView(e('1', '2026-10-04', 1), 'woche', TODAY)).toBe(false);
    expect(matchesView(e('1', '2026-10-01', 1), 'monat', TODAY)).toBe(true);
    expect(matchesView(e('1', '2026-09-30', 1), 'monat', TODAY)).toBe(false);
  });

  it('trennt Verrechnungsstatus von verrechenbar', () => {
    expect(billingState(e('1', TODAY, 1))).toBe('offen');
    expect(billingState(e('1', TODAY, 1, { billable: false }))).toBe('nicht_verrechenbar');
    expect(billingState(e('1', TODAY, 1, { invoice_id: 'r', invoice_status: 'entwurf' }))).toBe('entwurf');
    expect(billingState(e('1', TODAY, 1, { invoice_id: 'r', invoice_status: 'überfällig' }))).toBe('versendet');
    expect(billingState(e('1', TODAY, 1, { invoice_id: 'r', invoice_status: 'bezahlt' }))).toBe('bezahlt');
    expect(billingState(e('1', TODAY, 1, { manual_status: 'bezahlt' }))).toBe('manuell_bezahlt');
  });
});

describe('Zeiterfassung: Gruppen und Summen', () => {
  const rows = [
    e('1', '2026-10-09', 2.5),
    e('2', '2026-10-08', 1, { billable: false }),
    e('3', '2026-10-02', 4, { project_id: 'p2', projectName: 'Shop', customerId: 'k2', customerName: 'Muster AG', rate: 120 }),
  ];

  it('summiert Stunden und nur verrechenbare Betraege', () => {
    expect(totals(rows)).toEqual({ hours: 7.5, billableHours: 6.5, amount: 805, count: 3 });
  });

  it('gruppiert nach Woche, neueste zuerst, mit Zwischensumme', () => {
    const g = groupTimeEntries(rows, 'woche');
    expect(g.map((x) => x.label)).toEqual(['KW 41, 05.10. – 11.10.', 'KW 40, 28.09. – 04.10.']);
    expect(g[0].totals).toMatchObject({ hours: 3.5, amount: 325 });
  });

  it('gruppiert nach Firma', () => {
    expect(groupTimeEntries(rows, 'firma').map((x) => [x.label, x.totals.hours])).toEqual([
      ['Beispiel GmbH', 3.5],
      ['Muster AG', 4],
    ]);
  });

  it('kommt mit leeren Daten zurecht', () => {
    expect(groupTimeEntries([], 'woche')).toEqual([]);
    expect(totals([])).toEqual({ hours: 0, billableHours: 0, amount: 0, count: 0 });
  });
});

describe('Rechnung aus Zeiten', () => {
  it('buendelt pro Woche und Projekt mit dem erfassten Satz', () => {
    const r = buildInvoicePreset([e('1', '2026-10-09', 2.5, { description: 'Startseite' }), e('2', '2026-10-06', 1), e('3', '2026-09-29', 2)]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.preset.customerId).toBe('k1');
    expect(r.preset.projectId).toBe('p1');
    expect(r.preset.items.map((i) => [i.quantity, i.unit_price, i.timeEntryIds])).toEqual([
      [2, 130, ['3']],
      [3.5, 130, ['2', '1']],
    ]);
    expect(r.preset.items[1].description).toContain('KW 41 (Okt 2026), Website');
    expect(r.preset.items[1].description).toContain('09.10. Startseite (2.50 h)');
    expect(r.preset.amount).toBe(715);
  });

  it('trennt Positionen mit unterschiedlichem Satz', () => {
    const r = buildInvoicePreset([e('1', '2026-10-09', 1), e('2', '2026-10-08', 1, { rate: 100 })]);
    expect(r.ok && r.preset.items.length).toBe(2);
  });

  it('lehnt Zeiten mehrerer Firmen ab', () => {
    const r = buildInvoicePreset([e('1', TODAY, 1), e('2', TODAY, 1, { customerId: 'k2' })]);
    expect(r).toEqual({ ok: false, reason: 'Wähle Zeiten einer einzigen Firma.' });
  });

  it('lehnt bereits verrechnete Zeiten ab', () => {
    const r = buildInvoicePreset([e('1', TODAY, 1, { invoice_id: 'r1' })]);
    expect(r.ok).toBe(false);
  });

  it('maskiert HTML in Beschreibungen', () => {
    const r = buildInvoicePreset([e('1', TODAY, 1, { description: '<b>x</b>' })]);
    expect(r.ok && r.preset.items[0].description).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});
