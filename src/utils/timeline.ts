import { toDay } from './financeAggregation';

/** Ereignis im Zeitstrahl einer Firma (abgeleitet aus vorhandenen Daten plus Notizen). */
export interface TimelineEvent {
  key: string;
  day: string;
  kind: 'rechnung' | 'offerte' | 'deal' | 'zeit' | 'notiz';
  text: string;
  to?: string;
}

interface Input {
  invoices: { id: string; invoice_number: string; created_at: string; sent_at?: string | null; paid_at: string | null; status: string; total: number }[];
  quotes: { id: string; quote_number: string; created_at: string; sent_at?: string | null; converted_at: string | null; status: string }[];
  deals: { id: string; title: string; created_at: string; is_lost: boolean }[];
  time: { date: string; hours: number }[];
  notes: { id: string; created_at: string; body: string }[];
}

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/**
 * Zeitstrahl, neueste zuerst. Zeiten werden pro Monat zusammengefasst, damit
 * einzelne Einträge den Verlauf nicht fluten.
 */
export function buildTimeline(input: Input): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const i of input.invoices) {
    events.push({ key: `re-${i.id}-c`, day: toDay(i.created_at), kind: 'rechnung', text: `Rechnung ${i.invoice_number} erstellt`, to: `/rechnungen/${i.id}` });
    if (i.sent_at) events.push({ key: `re-${i.id}-s`, day: toDay(i.sent_at), kind: 'rechnung', text: `Rechnung ${i.invoice_number} versendet`, to: `/rechnungen/${i.id}` });
    if (i.paid_at) events.push({ key: `re-${i.id}-p`, day: toDay(i.paid_at), kind: 'rechnung', text: `Rechnung ${i.invoice_number} bezahlt`, to: `/rechnungen/${i.id}` });
  }
  for (const q of input.quotes) {
    events.push({ key: `of-${q.id}-c`, day: toDay(q.created_at), kind: 'offerte', text: `Offerte ${q.quote_number} erstellt`, to: `/offerten/${q.id}` });
    if (q.sent_at) events.push({ key: `of-${q.id}-s`, day: toDay(q.sent_at), kind: 'offerte', text: `Offerte ${q.quote_number} versendet`, to: `/offerten/${q.id}` });
    if (q.converted_at) events.push({ key: `of-${q.id}-u`, day: toDay(q.converted_at), kind: 'offerte', text: `Offerte ${q.quote_number} in Rechnung umgewandelt`, to: `/offerten/${q.id}` });
  }
  for (const d of input.deals) {
    events.push({ key: `deal-${d.id}`, day: toDay(d.created_at), kind: 'deal', text: `Deal «${d.title}» angelegt${d.is_lost ? ' (verloren)' : ''}`, to: '/pipeline' });
  }
  const months = new Map<string, number>();
  for (const t of input.time) months.set(t.date.slice(0, 7), (months.get(t.date.slice(0, 7)) ?? 0) + Number(t.hours));
  for (const [month, hours] of months) {
    const last = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).toISOString().slice(0, 10);
    events.push({ key: `zeit-${month}`, day: last, kind: 'zeit', text: `${(Math.round(hours * 100) / 100).toFixed(2)} h erfasst im ${MONTHS[+month.slice(5, 7) - 1]} ${month.slice(0, 4)}` });
  }
  for (const n of input.notes) {
    events.push({ key: `notiz-${n.id}`, day: toDay(n.created_at), kind: 'notiz', text: n.body });
  }
  return events.sort((a, b) => b.day.localeCompare(a.day) || a.key.localeCompare(b.key));
}
