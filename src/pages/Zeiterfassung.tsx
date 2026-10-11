import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Clock } from 'lucide-react';
import {
  BulkBar,
  DataTable,
  FilterSelect,
  ListPage,
  Pagination,
  SearchField,
  Toolbar,
  ViewTabs,
  activeFilterCount,
  useListState,
  useSelection,
  type Column,
  type RowGroup,
  type RowMenuItem,
} from '../components/list';
import { EmptyState, SegmentedControl } from '../components/ui';
import { useConfirm } from '../context/ConfirmProvider';
import { useCompany } from '../context/CompanyContext';
import { useCustomers, useProjects } from '../hooks/queries';
import { projectIdsOf, useInvalidateTime, useTimeList, useTimeSummary } from '../hooks/useTimeEntries';
import { QuickTimeEntry } from '../components/time/QuickTimeEntry';
import { TimeEntryDrawer } from '../components/time/TimeEntryDrawer';
import { InvoiceEditor, type InvoiceEditorMode } from '../components/invoices/InvoiceEditor';
import { supabase } from '../lib/supabase';
import type { ManualTimeEntryStatus, TimeEntry } from '../lib/supabase';
import { addDays, zurichDay } from '../utils/financeAggregation';
import { formatChfDisplay } from '../utils/money';
import { formatDate, formatHours } from '../utils/format';
import {
  BILLING_BADGE,
  BILLING_LABEL,
  TIME_VIEWS,
  amount,
  billingState,
  buildInvoicePreset,
  groupTimeEntries,
  isUnbilled,
  matchesView,
  totals,
  type TimeGrouping,
  type TimeRow,
  type TimeView,
} from '../utils/timeEntries';

const TimeReporting = lazy(() => import('../components/TimeReporting'));

const DEFAULTS = { ansicht: 'offen', gruppe: 'woche', sort: '-date' };
const TABS = [...TIME_VIEWS, { value: 'auswertung', label: 'Auswertung' }];

export default function Zeiterfassung() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { selectedCompany } = useCompany();
  const { state, set, reset, page } = useListState(DEFAULTS);
  const view = (TABS.some((t) => t.value === state.ansicht) ? state.ansicht : 'offen') as TimeView | 'auswertung';
  const grouping = (['woche', 'firma', 'projekt'].includes(state.gruppe) ? state.gruppe : 'woche') as TimeGrouping;
  const today = zurichDay(new Date());

  const { data: customers = [] } = useCustomers();
  const { data: projects = [] } = useProjects();
  const activeProjects = projects.filter((p) => p.is_active);
  const summary = useTimeSummary();
  const list = useTimeList(state);
  const invalidate = useInvalidateTime();
  const selection = useSelection(list.rows.map((r) => r.id));
  const [editing, setEditing] = useState<TimeRow | null>(null);
  // ?neu=1 (Befehlspalette, Handy-Leiste): Schnellerfassung fokussieren
  const [focusEntry] = useState(() => state.neu === '1');
  useEffect(() => {
    if (state.neu) set({ neu: null });
  }, [state.neu, set]);
  const [editor, setEditor] = useState<InvoiceEditorMode | null>(null);

  // Gleiche Filter wie die Datenbankabfrage, fuer Tab-Zahlen und Gruppensummen
  const filtered = useMemo(() => {
    const projectIds = state.firma ? new Set(projectIdsOf(state.firma, projects)) : null;
    const q = state.q?.trim().toLowerCase();
    return summary.rows.filter(
      (e) =>
        (!state.projekt || e.project_id === state.projekt) &&
        (!projectIds || projectIds.has(e.project_id)) &&
        (!state.rechnung || e.invoice_id === state.rechnung) &&
        (!q || (e.description ?? '').toLowerCase().includes(q))
    );
  }, [summary.rows, state.firma, state.projekt, state.rechnung, state.q, projects]);

  const counts = useMemo(
    () => Object.fromEntries(TIME_VIEWS.map((v) => [v.value, filtered.filter((e) => matchesView(e, v.value, today)).length])) as Record<TimeView, number>,
    [filtered, today]
  );
  const inView = view === 'auswertung' ? [] : filtered.filter((e) => matchesView(e, view, today));
  const viewTotals = totals(inView);
  const groupTotals = new Map(groupTimeEntries(inView, grouping).map((g) => [g.key, g.totals]));
  const unbilled = totals(summary.rows.filter(isUnbilled));
  const staleUnbilled = summary.rows.filter((e) => isUnbilled(e) && e.date < addDays(today, -30)).length;

  if (!selectedCompany) return null;

  const setManual = async (ids: string[], status: ManualTimeEntryStatus | null) => {
    const { error } = await supabase.from('time_entries').update({ manual_status: status }).in('id', ids);
    if (error) toast.error(`Status nicht gespeichert: ${error.message}`);
    else toast.success(status === null ? 'Status wieder automatisch.' : `Als ${status} markiert.`);
    selection.clear();
    await invalidate();
  };
  const setBillable = async (ids: string[], billable: boolean) => {
    const { error } = await supabase.from('time_entries').update({ billable }).in('id', ids);
    if (error) toast.error(error.message);
    else toast.success(billable ? 'Als verrechenbar markiert.' : 'Als nicht verrechenbar markiert.');
    selection.clear();
    await invalidate();
  };
  const remove = async (row: TimeRow) => {
    const ok = await confirm({
      title: 'Zeit löschen',
      message: row.invoice_id ? 'Die Zeit steht auf einer Rechnung. Die Rechnung selbst bleibt unverändert.' : `${formatHours(Number(row.hours))} vom ${formatDate(row.date)} löschen?`,
      confirmLabel: 'Löschen',
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('time_entries').delete().eq('id', row.id);
    if (error) toast.error(error.message);
    else toast.success('Zeit gelöscht.');
    await invalidate();
  };

  const createInvoice = (rows: TimeRow[]) => {
    const r = buildInvoicePreset(rows);
    if (!r.ok) {
      toast.error(r.reason);
      return;
    }
    setEditor({ kind: 'new', preset: r.preset });
  };

  const menu = (row: TimeRow): RowMenuItem[] => [
    { label: 'Bearbeiten', onSelect: () => setEditing(row) },
    { label: `Rechnung ${row.invoice_number ?? ''} öffnen`.trim(), onSelect: () => navigate(`/rechnungen/${row.invoice_id}`), hidden: !row.invoice_id },
    { label: 'Rechnung erstellen', onSelect: () => createInvoice([row]), hidden: !isUnbilled(row) },
    { label: 'Als verrechnet markieren (ohne Rechnung)', onSelect: () => setManual([row.id], 'verrechnet'), hidden: !isUnbilled(row) },
    { label: 'Als bezahlt markieren (ohne Rechnung)', onSelect: () => setManual([row.id], 'bezahlt'), hidden: !isUnbilled(row) },
    { label: 'Status wieder automatisch', onSelect: () => setManual([row.id], null), hidden: row.manual_status === null },
    { label: 'Löschen', onSelect: () => remove(row), danger: true },
  ];

  const columns: Column<TimeRow>[] = [
    { key: 'datum', header: 'Datum', sortKey: 'date', cell: (r) => <span className="tabular-nums">{formatDate(r.date)}</span> },
    {
      key: 'projekt',
      header: 'Projekt und Tätigkeit',
      cell: (r) => (
        <span className="block max-w-[22rem] 2xl:max-w-[30rem]">
          <span className="block truncate">
            <span className="font-semibold">{r.projectName}</span>
            <span className="text-fg-muted"> · {r.customerName}</span>
          </span>
          <span className="block truncate text-xs text-fg-muted">{r.description || 'ohne Beschreibung'}</span>
        </span>
      ),
    },
    { key: 'stunden', header: 'Stunden', sortKey: 'hours', align: 'right', cell: (r) => Number(r.hours).toFixed(2) },
    { key: 'satz', header: 'Satz', align: 'right', cell: (r) => Number(r.rate).toFixed(0), hideBelow: '2xl' },
    { key: 'betrag', header: 'Betrag', align: 'right', cell: (r) => (r.billable ? formatChfDisplay(amount(r)) : <span className="text-fg-muted">–</span>) },
    { key: 'verrechenbar', header: 'Verrechenbar', cell: (r) => (r.billable ? 'Ja' : <span className="text-fg-muted">Nein</span>), hideBelow: '2xl' },
    {
      key: 'verrechnung',
      header: 'Verrechnung',
      cell: (r) => {
        const s = billingState(r);
        if (s === 'nicht_verrechenbar') return <span className="text-xs text-fg-muted">nicht verrechenbar</span>;
        const badge = <span className={BILLING_BADGE[s]}>{BILLING_LABEL[s]}</span>;
        return r.invoice_id ? (
          <Link to={`/rechnungen/${r.invoice_id}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-2 hover:underline">
            {badge}
            <span className="text-xs text-fg-muted">{r.invoice_number}</span>
          </Link>
        ) : (
          badge
        );
      },
    },
  ];

  const groups: RowGroup<TimeRow>[] = groupTimeEntries(list.rows, grouping).map((g) => {
    const t = groupTotals.get(g.key) ?? g.totals;
    return { key: g.key, label: g.label, rows: g.rows, summary: `${formatHours(t.hours)} · ${formatChfDisplay(t.amount)}` };
  });

  const selectedRows = list.rows.filter((r) => selection.isSelected(r.id));
  const preset = buildInvoicePreset(selectedRows);
  const filterCount = activeFilterCount(state, DEFAULTS);

  return (
    <>
      <ListPage
        title="Zeiterfassung"
        summary={
          summary.isLoading
            ? ' '
            : unbilled.count === 0
              ? 'Alle verrechenbaren Zeiten sind verrechnet.'
              : `${formatHours(unbilled.billableHours)} nicht verrechnet, ${formatChfDisplay(unbilled.amount)}${staleUnbilled ? `, davon ${staleUnbilled} älter als 30 Tage` : ''}.`
        }
        notices={<QuickTimeEntry projects={activeProjects} onSaved={() => void invalidate()} autoFocus={focusEntry} />}
        tabs={
          <ViewTabs
            tabs={TABS.map((t) => ({ ...t, count: t.value === 'auswertung' || summary.isLoading ? undefined : counts[t.value as TimeView] }))}
            value={view}
            onChange={(v) => set({ ansicht: v }, { push: true })}
          />
        }
        toolbar={
          view !== 'auswertung' && (
            <Toolbar filterCount={filterCount} onReset={reset}>
              <SearchField value={state.q ?? ''} onChange={(q) => set({ q })} placeholder="Tätigkeit suchen" />
              <FilterSelect label="Firma" allLabel="Alle Firmen" value={state.firma ?? ''} onChange={(v) => set({ firma: v, projekt: null })} options={customers.filter((c) => !c.is_supplier).map((c) => ({ value: c.id, label: c.name }))} />
              <FilterSelect
                label="Projekt"
                allLabel="Alle Projekte"
                value={state.projekt ?? ''}
                onChange={(v) => set({ projekt: v })}
                options={projects.filter((p) => !state.firma || p.customer_id === state.firma).map((p) => ({ value: p.id, label: p.name }))}
              />
              {state.rechnung && (
                <button type="button" className="badge-info" onClick={() => set({ rechnung: null })}>
                  Nur Zeiten einer Rechnung ✕
                </button>
              )}
              <div className="toolbar-collapsible ml-auto">
                <SegmentedControl
                  label="Gruppieren nach"
                  size="sm"
                  value={grouping}
                  onChange={(g) => set({ gruppe: g })}
                  options={[
                    { value: 'woche', label: 'Woche' },
                    { value: 'firma', label: 'Firma' },
                    { value: 'projekt', label: 'Projekt' },
                  ]}
                />
              </div>
            </Toolbar>
          )
        }
        bulk={
          <BulkBar
            count={selection.count}
            onClear={selection.clear}
            actions={[
              { label: 'Rechnung erstellen', onClick: () => createInvoice(selectedRows), disabledReason: preset.ok ? undefined : preset.reason },
              { label: 'Verrechenbar', onClick: () => setBillable(selection.ids, true) },
              { label: 'Nicht verrechenbar', onClick: () => setBillable(selection.ids, false) },
            ]}
          />
        }
        pagination={view !== 'auswertung' && <Pagination page={page} total={list.total} onPage={(p) => set({ seite: String(p) })} />}
      >
        {view === 'auswertung' ? (
          <div className="p-4 md:p-6">
            <Suspense fallback={<div className="skeleton h-64" />}>
              <TimeReporting entries={summary.rows as unknown as TimeEntry[]} projects={projects} />
            </Suspense>
          </div>
        ) : (
          <>
            {inView.length > 0 && (
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3 text-sm">
                <span className="font-display font-bold text-fg">
                  {TIME_VIEWS.find((v) => v.value === view)?.label}: {formatHours(viewTotals.hours)}
                  {viewTotals.hours !== viewTotals.billableHours && <span className="font-normal text-fg-muted"> (davon {formatHours(viewTotals.billableHours)} verrechenbar)</span>}
                </span>
                <span className="font-display font-bold tabular-nums text-fg">{formatChfDisplay(viewTotals.amount)}</span>
              </div>
            )}
            <DataTable
              rows={list.rows}
              groups={groups}
              rowKey={(r) => r.id}
              rowLabel={(r) => `Zeit ${formatDate(r.date)}, ${r.projectName}, ${Number(r.hours).toFixed(2)} Stunden`}
              columns={columns}
              selection={selection}
              onRowClick={setEditing}
              menu={menu}
              sort={state.sort}
              onSort={(s) => set({ sort: s })}
              loading={list.isLoading}
              mobile={(r) => {
                const s = billingState(r);
                return {
                  title: `${r.projectName}${r.description ? ` · ${r.description}` : ''}`,
                  amount: `${Number(r.hours).toFixed(2)} h`,
                  subtitle: `${formatDate(r.date)} · ${r.customerName}`,
                  badge: s === 'nicht_verrechenbar' ? <span className="text-xs">nicht verrechenbar</span> : <span className={BILLING_BADGE[s]}>{BILLING_LABEL[s]}</span>,
                };
              }}
              empty={
                view === 'offen' && filterCount === 0 ? (
                  <EmptyState icon={<Clock size={20} />} title="Alle Zeiten sind verrechnet." text="Neue Zeiten erfasst du oben oder mit dem Timer." />
                ) : (
                  <EmptyState
                    title="Keine Zeiten in dieser Ansicht"
                    action={
                      filterCount > 0 && (
                        <button type="button" className="btn-secondary" onClick={reset}>
                          Filter zurücksetzen
                        </button>
                      )
                    }
                  />
                )
              }
            />
          </>
        )}
      </ListPage>

      <TimeEntryDrawer entry={editing} projects={projects} onClose={() => setEditing(null)} onSaved={() => void invalidate()} />
      <InvoiceEditor
        mode={editor}
        onClose={() => setEditor(null)}
        onSaved={() => {
          selection.clear();
          void invalidate();
        }}
      />
    </>
  );
}
