import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Paperclip, Plus, Receipt } from 'lucide-react';
import {
  BulkBar,
  DataTable,
  Drawer,
  FilterSelect,
  ListPage,
  Notice,
  Pagination,
  PAGE_SIZE,
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
import Modal from '../components/Modal';
import TransactionForm from '../components/TransactionForm';
import { BookingDrawer } from '../components/bookings/BookingDrawer';
import { SupplierDialog } from '../components/bookings/SupplierDialog';
import { useConfirm } from '../context/ConfirmProvider';
import { useCompany } from '../context/CompanyContext';
import { useCategories, useCustomers, useProjects } from '../hooks/queries';
import { useFinanceEntries, useInvalidateFinance, useLockedYears } from '../hooks/useFinance';
import { supabase } from '../lib/supabase';
import type { Transaction } from '../lib/supabase';
import { zurichDay, type FinanceEntry } from '../utils/financeAggregation';
import { distinctCounterparties, supplierIdFor } from '../utils/transactionCategories';
import { formatChfDisplay } from '../utils/money';
import { formatDate } from '../utils/format';
import { asError } from '../utils/errors';
import { BOOKING_VIEWS, PERIODS, filterBookings, isIncomplete, matchesBookingView, missingParts, supplierGroups, type BookingView } from '../utils/bookings';

const DEFAULTS = { ansicht: 'alle', zeitraum: 'current_year' };

/** Eintrag der zentralen Aggregation fuer die Buchungsmaske. */
function toTransaction(e: FinanceEntry, companyId: string): Transaction {
  return {
    id: e.id,
    company_id: companyId,
    type: e.type,
    date: e.date,
    amount: e.amount,
    description: e.description,
    category: e.category,
    project_id: e.projectId,
    customer_id: e.customerId,
    invoice_id: e.invoiceId,
    document_url: null,
    receipt_url: e.receiptUrl,
    tags: e.tags.length > 0 ? e.tags : null,
    billable: false,
    transaction_number: e.number,
    created_at: '',
    counterparty: e.counterparty,
    is_recurring: !!e.recurrence,
    recurrence_interval: e.recurrence,
  };
}

/**
 * Buchungen: Ausgaben und Einnahmen mit Beleg. Die Liste kommt aus der
 * zentralen Aggregation (inkl. bezahlter Rechnungen als Einnahmen); bei
 * dieser Menge wird im Browser gefiltert, der Zustand steht in der URL.
 */
export default function Buchungen() {
  const confirm = useConfirm();
  const { selectedCompany } = useCompany();
  const { state, set, reset, page } = useListState(DEFAULTS);
  const view = (BOOKING_VIEWS.some((v) => v.value === state.ansicht) ? state.ansicht : 'alle') as BookingView;
  const today = zurichDay(new Date());
  const finance = useFinanceEntries();
  const invalidate = useInvalidateFinance();
  const { data: lockedYears = [] } = useLockedYears();
  const { data: customers = [] } = useCustomers();
  const { data: projects = [] } = useProjects();
  const { data: categories = [] } = useCategories();

  const all = useMemo(() => [...(finance.data?.entries ?? [])].reverse(), [finance.data]);
  const filtered = useMemo(() => filterBookings(all, state, today), [all, state, today]);
  const inView = filtered.filter((e) => matchesBookingView(e, view));
  const rows = inView.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selection = useSelection(rows.filter((r) => r.source === 'transaction').map((r) => r.id));
  const suppliers = useMemo(() => customers.filter((c) => c.is_supplier), [customers]);
  const known = useMemo(() => distinctCounterparties([...suppliers.map((c) => c.name), ...all.filter((e) => e.source === 'transaction').map((e) => e.counterparty)]), [all, suppliers]);
  const groups = useMemo(() => supplierGroups(all, known), [all, known]);

  // ?id= (alte Links, Suche) oeffnet die Buchung im Seitenpanel
  const [openId, setOpenId] = useState<string | null>(() => state.id ?? null);
  const open = openId ? all.find((e) => e.id === openId) ?? null : null;
  const setOpen = (e: FinanceEntry | null) => setOpenId(e?.id ?? null);
  const [editing, setEditing] = useState<Transaction | 'neu' | null>(() => (state.neu === '1' ? 'neu' : null));
  const [suppliersOpen, setSuppliersOpen] = useState(false);
  const [bulkSupplier, setBulkSupplier] = useState<string | null>(null);

  // ?neu=1 und ?id= nur beim Laden auswerten, danach aus der URL nehmen
  useEffect(() => {
    if (state.neu === '1' || state.id) set({ neu: null, id: null });
  }, [state.neu, state.id, set]);

  if (!selectedCompany) return null;
  const isLocked = (date: string) => lockedYears.includes(Number(date.slice(0, 4)));

  const counts = Object.fromEntries(BOOKING_VIEWS.map((v) => [v.value, filtered.filter((e) => matchesBookingView(e, v.value)).length])) as Record<BookingView, number>;
  const sums = { einnahmen: inView.filter((e) => e.type === 'einnahme').reduce((s, e) => s + e.amount, 0), ausgaben: inView.filter((e) => e.type === 'ausgabe').reduce((s, e) => s + e.amount, 0) };
  const incompleteAll = all.filter(isIncomplete).length;

  const save = async (form: Partial<Transaction>) => {
    if (form.date && isLocked(form.date)) {
      toast.error(`Das Jahr ${form.date.slice(0, 4)} ist abgeschlossen.`);
      throw new Error('locked');
    }
    // Lieferanten-Text eines erfassten Lieferanten verknuepft die Buchung mit ihm
    const data = { ...form, supplier_id: supplierIdFor(form.type, form.counterparty, suppliers) };
    const result =
      editing && editing !== 'neu'
        ? await supabase.from('transactions').update(data).eq('id', editing.id)
        : await supabase.from('transactions').insert([{ ...data, company_id: selectedCompany.id }]);
    if (result.error) {
      toast.error(result.error.message.includes('abgeschlossen') ? result.error.message : `Buchung nicht gespeichert: ${result.error.message}`);
      throw result.error;
    }
    toast.success('Buchung gespeichert.');
    setEditing(null);
    setOpen(null);
    await invalidate();
  };

  const remove = async (e: FinanceEntry) => {
    if (!(await confirm({ title: 'Buchung löschen', message: `${e.number ?? ''} ${formatChfDisplay(e.amount)} vom ${formatDate(e.date)} löschen?`, confirmLabel: 'Löschen', destructive: true }))) return;
    const { error } = await supabase.from('transactions').delete().eq('id', e.id);
    if (error) toast.error(error.message);
    else toast.success('Buchung gelöscht.');
    setOpen(null);
    await invalidate();
  };

  const setSupplier = async (ids: string[], name: string) => {
    const { error } = await supabase.from('transactions').update({ counterparty: name.trim() || null }).in('id', ids);
    if (!error) await supabase.from('transactions').update({ supplier_id: supplierIdFor('ausgabe', name, suppliers) }).in('id', ids).eq('type', 'ausgabe');
    if (error) toast.error(error.message);
    else toast.success(`Lieferant bei ${ids.length} ${ids.length === 1 ? 'Buchung' : 'Buchungen'} gesetzt.`);
    selection.clear();
    setBulkSupplier(null);
    await invalidate();
  };

  const menu = (e: FinanceEntry): RowMenuItem[] => [
    { label: 'Öffnen', onSelect: () => setOpen(e) },
    { label: 'Bearbeiten', onSelect: () => setEditing(toTransaction(e, selectedCompany.id)), hidden: e.source !== 'transaction' || isLocked(e.date) },
    { label: 'Löschen', onSelect: () => remove(e), danger: true, hidden: e.source !== 'transaction' || isLocked(e.date) },
  ];

  const columns: Column<FinanceEntry>[] = [
    { key: 'datum', header: 'Datum', cell: (e) => <span className="tabular-nums">{formatDate(e.date)}</span> },
    { key: 'nr', header: 'Nr', cell: (e) => <span className="text-fg-muted">{e.number ?? '–'}</span>, hideBelow: '2xl' },
    {
      key: 'text',
      header: 'Lieferant / Text',
      cell: (e) => (
        <span className="block max-w-[22rem]">
          <span className={`block truncate ${e.counterparty ? 'font-semibold' : 'text-warning'}`}>{e.counterparty ?? 'ohne Lieferant'}</span>
          <span className="block truncate text-xs text-fg-muted">{e.description ?? ''}</span>
        </span>
      ),
    },
    { key: 'kategorie', header: 'Kategorie', cell: (e) => (e.category ? <span className="badge-neutral">{e.category}</span> : <span className="badge-warning">fehlt</span>) },
    {
      key: 'beleg',
      header: 'Beleg',
      cell: (e) =>
        e.source === 'invoice' ? <span className="text-xs text-fg-muted">Rechnung</span> : e.receiptUrl ? <Paperclip size={15} className="text-fg-muted" aria-label="Beleg vorhanden" /> : e.type === 'ausgabe' ? <span className="badge-warning">fehlt</span> : '–',
    },
    {
      key: 'betrag',
      header: 'Betrag',
      align: 'right',
      cell: (e) => (
        <span className={e.type === 'einnahme' ? 'text-positive' : ''}>
          {e.type === 'einnahme' ? '+' : '−'} {formatChfDisplay(e.amount).replace('CHF ', '')}
        </span>
      ),
    },
  ];

  const filterCount = activeFilterCount(state, DEFAULTS);

  return (
    <>
      <ListPage
        title="Buchungen"
        summary={finance.isLoading ? ' ' : `${PERIODS.find((p) => p.value === state.zeitraum)?.label ?? 'Alle Zeiträume'}: Ausgaben ${formatChfDisplay(sums.ausgaben, { decimals: 0 })}, Einnahmen ${formatChfDisplay(sums.einnahmen, { decimals: 0 })}.`}
        primary={
          <button type="button" className="btn-cta" onClick={() => setEditing('neu')}>
            <Plus size={18} aria-hidden="true" />
            Neue Buchung
          </button>
        }
        notices={
          groups.length > 0 && (
            <Notice
              tone="info"
              action={
                <button type="button" className="btn-secondary min-h-[36px] py-1.5" onClick={() => setSuppliersOpen(true)}>
                  Lieferanten nachtragen
                </button>
              }
            >
              <strong>{groups.reduce((s, g) => s + g.ids.length, 0)} Buchungen ohne Lieferant.</strong> Ohne Lieferant fehlen sie in «Fixkosten» und «Ausgaben nach Lieferant».
            </Notice>
          )
        }
        tabs={<ViewTabs tabs={BOOKING_VIEWS.map((v) => ({ ...v, count: counts[v.value] }))} value={view} onChange={(v) => set({ ansicht: v }, { push: true })} />}
        toolbar={
          <Toolbar filterCount={filterCount} onReset={reset}>
            <SearchField value={state.q ?? ''} onChange={(q) => set({ q })} placeholder="Text, Lieferant oder Nr suchen" />
            <FilterSelect label="Zeitraum" allLabel="Alle Zeiträume" value={state.zeitraum === 'alle' ? '' : state.zeitraum ?? ''} onChange={(v) => set({ zeitraum: v || 'alle' })} options={PERIODS} />
            <FilterSelect label="Kategorie" allLabel="Alle Kategorien" value={state.kategorie ?? ''} onChange={(v) => set({ kategorie: v })} options={[{ value: '_ohne', label: 'Ohne Kategorie' }, ...categories.filter((c) => c.is_active).map((c) => ({ value: c.name, label: c.name }))]} />
            <FilterSelect label="Lieferant" allLabel="Alle Lieferanten" value={state.lieferant ?? ''} onChange={(v) => set({ lieferant: v })} options={[{ value: '_ohne', label: 'Ohne Lieferant' }, ...known.map((k) => ({ value: k, label: k }))]} />
          </Toolbar>
        }
        bulk={<BulkBar count={selection.count} onClear={selection.clear} actions={[{ label: 'Lieferant setzen', onClick: () => setBulkSupplier('') }]} />}
        pagination={<Pagination page={page} total={inView.length} onPage={(p) => set({ seite: String(p) })} />}
      >
        {incompleteAll > 0 && view !== 'unvollstaendig' && (
          <button type="button" onClick={() => set({ ansicht: 'unvollstaendig' }, { push: true })} className="block w-full border-b border-line px-4 py-2 text-left text-sm text-fg-muted hover:bg-canvas">
            {incompleteAll} {incompleteAll === 1 ? 'Ausgabe ist' : 'Ausgaben sind'} unvollständig (Beleg, Kategorie oder Lieferant fehlt). Anzeigen
          </button>
        )}
        <DataTable
          rows={rows}
          rowKey={(e) => e.id}
          rowLabel={(e) => `Buchung ${e.number ?? ''} ${formatDate(e.date)}`.trim()}
          columns={columns}
          selection={selection}
          selectable={(e) => e.source === 'transaction'}
          onRowClick={setOpen}
          menu={menu}
          loading={finance.isLoading}
          mobile={(e) => ({
            title: e.counterparty ?? e.description ?? 'ohne Lieferant',
            amount: `${e.type === 'einnahme' ? '+' : '−'} ${formatChfDisplay(e.amount)}`,
            subtitle: `${formatDate(e.date)}${e.category ? ` · ${e.category}` : ''}`,
            badge: isIncomplete(e) ? <span className="badge-warning">{missingParts(e).join(', ')} fehlt</span> : undefined,
          })}
          empty={
            view === 'unvollstaendig' ? (
              <EmptyState icon={<Receipt size={20} />} title="Alles vollständig." text="Jede Ausgabe hat Beleg, Kategorie und Lieferant." />
            ) : (
              <EmptyState
                title="Keine Buchungen in dieser Ansicht"
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
      </ListPage>

      <BookingDrawer entry={open} locked={!!open && isLocked(open.date)} onClose={() => setOpen(null)} onEdit={(e) => setEditing(toTransaction(e, selectedCompany.id))} onDelete={remove} />
      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={editing && editing !== 'neu' ? 'Buchung bearbeiten' : 'Neue Buchung'} size="lg">
        {editing !== null && (
          <TransactionForm
            transaction={editing === 'neu' ? undefined : editing}
            onSubmit={save}
            onCancel={() => setEditing(null)}
            customers={customers}
            projects={projects}
            counterpartySuggestions={known}
          />
        )}
      </Modal>
      <SupplierDialog open={suppliersOpen} onClose={() => setSuppliersOpen(false)} groups={groups} known={known} suppliers={suppliers} onSaved={() => void invalidate()} />
      <Drawer open={bulkSupplier !== null} onClose={() => setBulkSupplier(null)} title={`Lieferant für ${selection.count} Buchungen`}>
        <form
          className="space-y-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            void setSupplier(selection.ids, bulkSupplier ?? '').catch((caught) => toast.error(asError(caught).message ?? 'Fehler'));
          }}
        >
          <label htmlFor="bulk-lieferant" className="label">
            Lieferant
          </label>
          <input id="bulk-lieferant" list="bulk-lieferanten" className="input" value={bulkSupplier ?? ''} onChange={(ev) => setBulkSupplier(ev.target.value)} required />
          <datalist id="bulk-lieferanten">
            {known.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setBulkSupplier(null)}>
              Abbrechen
            </button>
            <button type="submit" className="btn-primary">
              Speichern
            </button>
          </div>
        </form>
      </Drawer>
    </>
  );
}
