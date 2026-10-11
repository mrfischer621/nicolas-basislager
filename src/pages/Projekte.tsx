import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Briefcase, Plus } from 'lucide-react';
import { DataTable, FilterSelect, ListPage, SearchField, Toolbar, ViewTabs, activeFilterCount, useListState, type Column, type RowMenuItem } from '../components/list';
import { EmptyState } from '../components/ui';
import { ProgressBar } from '../components/cockpit/CockpitCard';
import { ProjectEditor } from '../components/projects/ProjectEditor';
import { useCompany } from '../context/CompanyContext';
import { useCustomers, useProjects } from '../hooks/queries';
import { useTimeSummary } from '../hooks/useTimeEntries';
import { supabase } from '../lib/supabase';
import type { Project } from '../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { formatChfDisplay } from '../utils/money';
import { formatHours, formatPercent } from '../utils/format';
import { PROJECT_STATUS_BADGE, PROJECT_STATUS_LABEL, PROJECT_VIEWS, matchesProjectView, projectStats, type ProjectView } from '../utils/projects';

const DEFAULTS = { ansicht: 'laufend' };
type Row = Project & { customers?: { name?: string } | null; stats: ReturnType<typeof projectStats> };

/**
 * Projekte mit Budget, Verbrauch und offenen Stunden. Die Projektliste ist
 * klein; gefiltert wird im Browser, der Zustand steht in der URL.
 */
export default function Projekte() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { selectedCompany } = useCompany();
  const { state, set, reset } = useListState(DEFAULTS);
  const view = (PROJECT_VIEWS.some((v) => v.value === state.ansicht) ? state.ansicht : 'laufend') as ProjectView;
  const { data: projects = [], isLoading } = useProjects();
  const { data: customers = [] } = useCustomers();
  const time = useTimeSummary();
  const [editor, setEditor] = useState<{ project: Project | null } | null>(() => (state.neu === '1' ? { project: null } : null));

  useEffect(() => {
    if (state.neu) set({ neu: null });
    if (state.id) navigate(`/projekte/${state.id}`, { replace: true });
  }, [state.neu, state.id, set, navigate]);

  const rows: Row[] = useMemo(() => (projects as Row[]).map((p) => ({ ...p, stats: projectStats(p, time.rows) })), [projects, time.rows]);
  const q = state.q?.trim().toLowerCase();
  const filtered = rows.filter((p) => (!state.firma || p.customer_id === state.firma) && (!q || p.name.toLowerCase().includes(q) || (p.customers?.name ?? '').toLowerCase().includes(q)));
  const inView = filtered.filter((p) => matchesProjectView(p, view));
  const counts = Object.fromEntries(PROJECT_VIEWS.map((v) => [v.value, filtered.filter((p) => matchesProjectView(p, v.value)).length])) as Record<ProjectView, number>;
  const unbilled = rows.filter((r) => r.is_active).reduce((s, r) => s + r.stats.unbilledAmount, 0);

  if (!selectedCompany) return null;

  const setActive = async (p: Project, active: boolean) => {
    const { error } = await supabase.from('projects').update({ is_active: active }).eq('id', p.id);
    if (error) toast.error(error.message);
    else toast.success(active ? 'Projekt wiederhergestellt.' : 'Projekt archiviert.');
    await qc.invalidateQueries({ queryKey: ['projects'] });
  };

  const menu = (p: Row): RowMenuItem[] => [
    { label: 'Öffnen', onSelect: () => navigate(`/projekte/${p.id}`) },
    { label: 'Bearbeiten', onSelect: () => setEditor({ project: p }) },
    { label: 'Zeiten anzeigen', onSelect: () => navigate(`/zeiterfassung?ansicht=alle&projekt=${p.id}`) },
    { label: 'Archivieren', onSelect: () => setActive(p, false), hidden: !p.is_active },
    { label: 'Wiederherstellen', onSelect: () => setActive(p, true), hidden: p.is_active },
  ];

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Projekt',
      cell: (p) => (
        <span className="block max-w-[20rem]">
          <span className="block truncate font-semibold">{p.name}</span>
          <span className="block truncate text-xs text-fg-muted">{p.customers?.name ?? ''}</span>
        </span>
      ),
    },
    { key: 'status', header: 'Status', cell: (p) => <span className={PROJECT_STATUS_BADGE[p.status]}>{PROJECT_STATUS_LABEL[p.status]}</span> },
    {
      key: 'budget',
      header: 'Budget',
      cell: (p) =>
        p.budget ? (
          <span className="block w-40">
            <span className="mb-1 flex justify-between text-xs tabular-nums">
              <span>{formatChfDisplay(p.stats.amount, { decimals: 0 })}</span>
              <span className="text-fg-muted">von {formatChfDisplay(Number(p.budget), { decimals: 0 })}</span>
            </span>
            <ProgressBar percent={p.stats.budgetUsed ?? 0} level={p.stats.level} label={`Budget ${p.name}: ${formatPercent(p.stats.budgetUsed ?? 0)}`} />
          </span>
        ) : (
          <span className="text-fg-muted">ohne Budget</span>
        ),
    },
    { key: 'stunden', header: 'Stunden', align: 'right', cell: (p) => p.stats.hours.toFixed(2) },
    { key: 'offen', header: 'Nicht verrechnet', align: 'right', cell: (p) => (p.stats.unbilledHours ? <span className="text-attention">{formatHours(p.stats.unbilledHours)} · {formatChfDisplay(p.stats.unbilledAmount, { decimals: 0 })}</span> : <span className="text-fg-muted">–</span>) },
  ];

  return (
    <>
      <ListPage
        title="Projekte"
        summary={isLoading ? ' ' : `${counts.laufend} laufend${unbilled ? `, ${formatChfDisplay(unbilled, { decimals: 0 })} nicht verrechnet` : ''}.`}
        primary={
          <button type="button" className="btn-cta" onClick={() => setEditor({ project: null })}>
            <Plus size={18} aria-hidden="true" />
            Neues Projekt
          </button>
        }
        tabs={<ViewTabs tabs={PROJECT_VIEWS.map((v) => ({ ...v, count: counts[v.value] }))} value={view} onChange={(v) => set({ ansicht: v }, { push: true })} />}
        toolbar={
          <Toolbar filterCount={activeFilterCount(state, DEFAULTS)} onReset={reset}>
            <SearchField value={state.q ?? ''} onChange={(v) => set({ q: v })} placeholder="Projekt oder Firma suchen" />
            <FilterSelect label="Firma" allLabel="Alle Firmen" value={state.firma ?? ''} onChange={(v) => set({ firma: v })} options={customers.map((c) => ({ value: c.id, label: c.name }))} />
          </Toolbar>
        }
      >
        <DataTable
          rows={inView}
          rowKey={(p) => p.id}
          rowLabel={(p) => `Projekt ${p.name}`}
          columns={columns}
          onRowClick={(p) => navigate(`/projekte/${p.id}`)}
          menu={menu}
          loading={isLoading}
          mobile={(p) => ({
            title: p.name,
            subtitle: p.customers?.name ?? '',
            amount: p.stats.unbilledHours ? `${p.stats.unbilledHours.toFixed(1)} h offen` : undefined,
            badge: <span className={PROJECT_STATUS_BADGE[p.status]}>{PROJECT_STATUS_LABEL[p.status]}</span>,
          })}
          empty={<EmptyState icon={<Briefcase size={20} />} title="Keine Projekte in dieser Ansicht" />}
        />
      </ListPage>
      <ProjectEditor open={!!editor} project={editor?.project ?? null} onClose={() => setEditor(null)} />
    </>
  );
}
