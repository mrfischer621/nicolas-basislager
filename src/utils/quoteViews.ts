import type { Quote } from '../lib/supabase';
import { addDays, toDay } from './financeAggregation';
import { sumRappen } from './money';

/**
 * Ansichten der Offerten. Gespeicherte Werte bleiben, nur die Beschriftung
 * aendert: offen = Entwurf, bestaetigt = umgewandelt. "Abgelaufen" wird
 * abgeleitet (versendet und Gueltigkeit vorbei); der alte Wert 'ueberfallig'
 * zaehlt ebenfalls als abgelaufen.
 */
export type QuoteState = 'entwurf' | 'versendet' | 'akzeptiert' | 'abgelehnt' | 'abgelaufen' | 'umgewandelt';
export type QuoteView = QuoteState | 'alle';

export const QUOTE_VIEWS: { value: QuoteView; label: string }[] = [
  { value: 'alle', label: 'Alle' },
  { value: 'entwurf', label: 'Entwurf' },
  { value: 'versendet', label: 'Versendet' },
  { value: 'akzeptiert', label: 'Akzeptiert' },
  { value: 'abgelehnt', label: 'Abgelehnt' },
  { value: 'abgelaufen', label: 'Abgelaufen' },
  { value: 'umgewandelt', label: 'Umgewandelt' },
];

export const QUOTE_STATE_LABEL: Record<QuoteState, string> = {
  entwurf: 'Entwurf',
  versendet: 'Versendet',
  akzeptiert: 'Akzeptiert',
  abgelehnt: 'Abgelehnt',
  abgelaufen: 'Abgelaufen',
  umgewandelt: 'Umgewandelt',
};

export const QUOTE_STATE_BADGE: Record<QuoteState, string> = {
  entwurf: 'badge-neutral',
  versendet: 'badge-info',
  akzeptiert: 'badge-positive',
  abgelehnt: 'badge-negative',
  abgelaufen: 'badge-warning',
  umgewandelt: 'badge-neutral',
};

type QuoteLike = Pick<Quote, 'status' | 'valid_until'>;

export function quoteState(q: QuoteLike, today: string): QuoteState {
  switch (q.status) {
    case 'offen':
      return 'entwurf';
    case 'akzeptiert':
      return 'akzeptiert';
    case 'abgelehnt':
      return 'abgelehnt';
    case 'bestaetigt':
      return 'umgewandelt';
    case 'ueberfallig':
      return 'abgelaufen';
    default:
      return q.valid_until && toDay(q.valid_until) < today ? 'abgelaufen' : 'versendet';
  }
}

/** Filter fuer die Datenbankabfrage */
export function quoteViewFilter(view: QuoteView, today: string): { status?: string[]; validBefore?: string; validFromOrNull?: string; orExpired?: string } {
  switch (view) {
    case 'entwurf':
      return { status: ['offen'] };
    case 'akzeptiert':
      return { status: ['akzeptiert'] };
    case 'abgelehnt':
      return { status: ['abgelehnt'] };
    case 'umgewandelt':
      return { status: ['bestaetigt'] };
    case 'versendet':
      return { status: ['versendet'], validFromOrNull: today };
    case 'abgelaufen':
      return { orExpired: `status.eq.ueberfallig,and(status.eq.versendet,valid_until.lt.${today})` };
    default:
      return {};
  }
}

export type QuoteSummaryRow = Pick<Quote, 'id' | 'quote_number' | 'status' | 'total' | 'issue_date' | 'valid_until' | 'customer_id' | 'opportunity_id'>;

export interface QuoteSummary {
  counts: Record<QuoteView, number>;
  sums: Record<QuoteView, number>;
  /** Annahmequote der letzten 12 Monate (akzeptiert und umgewandelt gegen alle entschiedenen) */
  acceptance: number | null;
}

export function summarizeQuotes(rows: QuoteSummaryRow[], today: string): QuoteSummary {
  const views: QuoteView[] = ['alle', 'entwurf', 'versendet', 'akzeptiert', 'abgelehnt', 'abgelaufen', 'umgewandelt'];
  const counts = Object.fromEntries(views.map((v) => [v, 0])) as Record<QuoteView, number>;
  const parts = Object.fromEntries(views.map((v) => [v, [] as number[]])) as Record<QuoteView, number[]>;
  const from = addDays(today, -365);
  let won = 0;
  let decided = 0;
  for (const r of rows) {
    const s = quoteState(r, today);
    counts.alle++;
    counts[s]++;
    parts.alle.push(Number(r.total));
    parts[s].push(Number(r.total));
    if (r.issue_date >= from) {
      if (s === 'akzeptiert' || s === 'umgewandelt') {
        won++;
        decided++;
      } else if (s === 'abgelehnt' || s === 'abgelaufen') decided++;
    }
  }
  const sums = Object.fromEntries(views.map((v) => [v, sumRappen(parts[v])])) as Record<QuoteView, number>;
  return { counts, sums, acceptance: decided > 0 ? (won / decided) * 100 : null };
}

/**
 * Naechste Nummer OF-JJJJ-NNN. Zaehlt auch die alten AN-Nummern des Jahres
 * mit, damit die Folge weiterlaeuft (AN-2026-006 -> OF-2026-007).
 */
export function nextQuoteNumber(numbers: string[], year = new Date().getFullYear()): string {
  let highest = 0;
  for (const n of numbers) {
    const m = n?.match(/^(?:OF|AN)-(\d{4})-(\d{3,})$/);
    if (m && Number(m[1]) === year) highest = Math.max(highest, Number(m[2]));
  }
  return `OF-${year}-${String(highest + 1).padStart(3, '0')}`;
}
