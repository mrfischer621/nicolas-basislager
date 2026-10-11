import type { TimeEntryWithStatus } from '../lib/supabase';
import { addDays, isoWeek, weekStart } from './financeAggregation';
import { roundRappen, sumRappen } from './money';

/**
 * Zeiterfassung: Ansichten, Verrechnungsstatus, Gruppen mit Zwischensummen
 * und die Uebernahme ausgewaehlter Zeiten in einen Rechnungsentwurf.
 */

export type TimeView = 'offen' | 'woche' | 'monat' | 'verrechnet' | 'alle';
export type TimeGrouping = 'woche' | 'firma' | 'projekt';

export const TIME_VIEWS: { value: TimeView; label: string }[] = [
  { value: 'offen', label: 'Nicht verrechnet' },
  { value: 'woche', label: 'Diese Woche' },
  { value: 'monat', label: 'Dieser Monat' },
  { value: 'verrechnet', label: 'Verrechnet' },
  { value: 'alle', label: 'Alle' },
];

export type TimeRow = Pick<
  TimeEntryWithStatus,
  'id' | 'project_id' | 'date' | 'hours' | 'rate' | 'billable' | 'invoice_id' | 'manual_status' | 'description'
> &
  Partial<Pick<TimeEntryWithStatus, 'invoice_number' | 'invoice_status' | 'snapshot_source'>> & {
    customerId?: string | null;
    customerName?: string;
    projectName?: string;
  };

/** Nicht verrechnet = verrechenbar, auf keiner Rechnung, nicht von Hand erledigt. */
export function isUnbilled(e: Pick<TimeRow, 'billable' | 'invoice_id' | 'manual_status'>): boolean {
  return e.billable && !e.invoice_id && (e.manual_status === null || e.manual_status === 'offen');
}

/** Verrechnet = auf einer Rechnung oder von Hand als verrechnet/bezahlt markiert. */
export function isBilled(e: Pick<TimeRow, 'invoice_id' | 'manual_status'>): boolean {
  return !!e.invoice_id || e.manual_status === 'verrechnet' || e.manual_status === 'bezahlt';
}

export function viewRange(view: TimeView, today: string): { from?: string } {
  if (view === 'woche') return { from: weekStart(today) };
  if (view === 'monat') return { from: `${today.slice(0, 7)}-01` };
  return {};
}

export function matchesView(e: TimeRow, view: TimeView, today: string): boolean {
  switch (view) {
    case 'offen':
      return isUnbilled(e);
    case 'verrechnet':
      return isBilled(e);
    case 'woche':
    case 'monat':
      return e.date >= viewRange(view, today).from! && e.date <= today;
    default:
      return true;
  }
}

/** Verrechnungsstatus als Wort, getrennt von "verrechenbar". */
export type BillingState = 'offen' | 'nicht_verrechenbar' | 'entwurf' | 'versendet' | 'bezahlt' | 'manuell_verrechnet' | 'manuell_bezahlt';

export function billingState(e: TimeRow): BillingState {
  if (e.manual_status === 'bezahlt') return 'manuell_bezahlt';
  if (e.manual_status === 'verrechnet') return 'manuell_verrechnet';
  if (e.invoice_id) {
    if (e.invoice_status === 'bezahlt') return 'bezahlt';
    if (e.invoice_status === 'entwurf') return 'entwurf';
    return 'versendet';
  }
  return e.billable ? 'offen' : 'nicht_verrechenbar';
}

export const BILLING_LABEL: Record<BillingState, string> = {
  offen: 'offen',
  nicht_verrechenbar: '–',
  entwurf: 'auf Entwurf',
  versendet: 'auf Rechnung',
  bezahlt: 'bezahlt',
  manuell_verrechnet: 'verrechnet (manuell)',
  manuell_bezahlt: 'bezahlt (manuell)',
};

export const BILLING_BADGE: Record<BillingState, string> = {
  offen: 'badge-attention',
  nicht_verrechenbar: 'text-fg-muted',
  entwurf: 'badge-neutral',
  versendet: 'badge-info',
  bezahlt: 'badge-positive',
  manuell_verrechnet: 'badge-neutral',
  manuell_bezahlt: 'badge-positive',
};

export function amount(e: Pick<TimeRow, 'hours' | 'rate'>): number {
  return roundRappen(Number(e.hours) * Number(e.rate));
}

export interface TimeTotals {
  hours: number;
  billableHours: number;
  amount: number;
  count: number;
}

export function totals(rows: TimeRow[]): TimeTotals {
  return {
    hours: Math.round(rows.reduce((s, e) => s + Number(e.hours), 0) * 100) / 100,
    billableHours: Math.round(rows.filter((e) => e.billable).reduce((s, e) => s + Number(e.hours), 0) * 100) / 100,
    amount: sumRappen(rows.filter((e) => e.billable).map(amount)),
    count: rows.length,
  };
}

export interface TimeGroup {
  key: string;
  label: string;
  rows: TimeRow[];
  totals: TimeTotals;
}

/** Gruppen absteigend (Woche: neueste zuerst, Firma/Projekt: nach Name). */
export function groupTimeEntries(rows: TimeRow[], by: TimeGrouping): TimeGroup[] {
  const map = new Map<string, { label: string; rows: TimeRow[]; sort: string }>();
  for (const e of rows) {
    let key: string;
    let label: string;
    let sort: string;
    if (by === 'woche') {
      const start = weekStart(e.date);
      key = start;
      label = `KW ${isoWeek(e.date)}, ${formatShort(start)} – ${formatShort(addDays(start, 6))}`;
      sort = start;
    } else if (by === 'firma') {
      key = e.customerId ?? 'ohne';
      label = e.customerName ?? 'Ohne Firma';
      sort = label.toLowerCase();
    } else {
      key = e.project_id;
      label = e.projectName ? `${e.projectName}${e.customerName ? ` · ${e.customerName}` : ''}` : 'Ohne Projekt';
      sort = label.toLowerCase();
    }
    if (!map.has(key)) map.set(key, { label, rows: [], sort });
    map.get(key)!.rows.push(e);
  }
  const groups = [...map.entries()].map(([key, g]) => ({ key, label: g.label, rows: g.rows, totals: totals(g.rows), sort: g.sort }));
  groups.sort((a, b) => (by === 'woche' ? b.sort.localeCompare(a.sort) : a.sort.localeCompare(b.sort, 'de')));
  return groups.map(({ sort: _sort, ...g }) => {
    void _sort;
    return g;
  });
}

function formatShort(day: string): string {
  return `${day.slice(8, 10)}.${day.slice(5, 7)}.`;
}

// ---------------------------------------------------------------------------
// Rechnung aus Zeiten
// ---------------------------------------------------------------------------

export interface InvoicePreset {
  customerId: string;
  projectId: string | null;
  items: { description: string; quantity: number; unit_price: number; timeEntryIds: string[] }[];
  hours: number;
  amount: number;
}

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/**
 * Baut aus ausgewaehlten Zeiten einen Rechnungsentwurf. Erlaubt sind nur
 * nicht verrechnete Zeiten einer einzigen Firma. Gebuendelt wird wie beim
 * bisherigen Import: eine Position pro Woche und Projekt (und Satz), Satz aus
 * der Erfassung (Snapshot), nicht neu vom Projekt.
 */
export function buildInvoicePreset(rows: TimeRow[]): { ok: true; preset: InvoicePreset } | { ok: false; reason: string } {
  if (rows.length === 0) return { ok: false, reason: 'Keine Zeiten ausgewählt.' };
  if (rows.some((e) => !isUnbilled(e))) return { ok: false, reason: 'Nur nicht verrechnete, verrechenbare Zeiten lassen sich übernehmen.' };
  const customers = new Set(rows.map((e) => e.customerId ?? ''));
  if (customers.size > 1 || customers.has('')) return { ok: false, reason: 'Wähle Zeiten einer einzigen Firma.' };

  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const groups = new Map<string, TimeRow[]>();
  for (const e of sorted) {
    if (Number(e.hours) <= 0) continue;
    const key = `${weekStart(e.date)}|${e.project_id}|${Number(e.rate)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  const items = [...groups.values()].map((entries) => {
    const first = entries[0];
    const month = MONTHS[Number(first.date.slice(5, 7)) - 1];
    const heading = `<strong>KW ${isoWeek(first.date)} (${month} ${first.date.slice(0, 4)})${first.projectName ? `, ${escapeHtml(first.projectName)}` : ''}</strong>`;
    const lines = entries.map((e) => {
      const date = formatShort(e.date);
      const h = `${Number(e.hours).toFixed(2)} h`;
      const desc = e.description?.trim();
      return desc ? `${date} ${escapeHtml(desc)} (${h})` : `${date} (${h})`;
    });
    const quantity = Math.round(entries.reduce((s, e) => s + Number(e.hours), 0) * 100) / 100;
    return { description: `${heading}<br>${lines.join('<br>')}`, quantity, unit_price: Number(first.rate), timeEntryIds: entries.map((e) => e.id) };
  });

  const projects = new Set(rows.map((e) => e.project_id));
  const t = totals(rows);
  return {
    ok: true,
    preset: { customerId: [...customers][0], projectId: projects.size === 1 ? [...projects][0] : null, items, hours: t.hours, amount: t.amount },
  };
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
