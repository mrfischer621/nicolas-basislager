import type { Deadline, DeadlineRecurrence } from '../lib/supabase';
import { addDays } from './financeAggregation';

export const RECURRENCE_LABEL: Record<DeadlineRecurrence, string> = {
  einmalig: 'Einmalig',
  monatlich: 'Monatlich',
  quartalsweise: 'Quartalsweise',
  jaehrlich: 'Jährlich',
};

const MONTHS: Record<DeadlineRecurrence, number> = { einmalig: 0, monatlich: 1, quartalsweise: 3, jaehrlich: 12 };

/**
 * Naechster Termin einer wiederkehrenden Frist. Monatsende bleibt Monatsende
 * (31.01. -> 28.02. -> 31.03.), sonst gleicher Tag.
 */
export function nextOccurrence(day: string, recurrence: DeadlineRecurrence): string | null {
  const step = MONTHS[recurrence];
  if (!step) return null;
  const [y, m, d] = day.split('-').map(Number);
  const lastOfMonth = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  const wasMonthEnd = d === lastOfMonth(y, m);
  const total = m - 1 + step;
  const ny = y + Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const nd = wasMonthEnd ? lastOfMonth(ny, nm) : Math.min(d, lastOfMonth(ny, nm));
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

/** Offene Fristen in den naechsten `days` Tagen (inklusive ueberfaellige). */
export function upcomingDeadlines(deadlines: Deadline[], today: string, days = 14): Deadline[] {
  const limit = addDays(today, days);
  return deadlines.filter((d) => !d.done_at && d.due_date <= limit).sort((a, b) => a.due_date.localeCompare(b.due_date));
}

/** Vorlagen fuer haeufige Fristen einer Einzelfirma (Datum im laufenden Jahr). */
export function deadlineTemplates(today: string): { title: string; due_date: string; recurrence: DeadlineRecurrence }[] {
  const year = Number(today.slice(0, 4));
  const nextQuarterEnd = (() => {
    const m = Number(today.slice(5, 7));
    const q = Math.ceil(m / 3) * 3;
    const last = new Date(Date.UTC(year, q, 0)).getUTCDate();
    return `${year}-${String(q).padStart(2, '0')}-${last}`;
  })();
  return [
    { title: 'Steuererklärung einreichen', due_date: `${year + 1}-03-31`, recurrence: 'jaehrlich' },
    { title: 'AHV-Akontozahlung', due_date: nextQuarterEnd, recurrence: 'quartalsweise' },
    { title: 'Jahresabschluss erstellen', due_date: `${year + 1}-02-28`, recurrence: 'jaehrlich' },
  ];
}
