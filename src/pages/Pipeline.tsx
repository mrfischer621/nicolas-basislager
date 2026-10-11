import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { Clock, Plus, Hourglass } from 'lucide-react';
import { DataTable, ListPage, RowMenu, useListState, type Column, type RowMenuItem } from '../components/list';
import { EmptyState, SegmentedControl } from '../components/ui';
import { useCompany } from '../context/CompanyContext';
import { OpportunityDrawer, type DrawerTarget } from '../components/pipeline/OpportunityDrawer';
import { updateOpportunities, useDeals, useInvalidatePipeline, usePipelineStages } from '../hooks/usePipeline';
import { zurichDay } from '../utils/financeAggregation';
import { formatChfDisplay } from '../utils/money';
import { formatDate } from '../utils/format';
import { asError } from '../utils/errors';
import {
  STALE_CONTACT_DAYS,
  boardStages,
  columnSummaries,
  daysSinceContact,
  isDueAction,
  isOverdueAction,
  opportunityCompany,
  weightedPipeline,
  type ColumnSummary,
  type OpportunityRow,
} from '../utils/pipeline';

const DEFAULTS = { darstellung: 'board' };

/** Pipeline: Deals ab Erstgespraech als Board oder Tabelle. */
export default function Pipeline() {
  const { selectedCompany } = useCompany();
  const { state, set } = useListState(DEFAULTS);
  const today = zurichDay(new Date());
  const { data: stages = [], isLoading: stagesLoading } = usePipelineStages();
  const { data: allDeals = [], isLoading } = useDeals();
  const invalidate = useInvalidatePipeline();
  const [drawer, setDrawer] = useState<DrawerTarget | null>(() => (state.neu === '1' ? { mode: 'new', kind: 'deal' } : null));
  const [showWon, setShowWon] = useState(false);
  const [dragging, setDragging] = useState<OpportunityRow | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  const showLost = state.verloren === '1';
  const onlyDue = state.ansicht === 'faellig';
  const deals = useMemo(() => allDeals.filter((d) => !onlyDue || isDueAction(d, today)), [allDeals, onlyDue, today]);
  const columns = useMemo(() => columnSummaries(stages, deals, { showLost }), [stages, deals, showLost]);
  const total = weightedPipeline(stages, allDeals, today);
  const dueCount = allDeals.filter((d) => !d.is_lost && isDueAction(d, today)).length;
  const table = state.darstellung === 'tabelle';

  useEffect(() => {
    if (state.neu) set({ neu: null });
  }, [state.neu, set]);

  if (!selectedCompany) return null;

  const move = async (deal: OpportunityRow, stageId: string) => {
    if (deal.stage_id === stageId) return;
    const target = stages.find((s) => s.id === stageId);
    try {
      await updateOpportunities([deal.id], { stage_id: stageId, last_contact_at: new Date().toISOString() });
      toast.success(`${opportunityCompany(deal)}: ${target?.name ?? 'neue Phase'}`);
    } catch (caught) {
      toast.error(asError(caught).message ?? 'Nicht verschoben');
    }
    await invalidate();
  };

  const menu = (d: OpportunityRow): RowMenuItem[] => {
    const ordered = boardStages(stages);
    const idx = ordered.findIndex((s) => s.id === d.stage_id);
    const next = ordered[idx + 1];
    return [
      { label: 'Öffnen', onSelect: () => setDrawer({ mode: 'edit', opportunity: d }) },
      { label: next ? `Weiter zu ${next.name}` : 'Weiter', onSelect: () => move(d, next.id), hidden: !next || d.is_lost },
      {
        label: d.is_lost ? 'Reaktivieren' : 'Als verloren markieren',
        onSelect: async () => {
          await updateOpportunities([d.id], { is_lost: !d.is_lost });
          await invalidate();
          toast.success(d.is_lost ? 'Wieder aktiv.' : 'Als verloren markiert.');
        },
      },
    ];
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const stageId = e.over ? String(e.over.id).replace('stage-', '') : null;
    const deal = allDeals.find((d) => d.id === e.active.id);
    if (deal && stageId) void move(deal, stageId);
  };

  const header = (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl
        label="Darstellung"
        size="sm"
        value={table ? 'tabelle' : 'board'}
        onChange={(v) => set({ darstellung: v })}
        options={[
          { value: 'board', label: 'Board' },
          { value: 'tabelle', label: 'Tabelle' },
        ]}
      />
      <button type="button" aria-pressed={onlyDue} onClick={() => set({ ansicht: onlyDue ? null : 'faellig' })} className={`btn min-h-[34px] px-3 py-1 ${onlyDue ? 'toggle-on' : 'btn-ghost'}`}>
        Nur fällige Aktionen{dueCount ? ` (${dueCount})` : ''}
      </button>
      <button type="button" aria-pressed={showLost} onClick={() => set({ verloren: showLost ? null : '1' })} className={`btn min-h-[34px] px-3 py-1 ${showLost ? 'toggle-on' : 'btn-ghost'}`}>
        Verlorene anzeigen
      </button>
    </div>
  );

  const tableColumns: Column<OpportunityRow>[] = [
    {
      key: 'firma',
      header: 'Firma',
      cell: (d) => (
        <span className="block max-w-[18rem]">
          <span className="block truncate font-semibold">{opportunityCompany(d)}</span>
          <span className="block truncate text-xs text-fg-muted">{d.title}</span>
        </span>
      ),
    },
    {
      key: 'phase',
      header: 'Phase',
      cell: (d) => (
        <span>
          {stages.find((s) => s.id === d.stage_id)?.name ?? '–'}
          {d.is_lost && <span className="badge-negative ml-2">Verloren</span>}
        </span>
      ),
    },
    { key: 'betrag', header: 'Betrag', align: 'right', cell: (d) => (d.expected_value ? formatChfDisplay(Number(d.expected_value)) : <span className="text-fg-muted">–</span>) },
    {
      key: 'gewichtet',
      header: 'Gewichtet',
      align: 'right',
      hideBelow: '2xl',
      cell: (d) => {
        const p = stages.find((s) => s.id === d.stage_id)?.probability ?? 0;
        return d.expected_value ? formatChfDisplay((Number(d.expected_value) * p) / 100) : '–';
      },
    },
    { key: 'next', header: 'Nächste Aktion', cell: (d) => <NextAction deal={d} today={today} /> },
    { key: 'kontakt', header: 'Letzter Kontakt', cell: (d) => <span className="tabular-nums">{formatDate(d.last_contact_at)}</span> },
  ];

  return (
    <>
      <ListPage
        title="Pipeline"
        summary={
          stagesLoading || isLoading
            ? ' '
            : total.count === 0
              ? 'Keine offenen Deals. Übernimm einen Lead oder leg einen Deal an.'
              : `${total.count} offene ${total.count === 1 ? 'Deal' : 'Deals'}, ${formatChfDisplay(total.open, { decimals: 0 })}, gewichtet ${formatChfDisplay(total.weighted, { decimals: 0 })}.`
        }
        primary={
          <button type="button" className="btn-cta" onClick={() => setDrawer({ mode: 'new', kind: 'deal' })}>
            <Plus size={18} aria-hidden="true" />
            Neuer Deal
          </button>
        }
        toolbar={header}
      >
        {table ? (
          <DataTable
            rows={columns.flatMap((c) => c.deals)}
            rowKey={(d) => d.id}
            rowLabel={(d) => `Deal ${opportunityCompany(d)}`}
            columns={tableColumns}
            onRowClick={(d) => setDrawer({ mode: 'edit', opportunity: d })}
            menu={menu}
            loading={isLoading}
            mobile={(d) => ({
              title: opportunityCompany(d),
              amount: d.expected_value ? formatChfDisplay(Number(d.expected_value), { decimals: 0 }) : undefined,
              subtitle: `${stages.find((s) => s.id === d.stage_id)?.name ?? ''}${d.next_action_date ? ` · ${formatDate(d.next_action_date)}` : ''}`,
            })}
            empty={<EmptyState title="Keine Deals" text={onlyDue ? 'Keine fälligen Aktionen.' : 'Übernimm einen Lead oder leg einen Deal an.'} />}
          />
        ) : (
          <DndContext sensors={sensors} onDragStart={(e) => setDragging(allDeals.find((d) => d.id === e.active.id) ?? null)} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
            <div className="scrollbar-thin overflow-x-auto p-3">
              <div className="grid min-w-max gap-3" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(11.5rem, 1fr))` }}>
                {columns.map((col) => (
                  <BoardColumn
                    key={col.stage.id}
                    column={col}
                    today={today}
                    collapsed={!!col.stage.is_won && col.count > 3 && !showWon}
                    onExpand={() => setShowWon(true)}
                    onOpen={(d) => setDrawer({ mode: 'edit', opportunity: d })}
                    onAdd={() => setDrawer({ mode: 'new', kind: 'deal', stageId: col.stage.id })}
                    menu={menu}
                  />
                ))}
              </div>
            </div>
            <DragOverlay>{dragging ? <DealCard deal={dragging} today={today} overlay /> : null}</DragOverlay>
          </DndContext>
        )}
      </ListPage>
      <OpportunityDrawer target={drawer} stages={stages} onClose={() => setDrawer(null)} />
    </>
  );
}

function BoardColumn({
  column,
  today,
  collapsed,
  onExpand,
  onOpen,
  onAdd,
  menu,
}: {
  column: ColumnSummary;
  today: string;
  collapsed: boolean;
  onExpand: () => void;
  onOpen: (d: OpportunityRow) => void;
  onAdd: () => void;
  menu: (d: OpportunityRow) => RowMenuItem[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage-${column.stage.id}` });
  const { stage } = column;
  return (
    <section ref={setNodeRef} aria-label={`Phase ${stage.name}`} className={`flex min-h-[18rem] flex-col rounded-tile p-2 transition-colors ${isOver ? 'bg-accent-subtle' : 'bg-canvas'}`}>
      <header className="mb-2 px-1.5 pt-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-bold text-fg">
            {stage.name} <span className="ml-1 rounded-badge bg-raised px-1.5 text-xs text-fg-muted">{column.count}</span>
          </h2>
          {!stage.is_won && (
            <button type="button" onClick={onAdd} className="rounded-lg p-1 text-fg-muted hover:bg-raised hover:text-fg" aria-label={`Neuer Deal in ${stage.name}`}>
              <Plus size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="text-xs tabular-nums text-fg-muted">
          {formatChfDisplay(column.sum, { decimals: 0 })}
          {!stage.is_won && stage.probability != null && column.sum > 0 && <> · gewichtet {formatChfDisplay(column.weighted, { decimals: 0 })}</>}
        </p>
      </header>
      {collapsed ? (
        <button type="button" onClick={onExpand} className="btn-ghost w-full text-sm">
          {column.count} gewonnene anzeigen
        </button>
      ) : (
        <ul className="space-y-2">
          {column.deals.map((d) => (
            <li key={d.id}>
              <DraggableCard deal={d} today={today} onOpen={() => onOpen(d)} menu={menu(d)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DraggableCard({ deal, today, onOpen, menu }: { deal: OpportunityRow; today: string; onOpen: () => void; menu: RowMenuItem[] }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });
  return (
    <div ref={setNodeRef} className={isDragging ? 'opacity-40' : ''}>
      <DealCard deal={deal} today={today} onOpen={onOpen} menu={menu} dragProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

/** Kompakte Karte: Firma, Titel, Betrag, naechste Aktion; Aktionen im Menue. */
function DealCard({
  deal,
  today,
  onOpen,
  menu,
  dragProps,
  overlay,
}: {
  deal: OpportunityRow;
  today: string;
  onOpen?: () => void;
  menu?: RowMenuItem[];
  dragProps?: Record<string, unknown>;
  overlay?: boolean;
}) {
  const stale = daysSinceContact(deal, today);
  return (
    <article className={`group relative rounded-lg bg-surface p-3 shadow-card ${overlay ? 'shadow-lg' : ''} ${deal.is_lost ? 'opacity-60' : ''}`}>
      <button type="button" onClick={onOpen} {...dragProps} className="block w-full cursor-grab text-left active:cursor-grabbing" aria-label={`Deal ${opportunityCompany(deal)} öffnen`}>
        <p className="truncate pr-7 font-display text-sm font-bold text-fg">{opportunityCompany(deal)}</p>
        <p className="truncate text-xs text-fg-muted">{deal.title}</p>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <span className={`tabular-nums ${deal.expected_value ? 'font-semibold text-fg' : 'text-fg-muted'}`}>
            {deal.expected_value ? formatChfDisplay(Number(deal.expected_value), { decimals: 0 }) : 'ohne Betrag'}
          </span>
          <NextAction deal={deal} today={today} />
        </div>
        {deal.is_lost && <span className="badge-negative mt-2">Verloren</span>}
      </button>
      {stale !== null && stale >= STALE_CONTACT_DAYS && !deal.is_lost && (
        <span className="absolute bottom-3 right-24 text-attention" title={`Letzter Kontakt vor ${stale} Tagen`} aria-label={`Letzter Kontakt vor ${stale} Tagen`}>
          <Hourglass size={13} aria-hidden="true" />
        </span>
      )}
      {menu && (
        <div className="absolute right-1 top-1">
          <RowMenu items={menu} label={`Aktionen für ${opportunityCompany(deal)}`} />
        </div>
      )}
    </article>
  );
}

function NextAction({ deal, today }: { deal: OpportunityRow; today: string }) {
  if (!deal.next_action_date) return <span className="text-fg-muted">–</span>;
  const overdue = isOverdueAction(deal, today);
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${overdue ? 'text-attention' : 'text-fg-muted'}`} title={overdue ? 'Nächste Aktion fällig' : 'Nächste Aktion'}>
      {overdue && <Clock size={13} aria-hidden="true" />}
      {formatDate(deal.next_action_date).slice(0, 6)}
    </span>
  );
}
