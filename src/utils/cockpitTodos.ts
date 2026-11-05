import type { Deadline, Project } from '../lib/supabase';
import type { FinanceEntry } from './financeAggregation';
import { addDays } from './financeAggregation';
import { invoiceState, type InvoiceSummaryRow } from './invoiceViews';
import { isUnbilled, type TimeRow } from './timeEntries';
import { isDueAction, type OpportunityRow } from './pipeline';
import { upcomingDeadlines } from './deadlines';
import { budgetModeOf, periodHistory } from './projects';

type TodoProject = Pick<Project, 'id' | 'name' | 'budget' | 'is_active'> & Partial<Pick<Project, 'budget_period' | 'budget_hours' | 'budget_start'>>;

export interface Todo {
  key: string;
  count: number;
  text: string;
  /** Ziel: gefilterte Liste */
  to?: string;
  /** oder ein Dialog im Cockpit */
  action?: 'zahlungsdaten' | 'kontostand' | 'fristen';
  tone: 'negative' | 'warning' | 'attention' | 'info';
}

const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * "Zu erledigen" ganz oben im Cockpit: nur was ansteht, je mit Anzahl und
 * direktem Weg in die gefilterte Liste oder den Sammeldialog.
 */
export function buildTodos(input: {
  today: string;
  invoices: InvoiceSummaryRow[];
  deals: OpportunityRow[];
  newLeads: number;
  time: TimeRow[];
  entries: FinanceEntry[];
  deadlines: Deadline[];
  lastBalanceDate: string | null;
  /** fuer «Periode verrechnen» bei wiederkehrendem Budget */
  projects?: TodoProject[];
}): Todo[] {
  const { today } = input;
  const todos: Todo[] = [];
  const overdue = input.invoices.filter((i) => invoiceState(i, today) === 'ueberfaellig');
  if (overdue.length) todos.push({ key: 'ueberfaellig', count: overdue.length, text: n(overdue.length, 'überfällige Rechnung', 'überfällige Rechnungen'), to: '/rechnungen?ansicht=ueberfaellig', tone: 'negative' });

  const noPaidDate = input.invoices.filter((i) => i.status === 'bezahlt' && !i.paid_at);
  if (noPaidDate.length) todos.push({ key: 'zahlungsdatum', count: noPaidDate.length, text: `${n(noPaidDate.length, 'bezahlte Rechnung', 'bezahlte Rechnungen')} ohne Zahlungsdatum`, action: 'zahlungsdaten', tone: 'warning' });

  const deadlines = upcomingDeadlines(input.deadlines, today, 14);
  if (deadlines.length) {
    const first = deadlines[0];
    todos.push({
      key: 'fristen',
      count: deadlines.length,
      text: deadlines.length === 1 ? `Frist: ${first.title}` : `${deadlines.length} Fristen in den nächsten 14 Tagen`,
      to: '/einstellungen/fristen',
      tone: first.due_date < today ? 'negative' : 'attention',
    });
  }

  const dueDeals = input.deals.filter((d) => !d.is_lost && isDueAction(d, today));
  if (dueDeals.length) todos.push({ key: 'deals', count: dueDeals.length, text: `${n(dueDeals.length, 'Deal', 'Deals')} mit fälliger nächster Aktion`, to: '/pipeline?ansicht=faellig', tone: 'attention' });

  if (input.newLeads) todos.push({ key: 'leads', count: input.newLeads, text: n(input.newLeads, 'neuer Lead', 'neue Leads'), to: '/leads?ansicht=neu', tone: 'info' });

  // Wiederkehrendes Budget: letzte abgeschlossene Periode mit offenen Zeiten verrechnen.
  // Diese Zeiten zaehlen dann nicht mehr im 30-Tage-Eintrag.
  const covered = new Set<string>();
  for (const p of input.projects ?? []) {
    if (!p.is_active || budgetModeOf(p) !== 'recurring') continue;
    const last = periodHistory(p, input.time, today).find((x) => x.isClosed);
    if (!last || last.unbilledHours <= 0) continue;
    const rows = input.time.filter((t) => t.project_id === p.id && isUnbilled(t) && t.date >= last.from && t.date <= last.to);
    rows.forEach((t) => covered.add(t.id));
    todos.push({ key: `periode-${p.id}`, count: rows.length, text: `${p.name}: ${last.label} verrechnen (${last.unbilledHours.toFixed(2)} h)`, to: `/projekte/${p.id}?tab=perioden`, tone: 'attention' });
  }

  const cutoff = addDays(today, -30);
  const stale = input.time.filter((t) => isUnbilled(t) && t.date < cutoff && !covered.has(t.id));
  if (stale.length) {
    const hours = Math.round(stale.reduce((s, t) => s + Number(t.hours), 0) * 100) / 100;
    todos.push({ key: 'zeiten', count: stale.length, text: `${hours.toFixed(2)} h nicht verrechnet, älter als 30 Tage`, to: `/zeiterfassung?ansicht=offen&bis=${cutoff}`, tone: 'attention' });
  }

  const incomplete = input.entries.filter((e) => e.source === 'transaction' && e.type === 'ausgabe' && (!e.receiptUrl || !e.category));
  if (incomplete.length) todos.push({ key: 'buchungen', count: incomplete.length, text: `${n(incomplete.length, 'Buchung', 'Buchungen')} ohne Beleg oder Kategorie`, to: '/buchungen?ansicht=unvollstaendig', tone: 'warning' });

  if (!input.lastBalanceDate || input.lastBalanceDate < cutoff) {
    todos.push({ key: 'kontostand', count: 1, text: input.lastBalanceDate ? 'Kontostand älter als 30 Tage' : 'Noch kein Kontostand erfasst', action: 'kontostand', tone: 'info' });
  }
  return todos;
}
