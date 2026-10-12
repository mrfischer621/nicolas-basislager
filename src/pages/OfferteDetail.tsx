import { PdfFrame } from '../components/PdfFrame';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import { RecordHeader, SideCard, Timeline } from '../components/record/RecordHeader';
import { QuoteEditor, type QuoteEditorMode } from '../components/quotes/QuoteEditor';
import { EmptyState } from '../components/ui';
import { useConfirm } from '../context/ConfirmProvider';
import { useCompany } from '../context/CompanyContext';
import { deleteQuote, prepareQuotePdf, setQuoteStatus, suggestDealStage, useInvalidateQuotes, useQuote } from '../hooks/useQuotes';
import { updateOpportunities } from '../hooks/usePipeline';
import { downloadQuotePDF, getQuotePdfBlobUrl } from '../utils/pdfLazy';
import { zurichDay } from '../utils/financeAggregation';
import { formatChfDisplay } from '../utils/money';
import { formatDate } from '../utils/format';
import { asError } from '../utils/errors';
import { QUOTE_STATE_BADGE, QUOTE_STATE_LABEL, quoteState } from '../utils/quoteViews';
import type { Quote } from '../lib/supabase';

/** Offerte als Datensatzseite mit Vorschau, Verlauf und Verknuepfungen. */
export default function OfferteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { selectedCompany } = useCompany();
  const { data, isLoading, error } = useQuote(id);
  const invalidate = useInvalidateQuotes();
  const [editor, setEditor] = useState<QuoteEditorMode | null>(null);
  const [preview, setPreview] = useState<{ url: string | null; error: string | null }>({ url: null, error: null });
  const today = zurichDay(new Date());
  const quote = data?.quote;
  const stamp = quote ? `${quote.id}-${quote.total}-${quote.status}-${quote.valid_until}-${quote.updated_at}` : '';

  useEffect(() => {
    if (!quote || !selectedCompany) return;
    let url: string | null = null;
    let cancelled = false;
    prepareQuotePdf(quote, quote.customers, selectedCompany.id)
      .then(getQuotePdfBlobUrl)
      .then((u) => {
        url = u;
        if (!cancelled) setPreview({ url: u, error: null });
      })
      .catch((caught) => !cancelled && setPreview({ url: null, error: asError(caught).message ?? 'Unbekannter Fehler' }));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp, selectedCompany?.id]);

  if (isLoading) return <div role="status" className="skeleton h-96" aria-label="Wird geladen" />;
  if (error || !data || !quote || !selectedCompany) {
    return <EmptyState title="Offerte nicht gefunden" action={<Link to="/offerten" className="btn-secondary">Zu den Offerten</Link>} />;
  }

  const s = quoteState(quote, today);
  const status = async (next: Quote['status']) => {
    try {
      await setQuoteStatus(quote.id, next, quote);
      await invalidate();
      toast.success('Status gespeichert.');
      if (quote.opportunity_id) {
        const sug = await suggestDealStage(quote.opportunity_id, next);
        if (sug && (await confirm({ title: 'Deal nachführen', message: `Deal in die Phase «${sug.stageName}» verschieben?`, confirmLabel: 'Verschieben' }))) {
          await updateOpportunities([quote.opportunity_id], { stage_id: sug.stageId });
          await invalidate();
        }
      }
    } catch (caught) {
      toast.error(asError(caught).message ?? 'Fehler');
    }
  };
  const download = async () => {
    try {
      await downloadQuotePDF(await prepareQuotePdf(quote, quote.customers, selectedCompany.id));
    } catch (caught) {
      toast.error(`PDF nicht erstellt: ${asError(caught).message}`);
    }
  };

  const primary =
    s === 'akzeptiert' && quote.customers ? (
      <button type="button" className="btn-cta" onClick={() => setEditor({ kind: 'convert', quote, items: data.items, customer: quote.customers! })}>
        In Rechnung umwandeln
      </button>
    ) : s === 'entwurf' ? (
      <button type="button" className="btn-cta" onClick={() => status('versendet')}>
        Als versendet markieren
      </button>
    ) : s === 'versendet' || s === 'abgelaufen' ? (
      <button type="button" className="btn-cta" onClick={() => status('akzeptiert')}>
        Als akzeptiert markieren
      </button>
    ) : (
      <button type="button" className="btn-secondary" onClick={download}>
        <Download size={16} aria-hidden="true" />
        PDF herunterladen
      </button>
    );

  return (
    <div className="space-y-6">
      <RecordHeader
        back={{ to: '/offerten', label: 'Offerten' }}
        title={quote.quote_number}
        status={<span className={QUOTE_STATE_BADGE[s]}>{QUOTE_STATE_LABEL[s]}</span>}
        primary={primary}
        menu={[
          { label: 'Bearbeiten', onSelect: () => setEditor({ kind: 'edit', quote, items: data.items }), hidden: s === 'umgewandelt' },
          { label: 'PDF herunterladen', onSelect: download },
          { label: 'Als abgelehnt markieren', onSelect: () => status('abgelehnt'), hidden: s !== 'versendet' && s !== 'abgelaufen' },
          { label: 'Kopie als neue Offerte', onSelect: () => setEditor({ kind: 'copy', quote, items: data.items }) },
          {
            label: 'Löschen',
            danger: true,
            hidden: s !== 'entwurf',
            onSelect: async () => {
              if (!(await confirm({ title: `Offerte ${quote.quote_number} löschen`, message: 'Die Offerte wird gelöscht.', confirmLabel: 'Löschen', destructive: true }))) return;
              await deleteQuote(quote.id);
              await invalidate();
              navigate('/offerten');
            },
          },
        ]}
        highlights={[
          { label: 'Betrag', value: formatChfDisplay(Number(quote.total)) },
          { label: 'Firma', value: quote.customers ? <Link className="hover:underline" to={`/kontakte/firmen/${quote.customer_id}`}>{quote.customers.name}</Link> : '–' },
          { label: 'Datum', value: formatDate(quote.issue_date) },
          { label: 'Gültig bis', value: formatDate(quote.valid_until), hint: s === 'abgelaufen' ? <span className="text-warning">abgelaufen</span> : undefined },
          { label: 'Projekt', value: quote.projects?.name ?? '–' },
        ]}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="min-w-0 overflow-hidden rounded-card bg-surface shadow-card xl:col-span-2" aria-label="Vorschau">
          {preview.url ? <PdfFrame title={`Vorschau ${quote.quote_number}`} url={preview.url} filename={`${quote.quote_number}.pdf`} /> : preview.error ? <EmptyState title="Vorschau nicht möglich" text={preview.error} /> : <div role="status" className="skeleton m-6 h-[60vh]"  aria-label="Wird geladen" />}
        </section>
        <div className="space-y-6">
          <SideCard title="Verlauf">
            <Timeline
              events={[
                { key: 'erstellt', label: 'Erstellt', day: formatDate(quote.created_at), done: true },
                { key: 'versendet', label: 'Versendet', day: quote.sent_at ? formatDate(quote.sent_at) : s === 'entwurf' ? null : 'Datum nicht erfasst', done: s !== 'entwurf' },
                { key: 'entscheid', label: s === 'abgelehnt' ? 'Abgelehnt' : s === 'abgelaufen' ? 'Abgelaufen' : 'Akzeptiert', day: null, done: ['akzeptiert', 'abgelehnt', 'abgelaufen', 'umgewandelt'].includes(s) },
                { key: 'rechnung', label: data.quote.invoices ? <Link className="underline" to={`/rechnungen/${data.quote.invoices.id}`}>Rechnung {data.quote.invoices.invoice_number}</Link> : 'In Rechnung umgewandelt', day: quote.converted_at ? formatDate(quote.converted_at) : null, done: s === 'umgewandelt' },
              ]}
            />
          </SideCard>
          <SideCard title="Verknüpft">
            <ul className="space-y-2 text-sm">
              <li>{data.quote.opportunities ? <Link className="hover:underline" to="/pipeline">Deal: {data.quote.opportunities.title}</Link> : <span className="text-fg-muted">Ohne Deal</span>}</li>
              {Number(quote.discount_value) > 0 && <li className="text-fg-muted">Rabatt {quote.discount_type === 'percent' ? `${quote.discount_value} %` : formatChfDisplay(Number(quote.discount_value))}</li>}
            </ul>
          </SideCard>
        </div>
      </div>
      <QuoteEditor mode={editor} onClose={() => setEditor(null)} onSaved={(kind, newId) => kind === 'invoice' ? navigate(`/rechnungen/${newId}`) : newId !== quote.id && navigate(`/offerten/${newId}`)} />
    </div>
  );
}
