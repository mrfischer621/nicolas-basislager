/**
 * Cockpit-Berechnungen (docs/ux-struktur/konzept.md, Abschnitt 6.1).
 * Reine Funktionen auf Basis der zentralen Aggregation (FinanceEntry) und der
 * schlanken Listenabfragen. Alle Werte gelten fuer EIN Unternehmen; Blauwasser
 * und Freiluftchuchi werden nie zusammengezaehlt (Entscheid 11.10.2026).
 * Datum immer als Zuercher Kalendertag 'YYYY-MM-DD'.
 */
import type { FinanceEntry } from './financeAggregation';
import { addDays, toDay } from './financeAggregation';
import { roundRappen, sumRappen } from './money';

export type Level = 'ok' | 'warning' | 'negative';
type Interval = 'monatlich' | 'quartalsweise' | 'jaehrlich';

const MONTHS_PER: Record<Interval, number> = { monatlich: 1, quartalsweise: 3, jaehrlich: 12 };

function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

function addMonths(day: string, months: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const total = m - 1 + months;
  const ny = y + Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** Die letzten 12 Monate bis und mit heute. */
export function last12Months(today: string): { from: string; to: string } {
  return { from: addDays(addMonths(today, -12), 1), to: today };
}

// ---------------------------------------------------------------------------
// a) Frei verfuegbares Geld
// ---------------------------------------------------------------------------

export interface FreeCash {
  profit: number;
  ahv: number;
  tax: number;
  free: number;
  /** Steuersatz fehlt in den Einstellungen */
  taxMissing: boolean;
}

/**
 * Rueckstellungen auf den Gewinn: AHV/IV/EO als Satz des Gewinns, Steuern auf
 * (Gewinn - AHV), weil die AHV-Beitraege abzugsfaehig sind. Bei Verlust keine
 * Rueckstellung.
 */
export function freeCash(profit: number, ahvRate: number, taxRate: number | null): FreeCash {
  const base = Math.max(0, profit);
  const ahv = roundRappen((base * ahvRate) / 100);
  const tax = roundRappen(((base - ahv) * (taxRate ?? 0)) / 100);
  return { profit: roundRappen(profit), ahv, tax, free: roundRappen(profit - ahv - tax), taxMissing: taxRate === null };
}

// ---------------------------------------------------------------------------
// Wiederkehrende Ausgaben (Fixkosten, Liquiditaet)
// ---------------------------------------------------------------------------

export interface RecurringSeries {
  key: string;
  label: string;
  interval: Interval;
  lastDate: string;
  lastAmount: number;
  previousAmount: number | null;
  /** auf einen Monat umgerechnet */
  monthly: number;
  active: boolean;
  /** gegenueber der vorherigen Buchung um mehr als 10 % gestiegen */
  increased: boolean;
}

/**
 * Serienregel (Konzept 2.2 L): gleiche Gegenpartei (sonst Kategorie und Text)
 * und Markierung "wiederkehrend". Betrag = juengste Buchung. Beendet, wenn
 * zwei Intervalle lang keine Buchung kam.
 */
export function recurringSeries(entries: FinanceEntry[], today: string): RecurringSeries[] {
  const groups = new Map<string, FinanceEntry[]>();
  for (const e of entries) {
    if (e.type !== 'ausgabe' || !e.recurrence) continue;
    const key = (e.counterparty?.trim().toLowerCase() || `${e.category ?? ''}|${(e.description ?? '').trim().toLowerCase()}`) + `|${e.recurrence}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  const series: RecurringSeries[] = [];
  for (const [key, list] of groups) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    const last = list[list.length - 1];
    const prev = list.length > 1 ? list[list.length - 2] : null;
    const interval = last.recurrence!;
    const expiry = addMonths(last.date, MONTHS_PER[interval] * 2);
    series.push({
      key,
      label: last.counterparty || last.description || last.category || 'Ohne Bezeichnung',
      interval,
      lastDate: last.date,
      lastAmount: last.amount,
      previousAmount: prev?.amount ?? null,
      monthly: roundRappen(last.amount / MONTHS_PER[interval]),
      active: expiry >= today,
      increased: prev !== null && prev.amount > 0 && last.amount > prev.amount * 1.1,
    });
  }
  return series.sort((a, b) => b.monthly - a.monthly);
}

/** Erwartete Zahltage einer Serie im Zeitraum (from, to]. */
export function seriesDueDates(s: RecurringSeries, from: string, to: string): string[] {
  const dates: string[] = [];
  let next = addMonths(s.lastDate, MONTHS_PER[s.interval]);
  for (let i = 0; next <= to && i < 60; i++) {
    if (next > from) dates.push(next);
    next = addMonths(s.lastDate, MONTHS_PER[s.interval] * (i + 2));
  }
  return dates;
}

export function fixedCosts(series: RecurringSeries[]): { monthly: number; items: RecurringSeries[]; increased: RecurringSeries[] } {
  const active = series.filter((s) => s.active);
  return { monthly: sumRappen(active.map((s) => s.monthly)), items: active, increased: active.filter((s) => s.increased) };
}

// ---------------------------------------------------------------------------
// b) Liquiditaetsvorschau
// ---------------------------------------------------------------------------

export interface OpenInvoiceInput {
  total: number;
  due_date: string | null;
  status: string;
}

export interface LiquidityPoint {
  days: number;
  date: string;
  value: number;
  inflow: number;
  outflow: number;
  level: Level;
}

export interface Liquidity {
  start: { date: string; amount: number } | null;
  points: LiquidityPoint[];
  /** ueberfaellige Rechnungen: separat, nicht eingerechnet */
  overdue: number;
  /** offene Rechnungen ohne Faelligkeit: nicht eingerechnet */
  withoutDue: number;
}

/**
 * Ausgangspunkt letzter Kontostand; plus offene Rechnungen nach Faelligkeit
 * (ab heute), minus wiederkehrende Ausgaben nach Intervall. Ueberfaellige
 * zaehlen nicht automatisch als Eingang.
 */
export function liquidityForecast(
  balance: { date: string; amount: number } | null,
  openInvoices: OpenInvoiceInput[],
  series: RecurringSeries[],
  today: string,
  minReserve: number | null,
  horizons: number[] = [30, 60, 90]
): Liquidity {
  const open = openInvoices.filter((i) => i.status === 'versendet' || i.status === 'überfällig');
  const overdue = sumRappen(open.filter((i) => i.due_date && toDay(i.due_date) < today).map((i) => Number(i.total)));
  const withoutDue = sumRappen(open.filter((i) => !i.due_date).map((i) => Number(i.total)));
  if (!balance) return { start: null, points: [], overdue, withoutDue };

  const active = series.filter((s) => s.active);
  const points = horizons.map((days) => {
    const date = addDays(today, days);
    const inflow = sumRappen(open.filter((i) => i.due_date && toDay(i.due_date) >= today && toDay(i.due_date) <= date).map((i) => Number(i.total)));
    // Ausgaben ab dem Kontostand-Datum (danach gebuchte sind im Stand noch nicht enthalten)
    const outflow = sumRappen(active.flatMap((s) => seriesDueDates(s, balance.date, date).map(() => s.lastAmount)));
    const value = roundRappen(balance.amount + inflow - outflow);
    const level: Level = value < 0 ? 'negative' : minReserve !== null && value < minReserve ? 'warning' : 'ok';
    return { days, date, value, inflow, outflow, level };
  });
  return { start: balance, points, overdue, withoutDue };
}

// ---------------------------------------------------------------------------
// c) Abhaengigkeit von Kunden
// ---------------------------------------------------------------------------

export interface Concentration {
  total: number;
  top: { customerId: string | null; name: string; amount: number; share: number }[];
  level: Level;
}

/** Umsatzanteile pro Firma in den letzten 12 Monaten (Einnahmen der Aggregation). */
export function concentration(entries: FinanceEntry[], names: Map<string, string>, today: string, warn = 50, alert = 70): Concentration {
  const range = last12Months(today);
  const income = entries.filter((e) => e.type === 'einnahme' && e.date >= range.from && e.date <= range.to);
  const total = sumRappen(income.map((e) => e.amount));
  // Buchungen ohne Firma, deren Zahler wie eine Firma heisst, zaehlen zu dieser Firma
  const idByName = new Map([...names.entries()].map(([id, name]) => [name.trim().toLowerCase(), id]));
  const byCustomer = new Map<string, number>();
  for (const e of income) {
    const matched = !e.customerId && e.counterparty ? idByName.get(e.counterparty.trim().toLowerCase()) : undefined;
    const key = e.customerId ?? matched ?? `ohne:${e.counterparty ?? ''}`;
    byCustomer.set(key, (byCustomer.get(key) ?? 0) + e.amount);
  }
  const top = [...byCustomer.entries()]
    .map(([key, amount]) => {
      const id = key.startsWith('ohne:') ? null : key;
      return { customerId: id, name: id ? names.get(id) ?? 'Unbekannte Firma' : key.slice(5) || 'Ohne Firma', amount: roundRappen(amount), share: total > 0 ? (amount / total) * 100 : 0 };
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);
  const max = top[0]?.share ?? 0;
  return { total, top, level: max >= alert ? 'negative' : max >= warn ? 'warning' : 'ok' };
}

// ---------------------------------------------------------------------------
// d) Ziel gegen Ist
// ---------------------------------------------------------------------------

export interface TargetProgress {
  target: number;
  actual: number;
  percent: number;
  /** wo man zeitanteilig stehen muesste */
  expectedPercent: number;
  gap: number;
  /** noetiger Umsatz pro Monat fuer den Rest des Jahres (inkl. laufendem Monat) */
  neededPerMonth: number;
  monthsLeft: number;
}

export function targetProgress(target: number, actual: number, today: string): TargetProgress {
  const year = today.slice(0, 4);
  const dayOfYear = dayDiff(`${year}-01-01`, today) + 1;
  const daysInYear = dayDiff(`${year}-01-01`, `${Number(year) + 1}-01-01`);
  const monthsLeft = 12 - Number(today.slice(5, 7)) + 1;
  const gap = Math.max(0, roundRappen(target - actual));
  return {
    target,
    actual: roundRappen(actual),
    percent: target > 0 ? (actual / target) * 100 : 0,
    expectedPercent: (dayOfYear / daysInYear) * 100,
    gap,
    neededPerMonth: roundRappen(gap / monthsLeft),
    monthsLeft,
  };
}

// ---------------------------------------------------------------------------
// e) MWST-Schwelle
// ---------------------------------------------------------------------------

export interface VatThreshold {
  revenue: number;
  threshold: number;
  percent: number;
  level: Level;
}

/**
 * Vereinbarter Umsatz der letzten 12 Monate: Rechnungen nach Rechnungsdatum
 * (ohne Entwuerfe) plus Einnahmen-Buchungen ohne Rechnung.
 */
export function vatThreshold(
  invoices: { total: number; issue_date: string; status: string }[],
  entries: FinanceEntry[],
  threshold: number,
  today: string
): VatThreshold {
  const range = last12Months(today);
  const fromInvoices = invoices.filter((i) => i.status !== 'entwurf' && i.issue_date >= range.from && i.issue_date <= range.to).map((i) => Number(i.total));
  const fromBookings = entries.filter((e) => e.type === 'einnahme' && e.source === 'transaction' && e.date >= range.from && e.date <= range.to).map((e) => e.amount);
  const revenue = sumRappen([...fromInvoices, ...fromBookings]);
  const percent = threshold > 0 ? (revenue / threshold) * 100 : 0;
  return { revenue, threshold, percent, level: percent >= 100 ? 'negative' : percent >= 80 ? 'warning' : 'ok' };
}

// ---------------------------------------------------------------------------
// i) Zahlungsdauer (DSO)
// ---------------------------------------------------------------------------

export interface PaymentDuration {
  averageDays: number | null;
  count: number;
  /** Zahlungsdatum aus der Faelligkeit uebernommen oder fehlend: nicht gezaehlt */
  excluded: number;
  byCustomer: { customerId: string; name: string; averageDays: number; averageDelay: number; count: number; late: boolean }[];
}

export function paymentDuration(
  invoices: { customer_id: string; issue_date: string; due_date: string | null; paid_at: string | null; status: string; paid_at_source?: string | null }[],
  names: Map<string, string>,
  today: string
): PaymentDuration {
  const range = last12Months(today);
  const paid = invoices.filter((i) => i.status === 'bezahlt');
  const usable = paid.filter((i) => i.paid_at && i.paid_at_source !== 'faelligkeit' && toDay(i.paid_at) >= range.from && toDay(i.paid_at) <= range.to);
  const excluded = paid.filter((i) => !i.paid_at || i.paid_at_source === 'faelligkeit').length;
  const days = usable.map((i) => dayDiff(i.issue_date, toDay(i.paid_at!)));
  const per = new Map<string, { days: number[]; delays: number[] }>();
  for (const i of usable) {
    const d = dayDiff(i.issue_date, toDay(i.paid_at!));
    const delay = i.due_date ? dayDiff(toDay(i.due_date), toDay(i.paid_at!)) : 0;
    if (!per.has(i.customer_id)) per.set(i.customer_id, { days: [], delays: [] });
    per.get(i.customer_id)!.days.push(d);
    per.get(i.customer_id)!.delays.push(delay);
  }
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  return {
    averageDays: days.length ? Math.round(avg(days)) : null,
    count: usable.length,
    excluded,
    byCustomer: [...per.entries()]
      .map(([customerId, v]) => {
        const averageDelay = Math.round(avg(v.delays));
        return { customerId, name: names.get(customerId) ?? 'Unbekannte Firma', averageDays: Math.round(avg(v.days)), averageDelay, count: v.days.length, late: averageDelay > 10 };
      })
      .sort((a, b) => b.averageDelay - a.averageDelay),
  };
}

// ---------------------------------------------------------------------------
// f) Auslastung und effektiver Stundensatz
// ---------------------------------------------------------------------------

export interface Utilization {
  weekHours: number;
  monthHours: number;
  weekTarget: number | null;
  monthTarget: number | null;
  /** Umsatz aus Zeiten / alle erfassten Stunden (inkl. nicht verrechenbare), laufendes Jahr */
  effectiveRate: number | null;
  nominalRate: number;
}

export function utilization(
  entries: { date: string; hours: number; rate: number; billable: boolean }[],
  today: string,
  weeklyTarget: number | null,
  nominalRate: number
): Utilization {
  const weekFrom = addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const monthFrom = `${today.slice(0, 7)}-01`;
  const sum = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) * 100) / 100;
  const billableIn = (from: string) => sum(entries.filter((e) => e.billable && e.date >= from && e.date <= today).map((e) => Number(e.hours)));
  const year = entries.filter((e) => e.date.startsWith(today.slice(0, 4)) && e.date <= today);
  const hours = sum(year.map((e) => Number(e.hours)));
  const revenue = sumRappen(year.filter((e) => e.billable).map((e) => Number(e.hours) * Number(e.rate)));
  const [y, m] = today.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    weekHours: billableIn(weekFrom),
    monthHours: billableIn(monthFrom),
    weekTarget: weeklyTarget,
    monthTarget: weeklyTarget !== null ? Math.round(((weeklyTarget * daysInMonth) / 7) * 10) / 10 : null,
    effectiveRate: hours > 0 ? roundRappen(revenue / hours) : null,
    nominalRate,
  };
}

// ---------------------------------------------------------------------------
// g) Wiederkehrender Umsatz
// ---------------------------------------------------------------------------

export function recurringRevenue(
  invoices: { total: number; issue_date: string; status: string; is_recurring_revenue?: boolean | null }[],
  today: string
): { total: number; recurring: number; share: number; mrr: number } {
  const range = last12Months(today);
  const inRange = invoices.filter((i) => i.status !== 'entwurf' && i.issue_date >= range.from && i.issue_date <= range.to);
  const total = sumRappen(inRange.map((i) => Number(i.total)));
  const recurring = sumRappen(inRange.filter((i) => i.is_recurring_revenue).map((i) => Number(i.total)));
  return { total, recurring, share: total > 0 ? (recurring / total) * 100 : 0, mrr: roundRappen(recurring / 12) };
}

// ---------------------------------------------------------------------------
// k) Akquise
// ---------------------------------------------------------------------------

export interface Acquisition {
  months: { key: string; label: string; leads: number; deals: number }[];
  newDealsThisMonth: number;
  /** Anteil der Interessenten, die zum Deal wurden */
  leadToDeal: number | null;
  /** gewonnene von abgeschlossenen Deals */
  dealToWon: number | null;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export function acquisition(
  opportunities: { kind?: string | null; created_at: string; source?: string | null; is_lost: boolean; won?: boolean }[],
  today: string
): Acquisition {
  const months = Array.from({ length: 6 }, (_, i) => {
    const key = addMonths(`${today.slice(0, 7)}-01`, i - 5).slice(0, 7);
    return { key, label: MONTH_LABELS[Number(key.slice(5, 7)) - 1], leads: 0, deals: 0 };
  });
  for (const o of opportunities) {
    const m = months.find((x) => x.key === toDay(o.created_at).slice(0, 7));
    if (!m) continue;
    if (o.kind === 'lead') m.leads++;
    else m.deals++;
  }
  const leads = opportunities.filter((o) => o.kind === 'lead').length;
  const fromLeads = opportunities.filter((o) => o.kind !== 'lead' && o.source).length;
  const won = opportunities.filter((o) => o.won).length;
  const lost = opportunities.filter((o) => o.kind !== 'lead' && o.is_lost).length;
  return {
    months,
    newDealsThisMonth: months[5].deals,
    leadToDeal: leads + fromLeads > 0 ? (fromLeads / (leads + fromLeads)) * 100 : null,
    dealToWon: won + lost > 0 ? (won / (won + lost)) * 100 : null,
  };
}

// ---------------------------------------------------------------------------
// Kennzahlen und Verlauf
// ---------------------------------------------------------------------------

/** Einnahmen dieses Jahr bis heute und Vorjahr bis zum gleichen Tag. */
export function incomeYearOverYear(entries: FinanceEntry[], today: string): { current: number; previous: number; change: number | null } {
  const y = Number(today.slice(0, 4));
  const sameDayLastYear = `${y - 1}${today.slice(4)}` === `${y - 1}-02-29` ? `${y - 1}-02-28` : `${y - 1}${today.slice(4)}`;
  const sum = (from: string, to: string) => sumRappen(entries.filter((e) => e.type === 'einnahme' && e.date >= from && e.date <= to).map((e) => e.amount));
  const current = sum(`${y}-01-01`, today);
  const previous = sum(`${y - 1}-01-01`, sameDayLastYear);
  return { current, previous, change: previous > 0 ? ((current - previous) / previous) * 100 : null };
}
