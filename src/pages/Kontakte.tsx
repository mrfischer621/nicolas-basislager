import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Users } from 'lucide-react';
import { DataTable, ListPage, Pagination, SearchField, Toolbar, ViewTabs, activeFilterCount, useListState, type Column, type RowMenuItem } from '../components/list';
import { EmptyState, SegmentedControl } from '../components/ui';
import { CompanyEditor, PersonEditor } from '../components/contacts/Editors';
import { useConfirm } from '../context/ConfirmProvider';
import { useCompany } from '../context/CompanyContext';
import { useCompanyList, useInvalidateContacts, usePersonList, type PersonRow } from '../hooks/useContacts';
import { useFinanceEntries } from '../hooks/useFinance';
import { useInvoiceSummary } from '../hooks/useInvoices';
import { useCustomers } from '../hooks/queries';
import { supabase } from '../lib/supabase';
import type { Customer, CustomerContact } from '../lib/supabase';
import { filterRange, zurichDay } from '../utils/financeAggregation';
import { last12Months } from '../utils/cockpit';
import { incomeByCustomer } from '../utils/reports';
import { invoiceState } from '../utils/invoiceViews';
import { formatChfDisplay } from '../utils/money';

const STATUS_TABS = [
  { value: 'aktiv', label: 'Aktiv' },
  { value: 'archiviert', label: 'Archiviert' },
  { value: 'alle', label: 'Alle' },
];

/** Kontakte: Firmen und Personen mit Umschalter (bisher Kunden und Alle Kontakte). */
export default function Kontakte() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { selectedCompany } = useCompany();
  const { state, set, reset, page } = useListState({ ansicht: 'firmen', status: 'aktiv' });
  const view = state.ansicht === 'personen' ? 'personen' : 'firmen';
  const today = zurichDay(new Date());
  const companies = useCompanyList(view === 'firmen' ? state : { ...state, seite: '1' });
  const persons = usePersonList(view === 'personen' ? state : { ...state, seite: '1' });
  const { data: allCustomers = [] } = useCustomers();
  const finance = useFinanceEntries();
  const { data: invoices = [] } = useInvoiceSummary();
  const invalidate = useInvalidateContacts();
  const [companyEditor, setCompanyEditor] = useState<{ customer: Customer | null } | null>(() => (state.neu === '1' ? { customer: null } : null));
  const [personEditor, setPersonEditor] = useState<{ person: CustomerContact | null } | null>(null);

  useEffect(() => {
    if (state.neu) set({ neu: null });
  }, [state.neu, set]);

  const names = useMemo(() => new Map(allCustomers.map((c) => [c.id, c.name])), [allCustomers]);
  const revenue = useMemo(() => new Map(incomeByCustomer(filterRange(finance.data?.entries ?? [], last12Months(today)), names).map((r) => [r.key, r.amount])), [finance.data, names, today]);
  const open = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of invoices) {
      const s = invoiceState(i, today);
      if (s === 'versendet' || s === 'ueberfaellig') m.set(i.customer_id, (m.get(i.customer_id) ?? 0) + Number(i.total));
    }
    return m;
  }, [invoices, today]);

  if (!selectedCompany) return null;

  const setActive = async (c: Customer, active: boolean) => {
    const { error } = await supabase.from('customers').update({ is_active: active }).eq('id', c.id);
    if (error) toast.error(error.message);
    else toast.success(active ? `${c.name} wiederhergestellt.` : `${c.name} archiviert.`);
    await invalidate();
  };
  const removeCompany = async (c: Customer) => {
    if (!(await confirm({ title: `${c.name} löschen`, message: 'Endgültig löschen? Firmen mit Rechnungen, Offerten oder Projekten lassen sich nur archivieren.', confirmLabel: 'Löschen', destructive: true }))) return;
    const { error } = await supabase.from('customers').delete().eq('id', c.id);
    if (error) toast.error(error.code === '23503' ? `${c.name} hat noch verknüpfte Daten. Archiviere die Firma stattdessen.` : error.message);
    else toast.success(`${c.name} gelöscht.`);
    await invalidate();
  };

  const companyMenu = (c: Customer): RowMenuItem[] => [
    { label: 'Öffnen', onSelect: () => navigate(`/kontakte/firmen/${c.id}`) },
    { label: 'Bearbeiten', onSelect: () => setCompanyEditor({ customer: c }) },
    { label: 'Archivieren', onSelect: () => setActive(c, false), hidden: !c.is_active },
    { label: 'Wiederherstellen', onSelect: () => setActive(c, true), hidden: c.is_active },
    { label: 'Löschen', onSelect: () => removeCompany(c), danger: true },
  ];
  const personMenu = (p: PersonRow): RowMenuItem[] => [
    { label: 'Bearbeiten', onSelect: () => setPersonEditor({ person: p }) },
    { label: 'Zur Firma', onSelect: () => navigate(`/kontakte/firmen/${p.customer_id}`) },
    { label: 'E-Mail schreiben', onSelect: () => void (window.location.href = `mailto:${p.email}`), hidden: !p.email },
    {
      label: 'Löschen',
      danger: true,
      onSelect: async () => {
        if (!(await confirm({ title: `${p.name} löschen`, message: 'Die Person wird gelöscht.', confirmLabel: 'Löschen', destructive: true }))) return;
        await supabase.from('customer_contacts').delete().eq('id', p.id);
        await invalidate();
      },
    },
  ];

  const companyColumns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Firma',
      cell: (c) => (
        <span className="block max-w-[20rem]">
          <span className="block truncate font-semibold">{c.name}</span>
          <span className="block truncate text-xs text-fg-muted">{[c.city, c.contact_person].filter(Boolean).join(' · ')}</span>
        </span>
      ),
    },
    { key: 'kontakt', header: 'E-Mail', cell: (c) => <span className="block max-w-[14rem] truncate text-fg-muted">{c.email ?? '–'}</span>, hideBelow: '2xl' },
    { key: 'umsatz', header: 'Umsatz 12 Mte.', align: 'right', cell: (c) => (revenue.get(c.id) ? formatChfDisplay(revenue.get(c.id)!, { decimals: 0 }) : <span className="text-fg-muted">–</span>) },
    { key: 'offen', header: 'Offen', align: 'right', cell: (c) => (open.get(c.id) ? formatChfDisplay(open.get(c.id)!, { decimals: 0 }) : <span className="text-fg-muted">–</span>) },
    { key: 'status', header: 'Status', cell: (c) => (c.is_active ? <span className="badge-positive">Aktiv</span> : <span className="badge-neutral">Archiviert</span>) },
  ];
  const personColumns: Column<PersonRow>[] = [
    { key: 'name', header: 'Name', cell: (p) => <span className="font-semibold">{p.name}{p.is_primary && <span className="badge-info ml-2">Hauptperson</span>}</span> },
    { key: 'rolle', header: 'Funktion', cell: (p) => p.role ?? <span className="text-fg-muted">–</span> },
    { key: 'firma', header: 'Firma', cell: (p) => <span className="block max-w-[14rem] truncate">{p.customer.name}</span> },
    { key: 'mail', header: 'E-Mail', cell: (p) => (p.email ? <a className="hover:underline" href={`mailto:${p.email}`} onClick={(e) => e.stopPropagation()}>{p.email}</a> : '–') },
    { key: 'tel', header: 'Telefon', cell: (p) => (p.phone ? <a className="hover:underline" href={`tel:${p.phone}`} onClick={(e) => e.stopPropagation()}>{p.phone}</a> : '–'), hideBelow: '2xl' },
  ];

  const toggle = (
    <SegmentedControl
      label="Ansicht"
      value={view}
      onChange={(v) => set({ ansicht: v, status: null, q: null }, { push: true })}
      options={[
        { value: 'firmen', label: 'Firmen' },
        { value: 'personen', label: 'Personen' },
      ]}
    />
  );

  return (
    <>
      <ListPage
        title="Kontakte"
        summary={view === 'firmen' ? `${companies.data?.total ?? 0} ${state.status === 'archiviert' ? 'archivierte ' : state.status === 'alle' ? '' : 'aktive '}Firmen.` : `${persons.data?.total ?? 0} Personen.`}
        primary={
          <button type="button" className="btn-cta" onClick={() => (view === 'firmen' ? setCompanyEditor({ customer: null }) : setPersonEditor({ person: null }))}>
            <Plus size={18} aria-hidden="true" />
            {view === 'firmen' ? 'Neue Firma' : 'Neue Person'}
          </button>
        }
        tabs={view === 'firmen' ? <ViewTabs label="Status" tabs={STATUS_TABS} value={state.status ?? 'aktiv'} onChange={(v) => set({ status: v }, { push: true })} /> : undefined}
        toolbar={
          <Toolbar filterCount={activeFilterCount(state, { ansicht: 'firmen', status: 'aktiv' }) - (view === 'personen' ? 1 : 0)} onReset={reset}>
            {toggle}
            <SearchField value={state.q ?? ''} onChange={(q) => set({ q })} placeholder={view === 'firmen' ? 'Firma, Ort oder E-Mail suchen' : 'Name, Funktion oder E-Mail suchen'} />
          </Toolbar>
        }
        pagination={<Pagination page={page} total={(view === 'firmen' ? companies.data?.total : persons.data?.total) ?? 0} onPage={(p) => set({ seite: String(p) })} />}
      >
        {view === 'firmen' ? (
          <DataTable
            rows={companies.data?.rows ?? []}
            rowKey={(c) => c.id}
            rowLabel={(c) => `Firma ${c.name}`}
            columns={companyColumns}
            onRowClick={(c) => navigate(`/kontakte/firmen/${c.id}`)}
            menu={companyMenu}
            loading={companies.isLoading}
            mobile={(c) => ({ title: c.name, subtitle: c.city ?? '', amount: open.get(c.id) ? `${formatChfDisplay(open.get(c.id)!, { decimals: 0 })} offen` : undefined })}
            empty={<EmptyState icon={<Users size={20} />} title="Keine Firmen gefunden" />}
          />
        ) : (
          <DataTable
            rows={persons.data?.rows ?? []}
            rowKey={(p) => p.id}
            rowLabel={(p) => `Person ${p.name}`}
            columns={personColumns}
            onRowClick={(p) => setPersonEditor({ person: p })}
            menu={personMenu}
            loading={persons.isLoading}
            mobile={(p) => ({ title: p.name, subtitle: `${p.role ? `${p.role}, ` : ''}${p.customer.name}` })}
            empty={<EmptyState icon={<Users size={20} />} title="Keine Personen gefunden" />}
          />
        )}
      </ListPage>
      <CompanyEditor open={!!companyEditor} customer={companyEditor?.customer ?? null} onClose={() => setCompanyEditor(null)} onSaved={(id) => !companyEditor?.customer && navigate(`/kontakte/firmen/${id}`)} />
      <PersonEditor open={!!personEditor} person={personEditor?.person ?? null} onClose={() => setPersonEditor(null)} />
    </>
  );
}
