import type { Invoice, PaidAtSource } from '../lib/supabase';
import { addDays, paidDateToTimestamp, toDay } from './financeAggregation';
import { sumRappen } from './money';

/**
 * Ansichten der Rechnungsliste. "Ueberfaellig" wird abgeleitet (versendet und
 * Faelligkeit vor heute), nicht von Hand gesetzt. Der alte gespeicherte Wert
 * 'überfällig' zaehlt wie 'versendet' (Konzept 2.2 I).
 */
export type InvoiceView = 'alle' | 'entwurf' | 'versendet' | 'ueberfaellig' | 'bezahlt';
export type InvoiceState = Exclude<InvoiceView, 'alle'>;

export const INVOICE_VIEWS: { value: InvoiceView; label: string }[] = [
  { value: 'alle', label: 'Alle' },
  { value: 'entwurf', label: 'Entwurf' },
  { value: 'versendet', label: 'Versendet' },
  { value: 'ueberfaellig', label: 'Überfällig' },
  { value: 'bezahlt', label: 'Bezahlt' },
];

export const INVOICE_STATE_LABEL: Record<InvoiceState, string> = {
  entwurf: 'Entwurf',
  versendet: 'Versendet',
  ueberfaellig: 'Überfällig',
  bezahlt: 'Bezahlt',
};

export const INVOICE_STATE_BADGE: Record<InvoiceState, string> = {
  entwurf: 'badge-neutral',
  versendet: 'badge-info',
  ueberfaellig: 'badge-negative',
  bezahlt: 'badge-positive',
};

type InvoiceLike = Pick<Invoice, 'status' | 'due_date'>;

export function isOpenStatus(status: Invoice['status']): boolean {
  return status === 'versendet' || status === 'überfällig';
}

export function invoiceState(invoice: InvoiceLike, today: string): InvoiceState {
  if (invoice.status === 'bezahlt') return 'bezahlt';
  if (invoice.status === 'entwurf') return 'entwurf';
  if (invoice.due_date && toDay(invoice.due_date) < today) return 'ueberfaellig';
  return 'versendet';
}

/** Tage bis zur Faelligkeit (negativ = ueberfaellig), null ohne Datum. */
export function daysUntilDue(dueDate: string | null, today: string): number | null {
  if (!dueDate) return null;
  const a = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const d = toDay(dueDate);
  const b = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export type InvoiceSummaryRow = Pick<Invoice, 'id' | 'status' | 'total' | 'due_date' | 'issue_date' | 'paid_at' | 'customer_id' | 'invoice_number'> & {
  paid_at_source?: PaidAtSource | null;
};

export interface InvoiceSummary {
  counts: Record<InvoiceView, number>;
  sums: Record<InvoiceView, number>;
  /** bezahlt mit Zahlungsdatum im Jahr von `today` */
  paidThisYear: number;
  /** bezahlt ohne Zahlungsdatum */
  missingPaidDate: InvoiceSummaryRow[];
}

export function summarizeInvoices(rows: InvoiceSummaryRow[], today: string): InvoiceSummary {
  const counts: Record<InvoiceView, number> = { alle: 0, entwurf: 0, versendet: 0, ueberfaellig: 0, bezahlt: 0 };
  const parts: Record<InvoiceView, number[]> = { alle: [], entwurf: [], versendet: [], ueberfaellig: [], bezahlt: [] };
  const year = today.slice(0, 4);
  const paidYear: number[] = [];
  const missingPaidDate: InvoiceSummaryRow[] = [];
  for (const r of rows) {
    const state = invoiceState(r, today);
    const total = Number(r.total ?? 0);
    counts.alle++;
    parts.alle.push(total);
    counts[state]++;
    parts[state].push(total);
    if (state === 'bezahlt') {
      if (!r.paid_at) missingPaidDate.push(r);
      else if (toDay(r.paid_at).startsWith(year)) paidYear.push(total);
    }
  }
  const sums = Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, sumRappen(v)])) as Record<InvoiceView, number>;
  return { counts, sums, paidThisYear: sumRappen(paidYear), missingPaidDate };
}

/**
 * Filter einer Ansicht fuer die Datenbankabfrage (PostgREST). Liefert die
 * Bedingungen als Liste, damit die Abfrage sie anwenden kann.
 */
export function viewFilter(view: InvoiceView, today: string): { status?: string[]; dueBefore?: string; dueFromOrNull?: string } {
  switch (view) {
    case 'entwurf':
      return { status: ['entwurf'] };
    case 'bezahlt':
      return { status: ['bezahlt'] };
    case 'ueberfaellig':
      return { status: ['versendet', 'überfällig'], dueBefore: today };
    case 'versendet':
      return { status: ['versendet', 'überfällig'], dueFromOrNull: today };
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// Sammeldialog "Zahlungsdaten nachtragen"
// ---------------------------------------------------------------------------

export interface PaidDateDraft {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  /** 'YYYY-MM-DD' oder leer = nicht speichern */
  day: string;
  source: PaidAtSource;
}

/** Leere Entwuerfe: kein Datum vorbelegt (Konzept 2.2 H). */
export function initialDrafts(rows: InvoiceSummaryRow[]): PaidDateDraft[] {
  return rows.map((r) => ({
    id: r.id,
    invoice_number: r.invoice_number,
    issue_date: r.issue_date,
    due_date: r.due_date,
    day: '',
    source: 'erfasst',
  }));
}

/** Faelligkeitsdatum bewusst uebernehmen (alle oder eine Zeile). */
export function applyDueDate(drafts: PaidDateDraft[], ids?: string[]): PaidDateDraft[] {
  return drafts.map((d) =>
    (!ids || ids.includes(d.id)) && d.due_date ? { ...d, day: toDay(d.due_date), source: 'faelligkeit' } : d
  );
}

/** Von Hand geaendertes Datum gilt als erfasst. */
export function setDraftDay(drafts: PaidDateDraft[], id: string, day: string): PaidDateDraft[] {
  return drafts.map((d) => (d.id === id ? { ...d, day, source: 'erfasst' } : d));
}

export function draftError(d: PaidDateDraft, today: string): string | null {
  if (!d.day) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.day)) return 'Datum ungültig';
  if (d.day > today) return 'Liegt in der Zukunft';
  if (d.day < toDay(d.issue_date)) return 'Vor dem Rechnungsdatum';
  return null;
}

/** Nur ausgefuellte und gueltige Zeilen werden gespeichert. */
export function draftUpdates(drafts: PaidDateDraft[], today: string): { id: string; paid_at: string; paid_at_source: PaidAtSource }[] {
  return drafts
    .filter((d) => d.day && !draftError(d, today))
    .map((d) => ({ id: d.id, paid_at: paidDateToTimestamp(d.day), paid_at_source: d.source }));
}

/** Kurzer Satz unter der Liste, z.B. fuer den Untertitel. */
export function invoiceSummarySentence(s: InvoiceSummary): string {
  const open = s.counts.versendet + s.counts.ueberfaellig;
  if (open === 0 && s.counts.entwurf === 0) return 'Keine offenen Rechnungen.';
  const parts: string[] = [];
  if (open > 0) parts.push(`${open} ${open === 1 ? 'offene Rechnung' : 'offene Rechnungen'}`);
  if (s.counts.ueberfaellig > 0) parts.push(`CHF ${formatInt(s.sums.ueberfaellig)} überfällig`);
  if (s.counts.entwurf > 0) parts.push(`${s.counts.entwurf} ${s.counts.entwurf === 1 ? 'Entwurf' : 'Entwürfe'}`);
  return `${parts.join(', ')}.`;
}

function formatInt(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

/** Faelligkeit fuer neue Rechnungen aus der Zahlungsfrist. */
export function dueFromTerms(issueDate: string, days: number): string {
  return addDays(issueDate, days);
}
