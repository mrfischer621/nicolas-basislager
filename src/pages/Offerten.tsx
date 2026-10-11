import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FileSpreadsheet, Plus } from 'lucide-react';
import { DataTable, FilterSelect, KpiStrip, ListPage, Pagination, SearchField, Toolbar, ViewTabs, activeFilterCount, useListState, type Column, type RowMenuItem } from '../components/list';
import { EmptyState } from '../components/ui';
import { QuoteEditor, type QuoteEditorMode } from '../components/quotes/QuoteEditor';
import { useConfirm } from '../context/ConfirmProvider';
import { useCompany } from '../context/CompanyContext';
import { useCustomers } from '../hooks/queries';
import { deleteQuote, loadQuoteItems, prepareQuotePdf, setQuoteStatus, useInvalidateQuotes, useQuoteList, useQuoteSummary, type QuoteRow } from '../hooks/useQuotes';
import { downloadQuotePDF } from '../utils/pdfLazy';
import { zurichDay } from '../utils/financeAggregation';
import { formatChfDisplay } from '../utils/money';
import { formatDate, formatPercent } from '../utils/format';
import { asError } from '../utils/errors';
import { QUOTE_STATE_BADGE, QUOTE_STATE_LABEL, QUOTE_VIEWS, quoteState, summarizeQuotes, type QuoteView } from '../utils/quoteViews';

const DEFAULTS = { ansicht: 'alle', sort: '-issue_date' };

export default function Offerten() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { selectedCompany } = useCompany();
  const { state, set, reset, page } = useListState(DEFAULTS);
  const view = (QUOTE_VIEWS.some((v) => v.value === state.ansicht) ? state.ansicht : 'alle') as QuoteView;
  const today = zurichDay(new Date());
  const { data: customers = [] } = useCustomers();
  const summaryQ = useQuoteSummary();
  const list = useQuoteList(state, customers);
  const invalidate = useInvalidateQuotes();
  const summary = useMemo(() => summarizeQuotes(summaryQ.data ?? [], today), [summaryQ.data, today]);
  const rows = list.data?.rows ?? [];

  // ?neu=1 (Befehlspalette), ?customerId=&opportunityId= (aus dem Deal)
  const [editor, setEditor] = useState<QuoteEditorMode | null>(() =>
    state.neu === '1' || state.customerId ? { kind: 'new', customerId: state.customerId, opportunityId: state.opportunityId } : null
  );
  useEffect(() => {
    if (state.neu || state.customerId || state.opportunityId) set({ neu: null, customerId: null, opportunityId: null });
    if (state.id) navigate(`/offerten/${state.id}`, { replace: true });
  }, [state.neu, state.customerId, state.opportunityId, state.id, set, navigate]);

  if (!selectedCompany) return null;

  const withItems = async (q: QuoteRow, kind: 'edit' | 'copy' | 'convert') => {
    try {
      const items = await loadQuoteItems(q.id);
      if (kind === 'convert') {
        const customer = customers.find((c) => c.id === q.customer_id);
        if (!customer) throw new Error('Firma nicht gefunden');
        setEditor({ kind, quote: q, items, customer });
      } else setEditor({ kind, quote: q, items });
    } catch (caught) {
      toast.error(asError(caught).message ?? 'Fehler');
    }
  };
  const status = async (q: QuoteRow, s: QuoteRow['status']) => {
    try {
      await setQuoteStatus(q.id, s, q);
      await invalidate();
      toast.success(`Offerte ${q.quote_number}: ${s === 'versendet' ? 'versendet' : s === 'akzeptiert' ? 'akzeptiert' : 'abgelehnt'}.`);
    } catch (caught) {
      toast.error(asError(caught).message ?? 'Fehler');
    }
  };
  const pdf = async (q: QuoteRow) => {
    try {
      await downloadQuotePDF(await prepareQuotePdf(q, customers.find((c) => c.id === q.customer_id), selectedCompany.id));
    } catch (caught) {
      toast.error(`PDF nicht erstellt: ${asError(caught).message}`);
    }
  };

  const menu = (q: QuoteRow): RowMenuItem[] => {
    const s = quoteState(q, today);
    return [
      { label: 'Öffnen', onSelect: () => navigate(`/offerten/${q.id}`) },
      { label: 'In Rechnung umwandeln', onSelect: () => withItems(q, 'convert'), hidden: s !== 'akzeptiert' },
      { label: 'Bearbeiten', onSelect: () => withItems(q, 'edit'), hidden: s === 'umgewandelt' },
      { label: 'PDF herunterladen', onSelect: () => pdf(q) },
      { label: 'Als versendet markieren', onSelect: () => status(q, 'versendet'), hidden: s !== 'entwurf' },
      { label: 'Als akzeptiert markieren', onSelect: () => status(q, 'akzeptiert'), hidden: s !== 'versendet' && s !== 'abgelaufen' },
      { label: 'Als abgelehnt markieren', onSelect: () => status(q, 'abgelehnt'), hidden: s !== 'versendet' && s !== 'abgelaufen' },
      { label: 'Kopie als neue Offerte', onSelect: () => withItems(q, 'copy') },
      {
        label: 'Löschen',
        danger: true,
        hidden: s !== 'entwurf',
        onSelect: async () => {
          if (!(await confirm({ title: `Offerte ${q.quote_number} löschen`, message: 'Die Offerte und ihre Positionen werden gelöscht.', confirmLabel: 'Löschen', destructive: true }))) return;
          await deleteQuote(q.id);
          await invalidate();
          toast.success('Offerte gelöscht.');
        },
      },
    ];
  };

  const columns: Column<QuoteRow>[] = [
    { key: 'nr', header: 'Nr', sortKey: 'quote_number', cell: (q) => <span className="font-semibold">{q.quote_number}</span> },
    { key: 'firma', header: 'Firma', cell: (q) => <span className="block max-w-[18rem] truncate">{q.customers?.name ?? '–'}</span> },
    { key: 'datum', header: 'Datum', sortKey: 'issue_date', cell: (q) => <span className="tabular-nums">{formatDate(q.issue_date)}</span> },
    { key: 'gueltig', header: 'Gültig bis', sortKey: 'valid_until', cell: (q) => <span className="tabular-nums">{formatDate(q.valid_until)}</span>, hideBelow: '2xl' },
    { key: 'betrag', header: 'Betrag', sortKey: 'total', align: 'right', cell: (q) => formatChfDisplay(Number(q.total)) },
    {
      key: 'status',
      header: 'Status',
      cell: (q) => {
        const s = quoteState(q, today);
        return <span className={QUOTE_STATE_BADGE[s]}>{QUOTE_STATE_LABEL[s]}</span>;
      },
    },
  ];

  const filterCount = activeFilterCount(state, DEFAULTS);

  return (
    <>
      <ListPage
        title="Offerten"
        summary={summaryQ.isLoading ? ' ' : `${summary.counts.versendet} versendet über ${formatChfDisplay(summary.sums.versendet, { decimals: 0 })}${summary.counts.akzeptiert ? `, ${summary.counts.akzeptiert} akzeptiert und noch nicht verrechnet` : ''}.`}
        primary={
          <button type="button" className="btn-cta" onClick={() => setEditor({ kind: 'new' })}>
            <Plus size={18} aria-hidden="true" />
            Neue Offerte
          </button>
        }
        kpis={
          <KpiStrip
            items={[
              { key: 'versendet', label: 'Offen', value: formatChfDisplay(summary.sums.versendet), hint: 'versendet, gültig', onClick: () => set({ ansicht: 'versendet' }, { push: true }), active: view === 'versendet' },
              { key: 'akzeptiert', label: 'Akzeptiert', value: formatChfDisplay(summary.sums.akzeptiert), hint: 'noch nicht umgewandelt', tone: summary.counts.akzeptiert ? 'positive' : 'neutral', onClick: () => set({ ansicht: 'akzeptiert' }, { push: true }), active: view === 'akzeptiert' },
              { key: 'quote', label: 'Annahmequote', value: summary.acceptance !== null ? formatPercent(summary.acceptance) : '–', hint: 'letzte 12 Monate' },
              { key: 'entwurf', label: 'Entwürfe', value: String(summary.counts.entwurf), onClick: () => set({ ansicht: 'entwurf' }, { push: true }), active: view === 'entwurf' },
            ]}
          />
        }
        tabs={<ViewTabs tabs={QUOTE_VIEWS.map((v) => ({ ...v, count: summaryQ.data ? summary.counts[v.value] : undefined }))} value={view} onChange={(v) => set({ ansicht: v }, { push: true })} />}
        toolbar={
          <Toolbar filterCount={filterCount} onReset={reset}>
            <SearchField value={state.q ?? ''} onChange={(q) => set({ q })} placeholder="Nr oder Firma suchen" />
            <FilterSelect label="Firma" allLabel="Alle Firmen" value={state.firma ?? ''} onChange={(v) => set({ firma: v })} options={customers.map((c) => ({ value: c.id, label: c.name }))} />
          </Toolbar>
        }
        pagination={<Pagination page={page} total={list.data?.total ?? 0} onPage={(p) => set({ seite: String(p) })} />}
      >
        <DataTable
          rows={rows}
          rowKey={(q) => q.id}
          rowLabel={(q) => `Offerte ${q.quote_number}`}
          columns={columns}
          onRowClick={(q) => navigate(`/offerten/${q.id}`)}
          menu={menu}
          sort={state.sort}
          onSort={(s) => set({ sort: s })}
          loading={list.isLoading}
          mobile={(q) => {
            const s = quoteState(q, today);
            return { title: `${q.quote_number} · ${q.customers?.name ?? ''}`, amount: formatChfDisplay(Number(q.total)), subtitle: `gültig bis ${formatDate(q.valid_until)}`, badge: <span className={QUOTE_STATE_BADGE[s]}>{QUOTE_STATE_LABEL[s]}</span> };
          }}
          empty={
            filterCount > 0 || view !== 'alle' ? (
              <EmptyState title="Keine Offerten in dieser Ansicht" action={filterCount > 0 && <button type="button" className="btn-secondary" onClick={reset}>Filter zurücksetzen</button>} />
            ) : (
              <EmptyState icon={<FileSpreadsheet size={20} />} title="Noch keine Offerten" text="Erstelle eine Offerte oder starte sie aus einem Deal in der Pipeline." />
            )
          }
        />
      </ListPage>
      <QuoteEditor mode={editor} onClose={() => setEditor(null)} onSaved={(kind, id) => navigate(kind === 'invoice' ? `/rechnungen/${id}` : `/offerten/${id}`)} />
    </>
  );
}
