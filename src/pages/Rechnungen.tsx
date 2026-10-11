import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FileText, Plus } from 'lucide-react';
import {
  BulkBar,
  DataTable,
  FilterSelect,
  KpiStrip,
  ListPage,
  Notice,
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
import { useCustomers, useProjects } from '../hooks/queries';
import {
  deleteInvoice,
  loadInvoiceItems,
  markInvoicesSent,
  prepareInvoicePdf,
  useInvalidateInvoices,
  useInvoiceList,
  useInvoiceSummary,
  type InvoiceRow,
} from '../hooks/useInvoices';
import { InvoiceEditor, type InvoiceEditorMode } from '../components/invoices/InvoiceEditor';
import { PaidDatesDialog } from '../components/invoices/PaidDatesDialog';
import { MarkPaidDrawer, type PaidTarget } from '../components/invoices/MarkPaidDrawer';
import { downloadInvoicePDF } from '../utils/pdfLazy';
import { zurichDay } from '../utils/financeAggregation';
import { formatChfDisplay } from '../utils/money';
import { formatDate } from '../utils/format';
import { asError } from '../utils/errors';
import {
  INVOICE_STATE_BADGE,
  INVOICE_STATE_LABEL,
  INVOICE_VIEWS,
  daysUntilDue,
  invoiceState,
  invoiceSummarySentence,
  summarizeInvoices,
  type InvoiceView,
} from '../utils/invoiceViews';

const DEFAULTS = { ansicht: 'alle', sort: '-issue_date' };

export default function Rechnungen() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { selectedCompany } = useCompany();
  const [searchParams] = useSearchParams();
  const { state, set, reset, page } = useListState(DEFAULTS);
  const view = (INVOICE_VIEWS.some((v) => v.value === state.ansicht) ? state.ansicht : 'alle') as InvoiceView;
  const today = zurichDay(new Date());

  const { data: customers = [] } = useCustomers();
  const { data: projects = [] } = useProjects();
  const summaryQuery = useInvoiceSummary();
  const listQuery = useInvoiceList(state, customers);
  const invalidate = useInvalidateInvoices();
  const summary = useMemo(() => summarizeInvoices(summaryQuery.data ?? [], today), [summaryQuery.data, today]);
  const rows = listQuery.data?.rows ?? [];
  const selection = useSelection(rows.map((r) => r.id));

  // ?neu=1 (Befehlspalette, Cockpit) oeffnet direkt die Maske
  const [editor, setEditor] = useState<InvoiceEditorMode | null>(() => (searchParams.get('neu') === '1' ? { kind: 'new' } : null));
  const [paidTargets, setPaidTargets] = useState<PaidTarget[]>([]);
  const [paidMode, setPaidMode] = useState<'markieren' | 'aendern'>('markieren');
  const [paidDatesOpen, setPaidDatesOpen] = useState(false);

  // Alte Deep Links: ?id= oeffnet die Detailseite, ?customerId= filtert nach Firma
  useEffect(() => {
    const id = searchParams.get('id');
    if (id) navigate(`/rechnungen/${id}`, { replace: true });
    const customerId = searchParams.get('customerId');
    if (customerId) set({ firma: customerId, customerId: null });
    if (searchParams.get('neu') === '1') set({ neu: null });
  }, [searchParams, navigate, set]);

  if (!selectedCompany) return null;

  const openPaid = (targets: InvoiceRow[], mode: 'markieren' | 'aendern' = 'markieren') => {
    setPaidMode(mode);
    setPaidTargets(targets.map((t) => ({ id: t.id, invoice_number: t.invoice_number, total: Number(t.total), issue_date: t.issue_date, paid_at: t.paid_at })));
  };

  const pdf = async (inv: InvoiceRow) => {
    try {
      const customer = customers.find((c) => c.id === inv.customer_id);
      await downloadInvoicePDF(await prepareInvoicePdf(inv, customer, selectedCompany.id));
    } catch (caught) {
      toast.error(`PDF nicht erstellt: ${asError(caught).message}`);
    }
  };

  const sent = async (ids: string[]) => {
    const result = await markInvoicesSent(selectedCompany.id, ids);
    await invalidate();
    selection.clear();
    if (result.failed.length) toast.error(`${result.failed.length} nicht gespeichert: ${result.failed[0].message}`);
    else toast.success(ids.length === 1 ? 'Als versendet gespeichert.' : `${result.saved} Rechnungen als versendet gespeichert.`);
  };

  const remove = async (inv: InvoiceRow) => {
    const ok = await confirm({
      title: `Rechnung ${inv.invoice_number} löschen`,
      message: 'Die Rechnung und ihre Positionen werden gelöscht. Verknüpfte Zeiten gelten danach wieder als nicht verrechnet.',
      confirmLabel: 'Löschen',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteInvoice(inv.id);
      await invalidate();
      toast.success(`Rechnung ${inv.invoice_number} gelöscht.`);
    } catch (caught) {
      toast.error(`Nicht gelöscht: ${asError(caught).message}`);
    }
  };

  const edit = async (inv: InvoiceRow, kind: 'edit' | 'copy') => {
    try {
      const items = await loadInvoiceItems(inv.id);
      setEditor({ kind, invoice: inv, items });
    } catch (caught) {
      toast.error(`Positionen nicht geladen: ${asError(caught).message}`);
    }
  };

  const menu = (inv: InvoiceRow): RowMenuItem[] => {
    const s = invoiceState(inv, today);
    const open = s === 'versendet' || s === 'ueberfaellig';
    return [
      { label: 'Öffnen', onSelect: () => navigate(`/rechnungen/${inv.id}`) },
      { label: 'Bearbeiten', onSelect: () => edit(inv, 'edit'), hidden: s === 'bezahlt' },
      { label: 'PDF herunterladen', onSelect: () => pdf(inv) },
      { label: 'Als versendet markieren', onSelect: () => sent([inv.id]), hidden: s !== 'entwurf' },
      { label: 'Als bezahlt markieren', onSelect: () => openPaid([inv]), hidden: !open && s !== 'entwurf' },
      { label: 'Zahlungsdatum ändern', onSelect: () => openPaid([inv], 'aendern'), hidden: s !== 'bezahlt' },
      { label: 'Kopie als neue Rechnung', onSelect: () => edit(inv, 'copy') },
      { label: 'Löschen', onSelect: () => remove(inv), danger: true, hidden: s === 'bezahlt' },
    ];
  };

  const dueCell = (inv: InvoiceRow) => {
    const s = invoiceState(inv, today);
    if (s === 'bezahlt') return <span className="tabular-nums text-fg-muted">{inv.paid_at ? `bezahlt ${formatDate(inv.paid_at)}` : 'bezahlt, Datum fehlt'}</span>;
    const d = daysUntilDue(inv.due_date, today);
    const hint = s === 'ueberfaellig' && d !== null ? `seit ${-d} ${d === -1 ? 'Tag' : 'Tagen'}` : s === 'versendet' && d !== null && d <= 7 ? (d === 0 ? 'heute' : `in ${d} ${d === 1 ? 'Tag' : 'Tagen'}`) : null;
    return (
      <span className="tabular-nums">
        {formatDate(inv.due_date)}
        {hint && <span className={`ml-2 text-xs ${s === 'ueberfaellig' ? 'text-negative' : 'text-attention'}`}>{hint}</span>}
      </span>
    );
  };

  const columns: Column<InvoiceRow>[] = [
    { key: 'nr', header: 'Nr', sortKey: 'invoice_number', cell: (r) => <span className="font-semibold">{r.invoice_number}</span> },
    {
      key: 'firma',
      header: 'Firma',
      cell: (r) => (
        <span className="block max-w-[14rem] truncate 2xl:max-w-[24rem]">
          {r.customers?.name ?? '–'}
          {r.title && <span className="ml-2 text-fg-muted">{r.title.length > 40 ? `${r.title.slice(0, 40)} …` : r.title}</span>}
        </span>
      ),
    },
    { key: 'datum', header: 'Datum', sortKey: 'issue_date', cell: (r) => <span className="tabular-nums">{formatDate(r.issue_date)}</span>, hideBelow: '2xl' },
    { key: 'faellig', header: 'Fällig', sortKey: 'due_date', cell: dueCell },
    { key: 'betrag', header: 'Betrag', sortKey: 'total', align: 'right', cell: (r) => formatChfDisplay(Number(r.total)) },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => {
        const s = invoiceState(r, today);
        return <span className={INVOICE_STATE_BADGE[s]}>{INVOICE_STATE_LABEL[s]}</span>;
      },
    },
  ];

  const selectedRows = rows.filter((r) => selection.isSelected(r.id));
  const selectedStates = selectedRows.map((r) => invoiceState(r, today));
  const filterCount = activeFilterCount(state, DEFAULTS);
  const years = [...new Set((summaryQuery.data ?? []).map((r) => r.issue_date.slice(0, 4)))].sort().reverse();
  const yearValue = state.von && state.bis && state.von.slice(0, 4) === state.bis.slice(0, 4) && state.von.endsWith('-01-01') && state.bis.endsWith('-12-31') ? state.von.slice(0, 4) : '';

  return (
    <>
      <ListPage
        title="Rechnungen"
        summary={summaryQuery.isLoading ? ' ' : invoiceSummarySentence(summary)}
        primary={
          <button type="button" className="btn-cta" onClick={() => setEditor({ kind: 'new' })}>
            <Plus size={18} aria-hidden="true" />
            Neue Rechnung
          </button>
        }
        notices={
          summary.missingPaidDate.length > 0 && (
            <Notice
              action={
                <button type="button" className="btn-secondary min-h-[36px] py-1.5" onClick={() => setPaidDatesOpen(true)}>
                  Zahlungsdaten nachtragen
                </button>
              }
            >
              <strong>
                {summary.missingPaidDate.length} bezahlte {summary.missingPaidDate.length === 1 ? 'Rechnung' : 'Rechnungen'} ohne Zahlungsdatum.
              </strong>{' '}
              Sie fehlen in Einnahmen und Berichten.
            </Notice>
          )
        }
        kpis={
          <KpiStrip
            items={[
              { key: 'offen', label: 'Offen', value: formatChfDisplay(summary.sums.versendet), hint: 'versendet, noch nicht fällig', onClick: () => set({ ansicht: 'versendet' }, { push: true }), active: view === 'versendet' },
              { key: 'ueberfaellig', label: 'Überfällig', value: formatChfDisplay(summary.sums.ueberfaellig), tone: summary.sums.ueberfaellig > 0 ? 'negative' : 'neutral', hint: `${summary.counts.ueberfaellig} ${summary.counts.ueberfaellig === 1 ? 'Rechnung' : 'Rechnungen'}`, onClick: () => set({ ansicht: 'ueberfaellig' }, { push: true }), active: view === 'ueberfaellig' },
              { key: 'bezahlt', label: `Bezahlt ${today.slice(0, 4)}`, value: formatChfDisplay(summary.paidThisYear), hint: 'nach Zahlungsdatum', onClick: () => set({ ansicht: 'bezahlt' }, { push: true }), active: view === 'bezahlt' },
              { key: 'entwurf', label: 'Entwürfe', value: String(summary.counts.entwurf), onClick: () => set({ ansicht: 'entwurf' }, { push: true }), active: view === 'entwurf' },
            ]}
          />
        }
        tabs={
          <ViewTabs
            tabs={INVOICE_VIEWS.map((v) => ({ ...v, count: summaryQuery.data ? summary.counts[v.value] : undefined }))}
            value={view}
            onChange={(v) => set({ ansicht: v }, { push: true })}
          />
        }
        toolbar={
          <Toolbar filterCount={filterCount} onReset={reset}>
            <SearchField value={state.q ?? ''} onChange={(q) => set({ q })} placeholder="Nr, Titel oder Firma suchen" />
            <FilterSelect label="Firma" allLabel="Alle Firmen" value={state.firma ?? ''} onChange={(v) => set({ firma: v })} options={customers.filter((c) => !c.is_supplier).map((c) => ({ value: c.id, label: c.name }))} />
            <FilterSelect label="Projekt" allLabel="Alle Projekte" value={state.projekt ?? ''} onChange={(v) => set({ projekt: v })} options={projects.map((p) => ({ value: p.id, label: p.name }))} />
            <FilterSelect
              label="Jahr"
              allLabel="Alle Jahre"
              value={yearValue}
              onChange={(y) => set({ von: y ? `${y}-01-01` : null, bis: y ? `${y}-12-31` : null })}
              options={years.map((y) => ({ value: y, label: y }))}
            />
            {state['ohne-zahlungsdatum'] === '1' && (
              <button type="button" className="badge-warning" onClick={() => set({ 'ohne-zahlungsdatum': null })}>
                Nur ohne Zahlungsdatum ✕
              </button>
            )}
          </Toolbar>
        }
        bulk={
          <BulkBar
            count={selection.count}
            onClear={selection.clear}
            actions={[
              {
                label: 'Als versendet markieren',
                onClick: () => sent(selection.ids),
                disabledReason: selectedStates.some((s) => s !== 'entwurf') ? 'Nur Entwürfe lassen sich als versendet markieren.' : undefined,
              },
              {
                label: 'Als bezahlt markieren',
                onClick: () => openPaid(selectedRows),
                disabledReason: selectedStates.some((s) => s === 'bezahlt') ? 'Die Auswahl enthält bereits bezahlte Rechnungen.' : undefined,
              },
            ]}
          />
        }
        pagination={<Pagination page={page} total={listQuery.data?.total ?? 0} onPage={(p) => set({ seite: String(p) })} />}
      >
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          rowLabel={(r) => `Rechnung ${r.invoice_number}`}
          columns={columns}
          selection={selection}
          onRowClick={(r) => navigate(`/rechnungen/${r.id}`)}
          menu={menu}
          sort={state.sort}
          onSort={(s) => set({ sort: s })}
          loading={listQuery.isLoading}
          mobile={(r) => {
            const s = invoiceState(r, today);
            return {
              title: `${r.invoice_number} · ${r.customers?.name ?? ''}`,
              amount: formatChfDisplay(Number(r.total)),
              subtitle: s === 'bezahlt' ? (r.paid_at ? `bezahlt ${formatDate(r.paid_at)}` : 'bezahlt, Datum fehlt') : `fällig ${formatDate(r.due_date)}`,
              badge: <span className={INVOICE_STATE_BADGE[s]}>{INVOICE_STATE_LABEL[s]}</span>,
            };
          }}
          empty={
            filterCount > 0 || view !== 'alle' ? (
              <EmptyState
                title="Keine Rechnungen in dieser Ansicht"
                text={view === 'ueberfaellig' ? 'Nichts überfällig.' : 'Ändere die Filter oder wechsle die Ansicht.'}
                action={
                  filterCount > 0 && (
                    <button type="button" className="btn-secondary" onClick={reset}>
                      Filter zurücksetzen
                    </button>
                  )
                }
              />
            ) : (
              <EmptyState
                icon={<FileText size={20} />}
                title="Noch keine Rechnungen"
                text="Erstelle die erste Rechnung oder übernimm offene Zeiten aus der Zeiterfassung."
                action={
                  <button type="button" className="btn-primary" onClick={() => setEditor({ kind: 'new' })}>
                    Neue Rechnung
                  </button>
                }
              />
            )
          }
        />
      </ListPage>

      <InvoiceEditor mode={editor} onClose={() => setEditor(null)} onSaved={(id) => navigate(`/rechnungen/${id}`)} />
      <MarkPaidDrawer
        targets={paidTargets}
        mode={paidMode}
        onClose={() => {
          setPaidTargets([]);
          selection.clear();
        }}
      />
      <PaidDatesDialog open={paidDatesOpen} onClose={() => setPaidDatesOpen(false)} invoices={summary.missingPaidDate} customers={customers} />
    </>
  );
}
