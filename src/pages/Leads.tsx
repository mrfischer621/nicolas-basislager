import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Clock, Plus, Search } from 'lucide-react';
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
  type RowMenuItem,
} from '../components/list';
import { EmptyState } from '../components/ui';
import { useConfirm } from '../context/ConfirmProvider';
import { useCompany } from '../context/CompanyContext';
import { OpportunityDrawer, type DrawerTarget } from '../components/pipeline/OpportunityDrawer';
import { createCompanyFromOpportunity, promoteLeads, setLeadStatus, useInvalidatePipeline, useLeadList, useLeadStatuses, usePipelineStages } from '../hooks/usePipeline';
import { supabase } from '../lib/supabase';
import type { LeadStatus } from '../lib/supabase';
import { zurichDay } from '../utils/financeAggregation';
import { formatDate } from '../utils/format';
import { asError } from '../utils/errors';
import {
  LEAD_STATUS_BADGE,
  LEAD_STATUS_LABEL,
  STALE_CONTACT_DAYS,
  daysSinceContact,
  isOverdueAction,
  leadCounts,
  opportunityCompany,
  opportunityPerson,
  type LeadView,
  type OpportunityRow,
} from '../utils/pipeline';

const DEFAULTS = { ansicht: 'neu', sort: 'next_action_date' };
const VIEWS: { value: LeadView; label: string }[] = [
  { value: 'neu', label: 'Neu' },
  { value: 'kontaktiert', label: 'Kontaktiert' },
  { value: 'kein_interesse', label: 'Kein Interesse' },
  { value: 'alle', label: 'Alle' },
];

/** Leads: noch nicht qualifizierte Interessenten als Liste, getrennt von den Deals. */
export default function Leads() {
  const confirm = useConfirm();
  const { selectedCompany } = useCompany();
  const { state, set, reset, page } = useListState(DEFAULTS);
  const view = (VIEWS.some((v) => v.value === state.ansicht) ? state.ansicht : 'neu') as LeadView;
  const today = zurichDay(new Date());
  const { data: stages = [] } = usePipelineStages();
  const statuses = useLeadStatuses();
  const list = useLeadList(state);
  const invalidate = useInvalidatePipeline();
  const rows = list.data?.rows ?? [];
  const selection = useSelection(rows.map((r) => r.id));
  const [drawer, setDrawer] = useState<DrawerTarget | null>(() => (state.neu === '1' ? { mode: 'new', kind: 'lead' } : null));
  const counts = useMemo(() => leadCounts(statuses.data ?? []), [statuses.data]);
  const dueToday = (statuses.data ?? []).filter((l) => (l.lead_status ?? 'neu') !== 'kein_interesse' && l.next_action_date && l.next_action_date <= today).length;

  useEffect(() => {
    if (state.neu) set({ neu: null });
  }, [state.neu, set]);

  if (!selectedCompany) return null;

  const act = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast.success(label);
      selection.clear();
    } catch (caught) {
      toast.error(asError(caught).message ?? 'Fehler');
    }
    await invalidate();
  };
  const status = (ids: string[], s: LeadStatus) => act(ids.length === 1 ? `Als «${LEAD_STATUS_LABEL[s]}» markiert.` : `${ids.length} Leads als «${LEAD_STATUS_LABEL[s]}» markiert.`, () => setLeadStatus(ids, s));
  const promote = (ids: string[]) => act(ids.length === 1 ? 'In die Pipeline übernommen.' : `${ids.length} Leads in die Pipeline übernommen.`, () => promoteLeads(ids, stages));

  const menu = (r: OpportunityRow): RowMenuItem[] => [
    { label: 'Öffnen', onSelect: () => setDrawer({ mode: 'edit', opportunity: r }) },
    { label: 'In Pipeline übernehmen', onSelect: () => promote([r.id]) },
    { label: 'Als kontaktiert markieren', onSelect: () => status([r.id], 'kontaktiert'), hidden: r.lead_status === 'kontaktiert' },
    { label: 'Kein Interesse', onSelect: () => status([r.id], 'kein_interesse'), hidden: r.lead_status === 'kein_interesse' },
    { label: 'Wieder als neu', onSelect: () => status([r.id], 'neu'), hidden: (r.lead_status ?? 'neu') === 'neu' },
    { label: 'Als Firma anlegen', onSelect: () => act('Als Firma angelegt.', () => createCompanyFromOpportunity(r, selectedCompany.id)), hidden: !r.prospect_info },
    {
      label: 'Löschen',
      danger: true,
      onSelect: async () => {
        if (!(await confirm({ title: 'Lead löschen', message: `«${opportunityCompany(r)}» wird gelöscht.`, confirmLabel: 'Löschen', destructive: true }))) return;
        await act('Lead gelöscht.', async () => {
          const { error } = await supabase.from('opportunities').delete().eq('id', r.id);
          if (error) throw error;
        });
      },
    },
  ];

  const nextCell = (r: OpportunityRow) => {
    if (!r.next_action_date) return <span className="text-fg-muted">–</span>;
    const overdue = isOverdueAction(r, today);
    return (
      <span className="inline-flex items-center gap-1.5 tabular-nums">
        {formatDate(r.next_action_date)}
        {overdue && <Clock size={14} className="text-attention" aria-label="Fällig" />}
      </span>
    );
  };
  const contactCell = (r: OpportunityRow) => {
    const d = daysSinceContact(r, today);
    if (d === null) return <span className="text-fg-muted">–</span>;
    return (
      <span className="tabular-nums" title={d >= STALE_CONTACT_DAYS ? `Letzter Kontakt vor ${d} Tagen` : undefined}>
        {formatDate(r.last_contact_at)}
        {d >= STALE_CONTACT_DAYS && <span className="ml-1.5 text-xs text-attention">vor {d} T.</span>}
      </span>
    );
  };

  const columns: Column<OpportunityRow>[] = [
    {
      key: 'firma',
      header: 'Firma',
      cell: (r) => (
        <span className="block max-w-[18rem]">
          <span className="block truncate font-semibold">{opportunityCompany(r)}</span>
          <span className="block truncate text-xs text-fg-muted">{r.title}</span>
        </span>
      ),
    },
    { key: 'person', header: 'Person', cell: (r) => <span className="block max-w-[10rem] truncate">{opportunityPerson(r) ?? '–'}</span>, hideBelow: '2xl' },
    { key: 'quelle', header: 'Quelle', cell: (r) => r.source ?? '–' },
    { key: 'kontakt', header: 'Letzter Kontakt', sortKey: 'last_contact_at', cell: contactCell },
    { key: 'next', header: 'Nächster Schritt', sortKey: 'next_action_date', cell: nextCell },
    { key: 'status', header: 'Status', cell: (r) => <span className={LEAD_STATUS_BADGE[r.lead_status ?? 'neu']}>{LEAD_STATUS_LABEL[r.lead_status ?? 'neu']}</span> },
  ];

  const sources = ['Recherche', 'Website', 'Empfehlung', 'Netzwerk', 'Veranstaltung'];
  const filterCount = activeFilterCount(state, DEFAULTS);

  return (
    <>
      <ListPage
        title="Leads"
        summary={statuses.isLoading ? ' ' : `${counts.neu} neu, ${counts.kontaktiert} kontaktiert${dueToday ? `, ${dueToday} mit fälligem nächsten Schritt` : ''}.`}
        primary={
          <button type="button" className="btn-cta" onClick={() => setDrawer({ mode: 'new', kind: 'lead' })}>
            <Plus size={18} aria-hidden="true" />
            Neuer Lead
          </button>
        }
        tabs={<ViewTabs tabs={VIEWS.map((v) => ({ ...v, count: statuses.data ? counts[v.value] : undefined }))} value={view} onChange={(v) => set({ ansicht: v }, { push: true })} />}
        toolbar={
          <Toolbar filterCount={filterCount} onReset={reset}>
            <SearchField value={state.q ?? ''} onChange={(q) => set({ q })} placeholder="Firma, Person oder Notiz suchen" />
            <FilterSelect label="Quelle" allLabel="Alle Quellen" value={state.quelle ?? ''} onChange={(v) => set({ quelle: v })} options={sources.map((s) => ({ value: s, label: s }))} />
          </Toolbar>
        }
        bulk={
          <BulkBar
            count={selection.count}
            onClear={selection.clear}
            actions={[
              { label: 'In Pipeline übernehmen', onClick: () => promote(selection.ids) },
              { label: 'Kontaktiert', onClick: () => status(selection.ids, 'kontaktiert') },
              { label: 'Kein Interesse', onClick: () => status(selection.ids, 'kein_interesse') },
            ]}
          />
        }
        pagination={<Pagination page={page} total={list.data?.total ?? 0} onPage={(p) => set({ seite: String(p) })} />}
      >
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          rowLabel={(r) => `Lead ${opportunityCompany(r)}`}
          columns={columns}
          selection={selection}
          onRowClick={(r) => setDrawer({ mode: 'edit', opportunity: r })}
          menu={menu}
          sort={state.sort}
          onSort={(s) => set({ sort: s })}
          loading={list.isLoading}
          mobile={(r) => ({
            title: opportunityCompany(r),
            subtitle: r.next_action_date ? `nächster Schritt ${formatDate(r.next_action_date)}` : r.title,
            badge: <span className={LEAD_STATUS_BADGE[r.lead_status ?? 'neu']}>{LEAD_STATUS_LABEL[r.lead_status ?? 'neu']}</span>,
          })}
          empty={
            filterCount > 0 ? (
              <EmptyState
                icon={<Search size={20} />}
                title="Keine Leads gefunden"
                action={
                  <button type="button" className="btn-secondary" onClick={reset}>
                    Filter zurücksetzen
                  </button>
                }
              />
            ) : (
              <EmptyState title={view === 'neu' ? 'Keine neuen Leads.' : 'Keine Leads in dieser Ansicht.'} text="Website-Anfragen landen automatisch hier." />
            )
          }
        />
      </ListPage>
      <OpportunityDrawer target={drawer} stages={stages} onClose={() => setDrawer(null)} />
    </>
  );
}
