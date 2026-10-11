/**
 * Zentrale Finanz-Aggregation (Milchbüechli, Zahlungsprinzip).
 *
 * Vorher rechneten Dashboard, Auswertung (zwei Modi), Buchungsliste und
 * Jahresabschluss je auf eigenem Weg - mit drei verschiedenen Fehlern:
 * Auswertung "Charts" und Jahresabschluss lasen die Ausgaben aus der leeren
 * Tabelle `expenses`, das Dashboard ordnete Buchungen Wochen zu, die es nie
 * angelegt hatte. Alle Stellen nutzen jetzt diese reinen Funktionen.
 *
 * Definition (bestaetigt am 11.10.2026):
 *   Einnahmen = bezahlte Rechnungen nach Zahlungsdatum (paid_at)
 *             + Buchungen vom Typ 'einnahme' ohne invoice_id
 *   Ausgaben  = Buchungen vom Typ 'ausgabe'
 * Bezahlte Rechnungen OHNE paid_at werden nicht geraten (kein Rueckfall auf
 * das Rechnungsdatum), sondern ausgeschlossen und separat gemeldet.
 *
 * Alle Datumswerte sind lokale Kalendertage 'YYYY-MM-DD' (Europe/Zurich).
 * Vergleiche laufen als String, nie ueber Date-Objekte oder toISOString()
 * (UTC-Verschiebung um Mitternacht).
 */
import { roundRappen } from './money';

export type EntryType = 'einnahme' | 'ausgabe';
export type Granularity = 'day' | 'week' | 'month';

/** Kategorie, unter der bezahlte Rechnungen erscheinen. */
export const INVOICE_CATEGORY = 'Rechnungen';

export interface FinanceInvoiceInput {
  id: string;
  invoice_number: string;
  status: string;
  total: number | string | null;
  issue_date: string;
  paid_at: string | null;
  customer_id: string | null;
  project_id?: string | null;
  created_at?: string;
  customers?: { name?: string | null } | null;
}

export interface FinanceTransactionInput {
  id: string;
  type: EntryType;
  date: string;
  amount: number | string | null;
  category: string | null;
  description: string | null;
  counterparty?: string | null;
  customer_id: string | null;
  project_id?: string | null;
  invoice_id: string | null;
  receipt_url?: string | null;
  tags?: string[] | null;
  transaction_number: string | null;
  created_at?: string;
  /** Wiederkehrende Ausgabe (Migration 20261011170000) */
  is_recurring?: boolean | null;
  recurrence_interval?: 'monatlich' | 'quartalsweise' | 'jaehrlich' | null;
}

export interface FinanceEntry {
  id: string;
  source: 'invoice' | 'transaction';
  sourceId: string;
  type: EntryType;
  date: string; // YYYY-MM-DD
  amount: number;
  category: string | null;
  counterparty: string | null;
  description: string | null;
  customerId: string | null;
  projectId: string | null;
  invoiceId: string | null;
  receiptUrl: string | null;
  tags: string[];
  number: string | null;
  /** Intervall einer als wiederkehrend markierten Buchung, sonst null */
  recurrence: 'monatlich' | 'quartalsweise' | 'jaehrlich' | null;
}

export interface FinanceEntriesResult {
  entries: FinanceEntry[];
  /** Bezahlte Rechnungen ohne Zahlungsdatum: nicht gezaehlt, bitte nachtragen. */
  paidWithoutDate: FinanceInvoiceInput[];
}

// ── Datum ────────────────────────────────────────────────────────────────

const ZURICH_DAY = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Zurich',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Kalendertag in Zuerich fuer ein Date-Objekt. */
export function zurichDay(date: Date): string {
  return ZURICH_DAY.format(date);
}

/**
 * Normalisiert DB-Werte auf 'YYYY-MM-DD': `date`-Spalten kommen bereits so,
 * `timestamptz` (paid_at) wird in Zuercher Zeit umgerechnet.
 */
export function toDay(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : zurichDay(parsed);
}

/**
 * Kalendertag als Zeitstempel fuer paid_at (timestamptz). 12:00 UTC liegt in
 * Zuerich das ganze Jahr am selben Kalendertag (13:00 bzw. 14:00 Uhr).
 */
export function paidDateToTimestamp(day: string): string {
  return `${day}T12:00:00Z`;
}

/** Tage auf einen Kalendertag addieren (rein kalendarisch, ohne Zeitzone). */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

function weekday(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sonntag
}

/** Montag der Woche (ISO), in der der Tag liegt. */
export function weekStart(day: string): string {
  const offset = (weekday(day) + 6) % 7;
  return addDays(day, -offset);
}

/** ISO-Kalenderwoche. */
export function isoWeek(day: string): number {
  const thursday = addDays(weekStart(day), 3);
  const yearStart = `${thursday.slice(0, 4)}-01-01`;
  const [y, m, d] = thursday.split('-').map(Number);
  const [ys, ms, ds] = yearStart.split('-').map(Number);
  const diff = (Date.UTC(y, m - 1, d) - Date.UTC(ys, ms - 1, ds)) / 86_400_000;
  return Math.floor(diff / 7) + 1;
}

export interface DayRange {
  from: string;
  to: string;
}

export type RangePreset =
  | 'current_month'
  | 'last_month'
  | 'current_year'
  | 'last_year'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'last_365_days';

/** Vordefinierte Zeitraeume relativ zu `today` (inklusive heute). */
export function presetRange(preset: RangePreset, today: string = zurichDay(new Date())): DayRange {
  const year = Number(today.slice(0, 4));
  const month = today.slice(0, 7);
  switch (preset) {
    case 'current_month':
      return { from: `${month}-01`, to: today };
    case 'last_month': {
      const lastDayPrev = addDays(`${month}-01`, -1);
      return { from: `${lastDayPrev.slice(0, 7)}-01`, to: lastDayPrev };
    }
    case 'current_year':
      return { from: `${year}-01-01`, to: today };
    case 'last_year':
      return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` };
    case 'last_7_days':
      return { from: addDays(today, -6), to: today };
    case 'last_30_days':
      return { from: addDays(today, -29), to: today };
    case 'last_90_days':
      return { from: addDays(today, -89), to: today };
    case 'last_365_days':
      return { from: addDays(today, -364), to: today };
  }
}

export function yearRange(year: number): DayRange {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

// ── Eintraege bilden ───────────────────────────────────────────────────────

function toAmount(value: number | string | null | undefined): number {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  return Number.isFinite(n) ? roundRappen(n as number) : 0;
}

/**
 * Fuehrt Rechnungen und Buchungen zu einer einheitlichen Liste zusammen.
 * Einnahmen-Buchungen mit invoice_id werden uebersprungen (die Rechnung
 * zaehlt bereits), damit nichts doppelt erscheint.
 */
export function buildFinanceEntries(
  invoices: FinanceInvoiceInput[],
  transactions: FinanceTransactionInput[]
): FinanceEntriesResult {
  const entries: FinanceEntry[] = [];
  const paidWithoutDate: FinanceInvoiceInput[] = [];

  for (const inv of invoices) {
    if (inv.status !== 'bezahlt') continue;
    if (!inv.paid_at) {
      paidWithoutDate.push(inv);
      continue;
    }
    const customerName = inv.customers?.name ?? null;
    entries.push({
      id: `invoice-${inv.id}`,
      source: 'invoice',
      sourceId: inv.id,
      type: 'einnahme',
      date: toDay(inv.paid_at),
      amount: toAmount(inv.total),
      category: INVOICE_CATEGORY,
      counterparty: customerName,
      description: `Rechnung ${inv.invoice_number}${customerName ? ` - ${customerName}` : ''}`,
      customerId: inv.customer_id,
      projectId: inv.project_id ?? null,
      invoiceId: inv.id,
      receiptUrl: null,
      tags: [],
      number: inv.invoice_number,
      recurrence: null,
    });
  }

  for (const t of transactions) {
    if (t.type === 'einnahme' && t.invoice_id) continue;
    entries.push({
      id: t.id,
      source: 'transaction',
      sourceId: t.id,
      type: t.type,
      date: toDay(t.date),
      amount: toAmount(t.amount),
      category: t.category && t.category.trim() !== '' ? t.category : null,
      counterparty: t.counterparty && t.counterparty.trim() !== '' ? t.counterparty : null,
      description: t.description,
      customerId: t.customer_id,
      projectId: t.project_id ?? null,
      invoiceId: t.invoice_id,
      receiptUrl: t.receipt_url ?? null,
      tags: t.tags ?? [],
      number: t.transaction_number,
      recurrence: t.is_recurring ? t.recurrence_interval ?? 'monatlich' : null,
    });
  }

  entries.sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)));
  return { entries, paidWithoutDate };
}

export function filterRange(entries: FinanceEntry[], range: DayRange): FinanceEntry[] {
  return entries.filter((e) => e.date >= range.from && e.date <= range.to);
}

// ── Summen ───────────────────────────────────────────────────────────────

export interface FinanceTotals {
  income: number;
  expense: number;
  profit: number;
  count: number;
}

/** Summen in Rappen (Ganzzahlen), damit sich keine Gleitkommafehler aufsummieren. */
export function summarize(entries: FinanceEntry[]): FinanceTotals {
  let income = 0;
  let expense = 0;
  for (const e of entries) {
    const rappen = Math.round(e.amount * 100);
    if (e.type === 'einnahme') income += rappen;
    else expense += rappen;
  }
  return {
    income: income / 100,
    expense: expense / 100,
    profit: (income - expense) / 100,
    count: entries.length,
  };
}

// ── Zeitverlauf ──────────────────────────────────────────────────────────

export interface TimelinePoint {
  key: string; // Tag, Montag der Woche oder 'YYYY-MM'
  label: string;
  income: number;
  expense: number;
  profit: number;
  cumulativeProfit: number;
}

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function bucketKey(day: string, granularity: Granularity): string {
  if (granularity === 'month') return day.slice(0, 7);
  if (granularity === 'week') return weekStart(day);
  return day;
}

function bucketLabel(key: string, granularity: Granularity): string {
  if (granularity === 'month') return `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`;
  if (granularity === 'week') return `KW ${isoWeek(key)}`;
  return `${key.slice(8, 10)}.${key.slice(5, 7)}.`;
}

function nextBucket(key: string, granularity: Granularity): string {
  if (granularity === 'day') return addDays(key, 1);
  if (granularity === 'week') return addDays(key, 7);
  const [y, m] = key.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** Feinste sinnvolle Aufloesung fuer einen Zeitraum. */
export function defaultGranularity(range: DayRange): Granularity {
  const [y1, m1, d1] = range.from.split('-').map(Number);
  const [y2, m2, d2] = range.to.split('-').map(Number);
  const days = (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000 + 1;
  if (days <= 31) return 'day';
  if (days <= 120) return 'week';
  return 'month';
}

/**
 * Zeitverlauf mit lueckenlosen Perioden ueber den ganzen Zeitraum (auch leere
 * Perioden erscheinen mit 0). Erwartet bereits gefilterte Eintraege.
 */
export function buildTimeline(
  entries: FinanceEntry[],
  range: DayRange,
  granularity: Granularity
): TimelinePoint[] {
  const buckets = new Map<string, { income: number; expense: number }>();
  const last = bucketKey(range.to, granularity);
  for (let key = bucketKey(range.from, granularity); key <= last; key = nextBucket(key, granularity)) {
    buckets.set(key, { income: 0, expense: 0 });
  }

  for (const e of entries) {
    if (e.date < range.from || e.date > range.to) continue;
    const bucket = buckets.get(bucketKey(e.date, granularity));
    if (!bucket) continue;
    const rappen = Math.round(e.amount * 100);
    if (e.type === 'einnahme') bucket.income += rappen;
    else bucket.expense += rappen;
  }

  let cumulative = 0;
  return Array.from(buckets.entries()).map(([key, b]) => {
    cumulative += b.income - b.expense;
    return {
      key,
      label: bucketLabel(key, granularity),
      income: b.income / 100,
      expense: b.expense / 100,
      profit: (b.income - b.expense) / 100,
      cumulativeProfit: cumulative / 100,
    };
  });
}

// ── Gruppierungen ────────────────────────────────────────────────────────

export interface GroupTotal {
  key: string;
  type: EntryType;
  amount: number;
  count: number;
}

export const NO_CATEGORY = 'Ohne Kategorie';

/** Summe pro Schluessel und Typ, absteigend nach Betrag. */
export function groupBy(
  entries: FinanceEntry[],
  keyOf: (e: FinanceEntry) => string | null
): GroupTotal[] {
  const map = new Map<string, GroupTotal & { rappen: number }>();
  for (const e of entries) {
    const key = keyOf(e);
    if (key === null) continue;
    const id = `${e.type}|${key}`;
    const g = map.get(id) ?? { key, type: e.type, amount: 0, count: 0, rappen: 0 };
    g.rappen += Math.round(e.amount * 100);
    g.count += 1;
    map.set(id, g);
  }
  return Array.from(map.values())
    .map(({ rappen, ...g }) => ({ ...g, amount: rappen / 100 }))
    .sort((a, b) => b.amount - a.amount || a.key.localeCompare(b.key));
}

export const byCategory = (entries: FinanceEntry[]) =>
  groupBy(entries, (e) => e.category ?? NO_CATEGORY);

export const byCounterparty = (entries: FinanceEntry[]) =>
  groupBy(entries, (e) => e.counterparty);

export function byTag(entries: FinanceEntry[]): GroupTotal[] {
  const exploded: FinanceEntry[] = [];
  for (const e of entries) for (const tag of e.tags) exploded.push({ ...e, category: tag });
  return groupBy(exploded, (e) => e.category);
}
