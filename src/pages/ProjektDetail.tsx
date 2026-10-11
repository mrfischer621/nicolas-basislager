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
import { PROJECT_STATUS_BADGE, PROJECT_STATUS_LABEL, projectStats } from '../utils/projects';
import { INVOICE_STATE_BADGE, INVOICE_STATE_LABEL, invoiceState } from '../utils/invoiceViews';

const TABS = [
  { value: 'zeiten', label: 'Zeiten' },
  { value: 'rechnungen', label: 'Rechnungen' },
  { value: 'notizen', label: 'Notizen' },
];

/** Projektseite: Budget, Verbrauch, offene Zeiten; Tabs Zeiten, Rechnungen, Notizen. */
export default function ProjektDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { state, set } = useListState({ tab: 'zeiten' });
  const tab = TABS.some((t) => t.value === state.tab) ? state.tab : 'zeiten';
  const { data: projects = [], isLoading } = useProjects();
  const project = projects.find((p) => p.id === id) as (Project & { customers?: { name?: string } | null }) | undefined;
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

  if (isLoading) return <div className="skeleton h-96" aria-label="Wird geladen" />;
  if (!project) return <EmptyState title="Projekt nicht gefunden" action={<Link to="/projekte" className="btn-secondary">Zu den Projekten</Link>} />;

  const stats = projectStats(project, time.rows);
  const unbilled = entries.filter(isUnbilled);
  const preset = buildInvoicePreset(unbilled);

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
            if (preset.ok) setInvoice({ kind: 'new', preset: preset.preset });
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
        highlights={[
          { label: 'Budget', value: project.budget ? formatChfDisplay(Number(project.budget), { decimals: 0 }) : 'ohne' },
          { label: 'Verbraucht', value: formatChfDisplay(stats.amount, { decimals: 0 }), hint: stats.budgetUsed !== null ? formatPercent(stats.budgetUsed) : `${stats.hours.toFixed(1)} h` },
          { label: 'Nicht verrechnet', value: formatChfDisplay(stats.unbilledAmount, { decimals: 0 }), hint: formatHours(stats.unbilledHours) },
          { label: 'Satz', value: rate.data ? formatChfDisplay(rate.data.rate, { decimals: 0 }) : '–', hint: rate.data ? RATE_SOURCE_LABEL[rate.data.source] : undefined },
        ]}
      />
      {stats.budgetUsed !== null && <ProgressBar percent={stats.budgetUsed} level={stats.level} label="Budgetverbrauch" />}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
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
