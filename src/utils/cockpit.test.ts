import { describe, it, expect } from 'vitest';
import type { FinanceEntry } from './financeAggregation';
import {
  acquisition,
  concentration,
  fixedCosts,
  freeCash,
  incomeYearOverYear,
  last12Months,
  liquidityForecast,
  paymentDuration,
  recurringRevenue,
  recurringSeries,
  seriesDueDates,
  targetProgress,
  utilization,
  vatThreshold,
} from './cockpit';

const TODAY = '2026-10-11';
const entry = (date: string, amount: number, over: Partial<FinanceEntry> = {}): FinanceEntry => ({
  id: `${date}-${amount}-${over.counterparty ?? ''}`, source: 'transaction', sourceId: 'x', type: 'ausgabe', date, amount, category: 'Informatik', counterparty: null,
  description: null, customerId: null, projectId: null, invoiceId: null, receiptUrl: null, tags: [], number: null, recurrence: null, ...over,
});

describe('Frei verfuegbar', () => {
  it('rechnet AHV vom Gewinn und Steuern auf Gewinn minus AHV', () => {
    expect(freeCash(50000, 10, 15)).toEqual({ profit: 50000, ahv: 5000, tax: 6750, free: 38250, taxMissing: false });
  });
  it('ohne Steuersatz nur AHV, markiert', () => {
    expect(freeCash(10000, 10, null)).toMatchObject({ ahv: 1000, tax: 0, free: 9000, taxMissing: true });
  });
  it('keine Rueckstellung bei Verlust oder ohne Daten', () => {
    expect(freeCash(-2000, 10, 15)).toEqual({ profit: -2000, ahv: 0, tax: 0, free: -2000, taxMissing: false });
    expect(freeCash(0, 10, 15).free).toBe(0);
  });
});

describe('Wiederkehrende Ausgaben und Fixkosten', () => {
  const rec = (date: string, amount: number, cp: string, interval: FinanceEntry['recurrence'] = 'monatlich') => entry(date, amount, { counterparty: cp, recurrence: interval });
  const entries = [
    rec('2026-08-03', 20, 'Anthropic'),
    rec('2026-09-03', 20, 'Anthropic'),
    rec('2026-10-03', 25, 'Anthropic'), // +25 %
    rec('2026-01-15', 240, 'Infomaniak', 'jaehrlich'),
    rec('2026-05-02', 30, 'Altes Abo'), // seit zwei Monaten keine Buchung mehr
    entry('2026-10-05', 999, { counterparty: 'Einmalig' }),
  ];

  it('bildet Serien nach Gegenpartei, Betrag aus der juengsten Buchung', () => {
    const s = recurringSeries(entries, TODAY);
    expect(s.map((x) => [x.label, x.monthly, x.active, x.increased])).toEqual([
      ['Altes Abo', 30, false, false],
      ['Anthropic', 25, true, true],
      ['Infomaniak', 20, true, false],
    ]);
  });

  it('summiert aktive Fixkosten pro Monat und meldet Anstiege', () => {
    const f = fixedCosts(recurringSeries(entries, TODAY));
    expect(f.monthly).toBe(45);
    expect(f.increased.map((x) => x.label)).toEqual(['Anthropic']);
  });

  it('kommt ohne markierte Buchungen zurecht', () => {
    expect(fixedCosts(recurringSeries([entry('2026-10-01', 10)], TODAY))).toEqual({ monthly: 0, items: [], increased: [] });
  });

  it('rechnet die naechsten Zahltage', () => {
    const [anthropic] = recurringSeries(entries, TODAY).filter((x) => x.label === 'Anthropic');
    expect(seriesDueDates(anthropic, TODAY, '2027-01-10')).toEqual(['2026-11-03', '2026-12-03', '2027-01-03']);
  });
});

describe('Liquiditaetsvorschau', () => {
  const series = recurringSeries([entry('2026-10-01', 100, { counterparty: 'Miete', recurrence: 'monatlich' })], TODAY);
  const invoices = [
    { total: 1000, due_date: '2026-10-25', status: 'versendet' },
    { total: 2000, due_date: '2026-12-01', status: 'versendet' },
    { total: 500, due_date: '2026-09-30', status: 'versendet' }, // ueberfaellig
    { total: 300, due_date: null, status: 'versendet' },
    { total: 700, due_date: '2026-10-20', status: 'bezahlt' },
  ];

  it('rechnet 30/60/90 Tage ab dem letzten Kontostand', () => {
    const l = liquidityForecast({ date: '2026-10-05', amount: 5000 }, invoices, series, TODAY, 4000);
    expect(l.points.map((p) => [p.days, p.inflow, p.outflow, p.value, p.level])).toEqual([
      [30, 1000, 100, 5900, 'ok'],
      [60, 3000, 200, 7800, 'ok'],
      [90, 3000, 300, 7700, 'ok'],
    ]);
    expect(l.overdue).toBe(500);
    expect(l.withoutDue).toBe(300);
  });

  it('warnt unter der Mindestreserve und unter null', () => {
    const l = liquidityForecast({ date: TODAY, amount: 150 }, [], series, TODAY, 100);
    expect(l.points.map((p) => p.level)).toEqual(['warning', 'negative', 'negative']);
  });

  it('ohne Kontostand keine Punkte', () => {
    expect(liquidityForecast(null, invoices, series, TODAY, null).points).toEqual([]);
  });
});

describe('Abhaengigkeit von Kunden', () => {
  const names = new Map([['a', 'Alpha AG'], ['b', 'Beta GmbH'], ['c', 'Gamma']]);
  const inc = (date: string, amount: number, customerId: string) => entry(date, amount, { type: 'einnahme', customerId, source: 'invoice' });

  it('zeigt die Top 3 mit Anteil und Stufe', () => {
    const c = concentration([inc('2026-05-01', 6000, 'a'), inc('2026-06-01', 3000, 'b'), inc('2026-07-01', 1000, 'c'), inc('2025-09-01', 99999, 'c')], names, TODAY);
    expect(c.total).toBe(10000);
    expect(c.top.map((t) => [t.name, Math.round(t.share)])).toEqual([['Alpha AG', 60], ['Beta GmbH', 30], ['Gamma', 10]]);
    expect(c.level).toBe('warning');
  });

  it('ordnet Buchungen per Zahlername der Firma zu', () => {
    const c = concentration([inc('2026-05-01', 1000, 'a'), entry('2026-06-01', 1000, { type: 'einnahme', counterparty: 'alpha ag' })], names, TODAY);
    expect(c.top).toEqual([{ customerId: 'a', name: 'Alpha AG', amount: 2000, share: 100 }]);
  });

  it('Alarm ab 70 Prozent, leer ohne Einnahmen', () => {
    expect(concentration([inc('2026-05-01', 8000, 'a'), inc('2026-06-01', 2000, 'b')], names, TODAY).level).toBe('negative');
    expect(concentration([], names, TODAY)).toEqual({ total: 0, top: [], level: 'ok' });
  });
});

describe('Ziel gegen Ist', () => {
  it('rechnet Stand, Zeitmarke und noetigen Umsatz pro Monat', () => {
    const t = targetProgress(60000, 36000, TODAY);
    expect(Math.round(t.percent)).toBe(60);
    expect(Math.round(t.expectedPercent)).toBe(78); // 284. Tag von 365
    expect(t.gap).toBe(24000);
    expect(t.monthsLeft).toBe(3);
    expect(t.neededPerMonth).toBe(8000);
  });
  it('Ziel erreicht: keine Luecke', () => {
    expect(targetProgress(10000, 12000, TODAY)).toMatchObject({ gap: 0, neededPerMonth: 0 });
  });
});

describe('MWST-Schwelle', () => {
  const inv = (issue_date: string, total: number, status = 'versendet') => ({ issue_date, total, status });
  it('zaehlt Rechnungen nach Rechnungsdatum ohne Entwuerfe plus Einnahmen-Buchungen, 12 Monate', () => {
    const v = vatThreshold(
      [inv('2026-01-10', 50000), inv('2026-09-01', 30000, 'bezahlt'), inv('2026-10-01', 9000, 'entwurf'), inv('2025-10-11', 99999)],
      [entry('2026-03-01', 1000, { type: 'einnahme' }), entry('2026-03-01', 777, { type: 'einnahme', source: 'invoice' })],
      100000,
      TODAY
    );
    expect(v.revenue).toBe(81000);
    expect(v.level).toBe('warning');
  });
  it('ab 100 Prozent negative', () => {
    expect(vatThreshold([inv('2026-02-01', 100000)], [], 100000, TODAY).level).toBe('negative');
    expect(vatThreshold([], [], 100000, TODAY)).toEqual({ revenue: 0, threshold: 100000, percent: 0, level: 'ok' });
  });
  it('12-Monats-Fenster beginnt am Folgetag vor einem Jahr', () => {
    expect(last12Months(TODAY)).toEqual({ from: '2025-10-12', to: TODAY });
  });
});

describe('Zahlungsdauer', () => {
  const names = new Map([['a', 'Alpha AG'], ['b', 'Beta GmbH']]);
  const p = (customer_id: string, issue: string, due: string, paid: string | null, source: string | null = 'erfasst') => ({
    customer_id, issue_date: issue, due_date: due, paid_at: paid ? `${paid}T12:00:00Z` : null, status: 'bezahlt', paid_at_source: source,
  });
  it('mittelt Tage bis Zahlung und hebt Verspaetung ueber 10 Tage hervor', () => {
    const d = paymentDuration(
      [p('a', '2026-01-01', '2026-01-31', '2026-01-21'), p('a', '2026-03-01', '2026-03-31', '2026-03-31'), p('b', '2026-05-01', '2026-05-31', '2026-06-20'), p('b', '2026-06-01', '2026-07-01', '2026-07-01', 'faelligkeit'), p('a', '2026-07-01', '2026-07-31', null)],
      names,
      TODAY
    );
    expect(d.averageDays).toBe(33); // (20 + 30 + 50) / 3
    expect(d.excluded).toBe(2);
    expect(d.byCustomer.map((c) => [c.name, c.averageDelay, c.late])).toEqual([['Beta GmbH', 20, true], ['Alpha AG', -5, false]]);
  });
  it('ohne Zahlungen kein Durchschnitt', () => {
    expect(paymentDuration([], names, TODAY)).toEqual({ averageDays: null, count: 0, excluded: 0, byCustomer: [] });
  });
});

describe('Auslastung und effektiver Stundensatz', () => {
  it('zaehlt verrechenbare Stunden der Woche und des Monats, Satz ueber alle Stunden', () => {
    const u = utilization(
      [
        { date: '2026-10-09', hours: 4, rate: 130, billable: true },
        { date: '2026-10-05', hours: 2, rate: 130, billable: false },
        { date: '2026-10-02', hours: 3, rate: 120, billable: true },
        { date: '2025-12-01', hours: 9, rate: 100, billable: true },
      ],
      TODAY,
      25,
      130
    );
    expect(u.weekHours).toBe(4);
    expect(u.monthHours).toBe(7);
    expect(u.monthTarget).toBe(110.7);
    expect(u.effectiveRate).toBe(97.78); // (520 + 360) / 9 h
  });
  it('ohne Zeiten kein Satz', () => {
    expect(utilization([], TODAY, null, 160)).toMatchObject({ weekHours: 0, effectiveRate: null, monthTarget: null });
  });
});

describe('Wiederkehrender Umsatz', () => {
  it('Anteil und MRR der letzten 12 Monate', () => {
    const r = recurringRevenue(
      [
        { total: 1200, issue_date: '2026-03-01', status: 'bezahlt', is_recurring_revenue: true },
        { total: 1200, issue_date: '2026-09-01', status: 'versendet', is_recurring_revenue: true },
        { total: 3600, issue_date: '2026-05-01', status: 'bezahlt', is_recurring_revenue: false },
        { total: 500, issue_date: '2026-10-01', status: 'entwurf', is_recurring_revenue: true },
      ],
      TODAY
    );
    expect(r).toEqual({ total: 6000, recurring: 2400, share: 40, mrr: 200 });
  });
});

describe('Akquise', () => {
  it('zaehlt neue Leads und Deals pro Monat und die Quoten', () => {
    const a = acquisition(
      [
        { kind: 'lead', created_at: '2026-09-23T09:00:00Z', is_lost: false },
        { kind: 'lead', created_at: '2026-10-02T09:00:00Z', is_lost: false },
        { kind: 'deal', created_at: '2026-10-05T09:00:00Z', source: 'Recherche', is_lost: false },
        { kind: 'deal', created_at: '2026-08-01T09:00:00Z', is_lost: true },
        { kind: 'deal', created_at: '2026-07-01T09:00:00Z', is_lost: false, won: true },
      ],
      TODAY
    );
    expect(a.months.map((m) => [m.label, m.leads, m.deals])).toEqual([
      ['Mai', 0, 0], ['Jun', 0, 0], ['Jul', 0, 1], ['Aug', 0, 1], ['Sep', 1, 0], ['Okt', 1, 1],
    ]);
    expect(a.newDealsThisMonth).toBe(1);
    expect(Math.round(a.leadToDeal!)).toBe(33);
    expect(a.dealToWon).toBe(50);
  });
});

describe('Einnahmen gegen Vorjahr', () => {
  it('vergleicht bis zum gleichen Tag', () => {
    const inc = (date: string, amount: number) => entry(date, amount, { type: 'einnahme' });
    const r = incomeYearOverYear([inc('2026-02-01', 3000), inc('2025-03-01', 2000), inc('2025-11-01', 9999)], TODAY);
    expect(r).toEqual({ current: 3000, previous: 2000, change: 50 });
  });
});
