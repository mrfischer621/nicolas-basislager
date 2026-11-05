import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RecordHeader, SideCard } from '../components/record/RecordHeader';
import { NotesPanel } from '../components/record/NotesPanel';
import { ProjectEditor } from '../components/projects/ProjectEditor';
import { InvoiceEditor, type InvoiceEditorMode } from '../components/invoices/InvoiceEditor';
import { ProgressBar } from '../components/cockpit/CockpitCard';
import { ViewTabs, useListState } from '../components/list';
import { EmptyState } from '../components/ui';
import { useProjects } from '../hooks/queries';
import { useTimeSummary } from '../hooks/useTimeEntries';
import { useResolvedRate, RATE_SOURCE_LABEL } from '../components/time/useResolvedRate';
import { supabase } from '../lib/supabase';
import type { Project } from '../lib/supabase';
import { zurichDay } from '../utils/financeAggregation';
import { formatChfDisplay } from '../utils/money';
import { formatDate, formatHours, formatPercent } from '../utils/format';
import { BILLING_BADGE, BILLING_LABEL, billingState, buildInvoicePreset, isUnbilled } from '../utils/timeEntries';
import { BUDGET_PERIOD_LABEL, PROJECT_STATUS_BADGE, PROJECT_STATUS_LABEL, isOverBudget, periodBudgetText, periodDiffText, periodHistory, periodUsageText, projectStats, withRecurringDefaults, type BudgetPeriodSummary } from '../utils/projects';
import { INVOICE_STATE_BADGE, INVOICE_STATE_LABEL, invoiceState } from '../utils/invoiceViews';

const BASE_TABS = [
  { value: 'zeiten', label: 'Zeiten' },
  { value: 'rechnungen', label: 'Rechnungen' },
  { value: 'notizen', label: 'Notizen' },
];
const PERIOD_TAB = { value: 'perioden', label: 'Perioden' };

/** Projektseite: Budget, Verbrauch, offene Zeiten; Tabs Zeiten, (Perioden), Rechnungen, Notizen. */
export default function ProjektDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { state, set } = useListState({ tab: 'zeiten' });
  const { data: projects = [], isLoading } = useProjects();
  const project = projects.find((p) => p.id === id) as (Project & { customers?: { name?: string } | null }) | undefined;
  // Perioden nur bei wiederkehrendem Budget; Standard bleibt «Zeiten»
  const TABS = project?.budget_period && project.budget_start ? [BASE_TABS[0], PERIOD_TAB, ...BASE_TABS.slice(1)] : BASE_TABS;
  const tab = TABS.some((t) => t.value === state.tab) ? state.tab : 'zeiten';
  const time = useTimeSummary();
  const rate = useResolvedRate(project?.id ?? '');
  const [editing, setEditing] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceEditorMode | null>(null);
  const today = zurichDay(new Date());
  const invoices = useQuery({
    queryKey: ['invoices', 'by-project', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices').select('id, invoice_number, status, total, issue_date, due_date').eq('project_id', id!).order('issue_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const entries = useMemo(() => time.rows.filter((r) => r.project_id === id).sort((a, b) => b.date.localeCompare(a.date)), [time.rows, id]);

  if (isLoading) return <div role="status" className="skeleton h-96" aria-label="Wird geladen" />;
  if (!project) return <EmptyState title="Projekt nicht gefunden" action={<Link to="/projekte" className="btn-secondary">Zu den Projekten</Link>} />;

  const stats = projectStats(project, time.rows, today);
  const recurring = stats.budgetMode === 'recurring';
  const history = recurring ? periodHistory(project, time.rows, today) : [];
  const unbilled = entries.filter(isUnbilled);
  const preset = buildInvoicePreset(unbilled);
  const per = recurring ? BUDGET_PERIOD_LABEL[project.budget_period!] : '';

  /** Rechnungsentwurf nur mit den offenen Zeiten einer Periode */
  const invoicePeriod = (p: BudgetPeriodSummary) => {
    const rows = unbilled.filter((e) => e.date >= p.from && e.date <= p.to);
    const r = buildInvoicePreset(rows);
    if (r.ok) setInvoice({ kind: 'new', preset: withRecurringDefaults(r.preset, project, rows) });
    else toast.error(r.reason);
  };

  const rateHighlight = { label: 'Satz', value: rate.data ? formatChfDisplay(rate.data.rate, { decimals: 0 }) : '–', hint: rate.data ? RATE_SOURCE_LABEL[rate.data.source] : undefined };
  const unbilledHighlight = { label: 'Nicht verrechnet', value: formatChfDisplay(stats.unbilledAmount, { decimals: 0 }), hint: formatHours(stats.unbilledHours) };
  const highlights = recurring
    ? [
        {
          label: `Budget pro ${per}`,
          value: periodBudgetText({ budgetHours: project.budget_hours === null ? null : Number(project.budget_hours), budgetAmount: project.budget === null ? null : Number(project.budget) }),
        },
        stats.period
          ? {
              label: 'Diese Periode',
              value: periodUsageText(stats.period),
              hint: [stats.period.usedPercent !== null ? formatPercent(stats.period.usedPercent) : null, isOverBudget(stats.period) ? periodDiffText(stats.period) : null].filter(Boolean).join(' · ') || undefined,
            }
          : { label: 'Diese Periode', value: '–', hint: `ab ${formatDate(project.budget_start)}` },
        unbilledHighlight,
        rateHighlight,
      ]
    : [
        { label: 'Budget', value: project.budget ? formatChfDisplay(Number(project.budget), { decimals: 0 }) : 'ohne' },
        { label: 'Verbraucht', value: formatChfDisplay(stats.amount, { decimals: 0 }), hint: stats.budgetUsed !== null ? formatPercent(stats.budgetUsed) : `${stats.hours.toFixed(1)} h` },
        unbilledHighlight,
        rateHighlight,
      ];

  return (
    <div className="space-y-6">
      <RecordHeader
        back={{ to: '/projekte', label: 'Projekte' }}
        title={project.name}
        status={<span className={PROJECT_STATUS_BADGE[project.status]}>{PROJECT_STATUS_LABEL[project.status]}</span>}
        subtitle={project.customers?.name ? <Link className="hover:underline" to={`/kontakte/firmen/${project.customer_id}`}>{project.customers.name}</Link> : undefined}
        primary={
          <Link to={`/zeiterfassung?projekt=${project.id}`} className="btn-cta" onClick={() => localStorage.setItem('zeit_letztes_projekt', project.id)}>
            Zeit erfassen
          </Link>
        }
        menu={[
          { label: 'Rechnung aus offenen Zeiten', onSelect: () => {
            if (preset.ok) setInvoice({ kind: 'new', preset: withRecurringDefaults(preset.preset, project, unbilled) });
            else toast.error(preset.reason);
          }, hidden: unbilled.length === 0 },
          { label: 'Bearbeiten', onSelect: () => setEditing(true) },
          {
            label: project.is_active ? 'Archivieren' : 'Wiederherstellen',
            onSelect: async () => {
              await supabase.from('projects').update({ is_active: !project.is_active }).eq('id', project.id);
              await qc.invalidateQueries({ queryKey: ['projects'] });
            },
          },
        ]}
        highlights={highlights}
      />
      {stats.budgetUsed !== null &&
        (stats.period ? (
          <div className="space-y-1">
            <p className="text-xs text-fg-muted">Budget {stats.period.label}</p>
            <ProgressBar percent={stats.budgetUsed} level={stats.level} label={`Budget ${stats.period.label}`} />
          </div>
        ) : (
          <ProgressBar percent={stats.budgetUsed} level={stats.level} label="Budgetverbrauch" />
        ))}

      <div className="grid gap-6 xl:grid-cols-3">
        {/* min-w-0: sonst dehnt die Tab-Zeile die Rasterspalte ueber den Bildschirm */}
        <div className="min-w-0 space-y-4 xl:col-span-2">
          <ViewTabs label="Bereich" tabs={TABS.map((t) => ({ ...t, count: t.value === 'zeiten' ? entries.length : t.value === 'rechnungen' ? invoices.data?.length : undefined }))} value={tab} onChange={(v) => set({ tab: v })} />
          <section className="card p-5">
            {tab === 'zeiten' &&
              (entries.length === 0 ? (
                <p className="text-sm text-fg-muted">Noch keine Zeiten.</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {entries.slice(0, 100).map((e) => {
                    const s = billingState(e);
                    return (
                      <li key={e.id} className="flex items-center gap-3 py-2">
                        <span className="w-24 shrink-0 tabular-nums">{formatDate(e.date)}</span>
                        <span className="min-w-0 flex-1 truncate">{e.description || '–'}</span>
                        <span className="w-16 shrink-0 text-right tabular-nums">{Number(e.hours).toFixed(2)} h</span>
                        <span className={`hidden shrink-0 sm:inline ${BILLING_BADGE[s]}`}>{BILLING_LABEL[s]}</span>
                      </li>
                    );
                  })}
                </ul>
              ))}
            {tab === 'perioden' && <PeriodTable history={history} onInvoice={invoicePeriod} />}
            {tab === 'rechnungen' &&
              (invoices.data?.length ? (
                <ul className="divide-y divide-line text-sm">
                  {invoices.data.map((i) => {
                    const s = invoiceState(i, today);
                    return (
                      <li key={i.id}>
                        <Link to={`/rechnungen/${i.id}`} className="flex items-center gap-3 py-2 hover:underline">
                          <span className="w-28 shrink-0 font-semibold">{i.invoice_number}</span>
                          <span className="flex-1 tabular-nums">{formatDate(i.issue_date)}</span>
                          <span className="tabular-nums">{formatChfDisplay(Number(i.total))}</span>
                          <span className={INVOICE_STATE_BADGE[s]}>{INVOICE_STATE_LABEL[s]}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-fg-muted">Noch keine Rechnungen zu diesem Projekt.</p>
              ))}
            {tab === 'notizen' && <NotesPanel target={{ project_id: project.id }} />}
          </section>
        </div>
        <div className="space-y-6">
          <SideCard title="Projekt">
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-fg-muted">Beschreibung</dt>
                <dd className="whitespace-pre-wrap">{project.description || '–'}</dd>
              </div>
              <div>
                <dt className="text-xs text-fg-muted">Erstellt</dt>
                <dd>{formatDate(project.created_at)}</dd>
              </div>
            </dl>
          </SideCard>
        </div>
      </div>

      <ProjectEditor open={editing} project={project} onClose={() => setEditing(false)} />
      <InvoiceEditor mode={invoice} onClose={() => setInvoice(null)} onSaved={(newId) => navigate(`/rechnungen/${newId}`)} />
    </div>
  );
}

/**
 * Verlauf der Perioden: Budget, erfasst, Differenz (Vorzeichen und Wort) und
 * nicht verrechnet. Abgeschlossene Perioden mit offenen Zeiten: «Verrechnen».
 * Ab sm eine Tabelle, darunter eine Liste (kein seitliches Scrollen).
 */
function PeriodTable({ history, onInvoice }: { history: BudgetPeriodSummary[]; onInvoice: (p: BudgetPeriodSummary) => void }) {
  if (history.length === 0) return <p className="text-sm text-fg-muted">Das Budget hat noch nicht begonnen. Perioden erscheinen ab dem Beginn.</p>;
  const diff = (p: BudgetPeriodSummary) => {
    const text = periodDiffText(p);
    if (!text) return <span className="text-fg-muted">–</span>;
    return <span className={isOverBudget(p) ? 'font-semibold text-negative' : 'text-fg-muted'}>{text}</span>;
  };
  const open = (p: BudgetPeriodSummary) =>
    p.unbilledHours > 0 ? (
      <span className="text-attention">
        {formatHours(p.unbilledHours)} · {formatChfDisplay(p.unbilledAmount, { decimals: 0 })}
      </span>
    ) : (
      <span className="text-fg-muted">–</span>
    );
  const action = (p: BudgetPeriodSummary) =>
    p.isClosed && p.unbilledHours > 0 ? (
      <button type="button" className="bw-textlink min-h-[44px] md:min-h-0" onClick={() => onInvoice(p)} aria-label={`${p.label} verrechnen`}>
        Verrechnen
      </button>
    ) : null;
  const name = (p: BudgetPeriodSummary) => (
    <>
      <span className="font-semibold">{p.label}</span>
      {p.isCurrent && <span className="badge-info ml-2">laufend</span>}
    </>
  );

  // Tabelle: Werte zweizeilig (Stunden / CHF), damit sie neben der Seitenkarte Platz hat
  const stacked = (top: string, bottom: string | null, tone = '') => (
    <span className={`whitespace-nowrap ${tone}`}>
      {top}
      {bottom && <span className="block text-xs">{bottom}</span>}
    </span>
  );
  const chf0 = (n: number) => formatChfDisplay(n, { decimals: 0 });
  const diffCell = (p: BudgetPeriodSummary) => {
    const text = periodDiffText(p);
    if (!text) return <span className="text-fg-muted">–</span>;
    const i = text.lastIndexOf(' ');
    return stacked(text.slice(0, i), text.slice(i + 1), isOverBudget(p) ? 'font-semibold text-negative' : 'text-fg-muted');
  };

  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Perioden des wiederkehrenden Budgets, neueste zuerst</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-fg-muted">
              <th scope="col" className="py-2 pr-3 font-semibold">Periode</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">Budget</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">Erfasst</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">Differenz</th>
              <th scope="col" className="py-2 text-right font-semibold">Nicht verrechnet</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {history.map((p) => (
              <tr key={p.from} className="align-top">
                <td className="py-2 pr-3">
                  <span className="block whitespace-nowrap font-semibold">{p.label}</span>
                  {p.isCurrent && <span className="badge-info">laufend</span>}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {stacked(p.budgetHours !== null ? formatHours(p.budgetHours) : p.budgetAmount !== null ? chf0(p.budgetAmount) : '–', p.budgetHours !== null && p.budgetAmount !== null ? chf0(p.budgetAmount) : null)}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{stacked(formatHours(p.hours), chf0(p.amount))}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{diffCell(p)}</td>
                <td className="py-2 text-right tabular-nums">
                  {p.unbilledHours > 0 ? stacked(formatHours(p.unbilledHours), chf0(p.unbilledAmount), 'text-attention') : <span className="text-fg-muted">–</span>}
                  {action(p) && <span className="mt-1 block">{action(p)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-line text-sm sm:hidden" aria-label="Perioden des wiederkehrenden Budgets">
        {history.map((p) => (
          <li key={p.from} className="space-y-1 py-3">
            <div className="flex items-center justify-between gap-3">
              <span>{name(p)}</span>
              {action(p)}
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 tabular-nums">
              <dt className="text-xs text-fg-muted">Budget</dt>
              <dd className="text-right">{periodBudgetText(p)}</dd>
              <dt className="text-xs text-fg-muted">Erfasst</dt>
              <dd className="text-right">{formatHours(p.hours)} · {formatChfDisplay(p.amount, { decimals: 0 })}</dd>
              <dt className="text-xs text-fg-muted">Differenz</dt>
              <dd className="text-right">{diff(p)}</dd>
              <dt className="text-xs text-fg-muted">Nicht verrechnet</dt>
              <dd className="text-right">{open(p)}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
