import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import type { Deadline, Opportunity, PipelineStage } from '../../lib/supabase';
import type { FinanceEntry } from '../../utils/financeAggregation';
import type { InvoiceSummaryRow } from '../../utils/invoiceViews';
import type { TimeRow } from '../../utils/timeEntries';
import type { OpportunityRow } from '../../utils/pipeline';
import { acquisition, fixedCosts, paymentDuration, recurringRevenue, utilization, type RecurringSeries } from '../../utils/cockpit';
import { upcomingDeadlines, RECURRENCE_LABEL } from '../../utils/deadlines';
import { formatChfDisplay } from '../../utils/money';
import { formatDate, formatPercent } from '../../utils/format';
import { CockpitCard, Figure, ProgressBar } from './CockpitCard';

const STORAGE_KEY = 'cockpit_weitere_offen';

function readOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Zweite Prioritaet des Cockpits: einklappbar, Zustand pro Geraet gespeichert. */
export function SecondaryMetrics(props: {
  entries: FinanceEntry[];
  invoices: (InvoiceSummaryRow & { is_recurring_revenue?: boolean | null })[];
  time: TimeRow[];
  deals: OpportunityRow[];
  stages: PipelineStage[];
  deadlines: Deadline[];
  leads: Pick<Opportunity, 'id' | 'lead_status' | 'created_at'>[];
  series: RecurringSeries[];
  names: Map<string, string>;
  weeklyTarget: number | null;
  nominalRate: number;
  today: string;
}) {
  const [open, setOpen] = useState(readOpen);
  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(STORAGE_KEY, o ? '0' : '1');
      } catch {
        /* Speicher nicht verfuegbar: Zustand gilt nur fuer diese Sitzung */
      }
      return !o;
    });
  };

  return (
    <section aria-label="Weitere Kennzahlen">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center justify-between rounded-lg px-1 py-2 text-left">
        <h2 className="caps-sm">Weitere Kennzahlen</h2>
        <ChevronDown size={18} className={`text-fg-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && <Metrics {...props} />}
    </section>
  );
}

function Metrics({ invoices, time, deals, stages, deadlines, leads, series, names, weeklyTarget, nominalRate, today }: Parameters<typeof SecondaryMetrics>[0]) {
  const util = utilization(time, today, weeklyTarget, nominalRate);
  const recurring = recurringRevenue(invoices.map((i) => ({ total: Number(i.total), issue_date: i.issue_date, status: i.status, is_recurring_revenue: i.is_recurring_revenue })), today);
  const fixed = fixedCosts(series);
  const dso = paymentDuration(invoices, names, today);
  const nextDeadlines = upcomingDeadlines(deadlines, today, 120).slice(0, 5);
  const wonStages = new Set(stages.filter((s) => s.is_won).map((s) => s.id));
  const acq = acquisition(
    [...leads.map((l) => ({ kind: 'lead', created_at: l.created_at, is_lost: false })), ...deals.map((d) => ({ kind: 'deal', created_at: d.created_at, source: d.source, is_lost: d.is_lost, won: wonStages.has(d.stage_id) }))],
    today
  );
  const maxBar = Math.max(1, ...acq.months.map((m) => m.leads + m.deals));

  return (
    <div className="mt-2 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <CockpitCard title="Auslastung" info="Verrechenbare Stunden gegen das Stundenziel. Effektiver Satz: Umsatz aus Zeiten geteilt durch alle erfassten Stunden dieses Jahres, auch nicht verrechenbare.">
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span>Diese Woche</span>
              <span className="tabular-nums">
                {util.weekHours.toFixed(1)} h{util.weekTarget ? ` von ${util.weekTarget} h` : ''}
              </span>
            </div>
            {util.weekTarget ? <ProgressBar percent={(util.weekHours / util.weekTarget) * 100} label="Auslastung Woche" /> : null}
          </div>
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span>Dieser Monat</span>
              <span className="tabular-nums">
                {util.monthHours.toFixed(1)} h{util.monthTarget ? ` von ${util.monthTarget} h` : ''}
              </span>
            </div>
            {util.monthTarget ? <ProgressBar percent={(util.monthHours / util.monthTarget) * 100} label="Auslastung Monat" /> : null}
          </div>
          {!util.weekTarget && (
            <Link to="/einstellungen/ziele" className="text-xs underline">
              Stundenziel festlegen
            </Link>
          )}
          <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
            <Figure value={util.effectiveRate !== null ? formatChfDisplay(util.effectiveRate, { decimals: 0 }) : '–'} label="effektiv pro Stunde" />
            <Figure value={formatChfDisplay(util.nominalRate, { decimals: 0 })} label="Standardsatz" />
          </div>
        </div>
      </CockpitCard>

      <CockpitCard title="Wiederkehrender Umsatz" info="Rechnungen mit der Markierung «wiederkehrender Umsatz» (Wartung, Retainer), letzte 12 Monate nach Rechnungsdatum.">
        <div className="grid grid-cols-2 gap-3">
          <Figure value={formatChfDisplay(recurring.mrr, { decimals: 0 })} label="pro Monat (MRR)" />
          <Figure value={formatPercent(recurring.share)} label="Anteil am Umsatz" />
        </div>
        {recurring.recurring === 0 && <p className="mt-3 text-xs text-fg-muted">Markiere Retainer-Rechnungen in der Rechnungsmaske als «wiederkehrender Umsatz».</p>}
      </CockpitCard>

      <CockpitCard title="Fixkosten" info="Buchungen mit der Markierung «wiederkehrend», auf einen Monat umgerechnet. Eine Serie endet, wenn zwei Intervalle lang keine Buchung kam.">
        <Figure value={`${formatChfDisplay(fixed.monthly, { decimals: 0 })}/Mt.`} label={`${fixed.items.length} wiederkehrende Ausgaben`} />
        {fixed.items.length > 0 ? (
          <ul className="mt-3 divide-y divide-line text-sm">
            {fixed.items.slice(0, 6).map((s) => (
              <li key={s.key} className="flex justify-between gap-2 py-1.5">
                <span className="min-w-0 truncate">
                  {s.label}
                  <span className="ml-1 text-xs text-fg-muted">{RECURRENCE_LABEL[s.interval].toLowerCase()}</span>
                </span>
                <span className={`shrink-0 tabular-nums ${s.increased ? 'text-warning' : ''}`} title={s.increased ? `Gestiegen von ${formatChfDisplay(s.previousAmount ?? 0)}` : undefined}>
                  {formatChfDisplay(s.monthly)}
                  {s.increased && ' ↑'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-fg-muted">Markiere Abos in der Buchungsmaske als «wiederkehrend».</p>
        )}
        {fixed.increased.length > 0 && <p className="mt-2 text-xs text-warning">{fixed.increased.length === 1 ? '1 Ausgabe' : `${fixed.increased.length} Ausgaben`} um mehr als 10 % gestiegen.</p>}
      </CockpitCard>

      <CockpitCard title="Zahlungsdauer" info="Tage vom Rechnungsdatum bis zum Zahlungseingang, letzte 12 Monate. Rechnungen mit übernommenem Fälligkeitsdatum zählen nicht.">
        <Figure value={dso.averageDays !== null ? `${dso.averageDays} Tage` : '–'} label={`im Schnitt, ${dso.count} Rechnungen`} />
        {dso.byCustomer.some((c) => c.late) && (
          <ul className="mt-3 space-y-1 text-sm">
            {dso.byCustomer
              .filter((c) => c.late)
              .slice(0, 3)
              .map((c) => (
                <li key={c.customerId} className="flex justify-between gap-2">
                  <span className="truncate">{c.name}</span>
                  <span className="shrink-0 tabular-nums text-warning">{c.averageDelay} Tage zu spät</span>
                </li>
              ))}
          </ul>
        )}
        {dso.excluded > 0 && <p className="mt-3 text-xs text-fg-muted">{dso.excluded} {dso.excluded === 1 ? 'Rechnung' : 'Rechnungen'} ohne echtes Zahlungsdatum nicht berücksichtigt.</p>}
      </CockpitCard>

      <CockpitCard title="Fristen" action={<Link to="/einstellungen/fristen" className="text-xs underline">Verwalten</Link>}>
        {nextDeadlines.length === 0 ? (
          <p className="text-sm text-fg-muted">Keine offenen Fristen in den nächsten vier Monaten.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {nextDeadlines.map((d) => (
              <li key={d.id} className="flex justify-between gap-2 py-1.5">
                <span className="min-w-0 truncate">{d.title}</span>
                <span className={`shrink-0 tabular-nums ${d.due_date < today ? 'text-negative' : 'text-fg-muted'}`}>{formatDate(d.due_date)}</span>
              </li>
            ))}
          </ul>
        )}
      </CockpitCard>

      <CockpitCard title="Akquise" info="Neue Leads und Deals pro Monat. Quoten über alle Einträge: Leads, die zum Deal wurden; gewonnene von abgeschlossenen Deals.">
        <div className="flex h-20 items-end gap-2" aria-hidden="true">
          {acq.months.map((m) => (
            <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full flex-col-reverse overflow-hidden rounded" style={{ height: `${((m.leads + m.deals) / maxBar) * 56 + 2}px` }}>
                <span className="bg-line-strong" style={{ height: `${(m.leads / Math.max(1, m.leads + m.deals)) * 100}%` }} />
                <span className="bg-cta" style={{ height: `${(m.deals / Math.max(1, m.leads + m.deals)) * 100}%` }} />
              </div>
              <span className="text-[11px] text-fg-muted">{m.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-1 flex gap-3 text-xs text-fg-muted">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-line-strong" />Leads</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-cta" />Deals</span>
        </p>
        <table className="sr-only">
          <caption>Neue Leads und Deals pro Monat</caption>
          <tbody>
            {acq.months.map((m) => (
              <tr key={m.key}>
                <th>{m.label}</th>
                <td>{m.leads} Leads</td>
                <td>{m.deals} Deals</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
          <Figure value={String(acq.newDealsThisMonth)} label="neue Deals diesen Monat" />
          <Figure value={acq.leadToDeal !== null ? formatPercent(acq.leadToDeal) : '–'} label="Lead zu Deal" />
          <Figure value={acq.dealToWon !== null ? formatPercent(acq.dealToWon) : '–'} label="Deal zu gewonnen" />
        </div>
      </CockpitCard>
    </div>
  );
}
