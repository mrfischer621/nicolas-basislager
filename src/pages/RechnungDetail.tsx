import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import { RecordHeader, SideCard, Timeline } from '../components/record/RecordHeader';
import { InvoiceEditor, type InvoiceEditorMode } from '../components/invoices/InvoiceEditor';
import { MarkPaidDrawer, type PaidTarget } from '../components/invoices/MarkPaidDrawer';
import { EmptyState } from '../components/ui';
import { useConfirm } from '../context/ConfirmProvider';
import { useCompany } from '../context/CompanyContext';
import { deleteInvoice, markInvoicesSent, prepareInvoicePdf, useInvalidateInvoices, useInvoice } from '../hooks/useInvoices';
import { downloadInvoicePDF, getInvoicePdfBlobUrl } from '../utils/pdfLazy';
import { zurichDay } from '../utils/financeAggregation';
import { formatChfDisplay } from '../utils/money';
import { formatDate, formatHours } from '../utils/format';
import { asError } from '../utils/errors';
import { INVOICE_STATE_BADGE, INVOICE_STATE_LABEL, daysUntilDue, invoiceState } from '../utils/invoiceViews';

/** Rechnung als Datensatzseite: Vorschau links, Zahlung, Verlauf und Verknuepfungen rechts. */
export default function RechnungDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { selectedCompany } = useCompany();
  const { data, isLoading, error } = useInvoice(id);
  const invalidate = useInvalidateInvoices();
  const [preview, setPreview] = useState<{ url: string | null; error: string | null }>({ url: null, error: null });
  const [editor, setEditor] = useState<InvoiceEditorMode | null>(null);
  const [paidTargets, setPaidTargets] = useState<PaidTarget[]>([]);
  const [paidMode, setPaidMode] = useState<'markieren' | 'aendern'>('markieren');
  const today = zurichDay(new Date());

  // PDF-Vorschau erzeugen; bei jeder Aenderung der Rechnung neu
  const invoice = data?.invoice;
  const stamp = invoice ? `${invoice.id}-${invoice.total}-${invoice.status}-${invoice.paid_at}-${invoice.due_date}` : '';
  useEffect(() => {
    if (!invoice || !selectedCompany) return;
    let url: string | null = null;
    let cancelled = false;
    prepareInvoicePdf(invoice, invoice.customers, selectedCompany.id)
      .then(getInvoicePdfBlobUrl)
      .then((u) => {
        url = u;
        if (!cancelled) setPreview({ url: u, error: null });
      })
      .catch((caught) => !cancelled && setPreview({ url: null, error: asError(caught).message ?? 'Unbekannter Fehler' }));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // stamp fasst die relevanten Felder zusammen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp, selectedCompany?.id]);

  if (isLoading) return <div className="skeleton h-96 w-full" aria-label="Wird geladen" />;
  if (error || !data || !invoice || !selectedCompany) {
    return (
      <EmptyState
        title="Rechnung nicht gefunden"
        text="Sie wurde gelöscht oder gehört zu einem anderen Unternehmen."
        action={
          <Link to="/rechnungen" className="btn-secondary">
            Zu den Rechnungen
          </Link>
        }
      />
    );
  }

  const s = invoiceState(invoice, today);
  const open = s === 'versendet' || s === 'ueberfaellig';
  const due = daysUntilDue(invoice.due_date, today);
  const hours = data.timeEntries.reduce((sum, t) => sum + Number(t.hours), 0);
  const paidTarget = (): PaidTarget => ({ id: invoice.id, invoice_number: invoice.invoice_number, total: Number(invoice.total), issue_date: invoice.issue_date, paid_at: invoice.paid_at });

  const download = async () => {
    try {
      await downloadInvoicePDF(await prepareInvoicePdf(invoice, invoice.customers, selectedCompany.id));
    } catch (caught) {
      toast.error(`PDF nicht erstellt: ${asError(caught).message}`);
    }
  };
  const sent = async () => {
    const r = await markInvoicesSent(selectedCompany.id, [invoice.id]);
    await invalidate();
    if (r.failed.length) toast.error(r.failed[0].message);
    else toast.success('Als versendet gespeichert.');
  };
  const remove = async () => {
    if (!(await confirm({ title: `Rechnung ${invoice.invoice_number} löschen`, message: 'Verknüpfte Zeiten gelten danach wieder als nicht verrechnet.', confirmLabel: 'Löschen', destructive: true }))) return;
    try {
      await deleteInvoice(invoice.id);
      await invalidate();
      toast.success(`Rechnung ${invoice.invoice_number} gelöscht.`);
      navigate('/rechnungen');
    } catch (caught) {
      toast.error(`Nicht gelöscht: ${asError(caught).message}`);
    }
  };

  const primary =
    s === 'entwurf' ? (
      <button type="button" className="btn-cta" onClick={sent}>
        Als versendet markieren
      </button>
    ) : open ? (
      <button
        type="button"
        className="btn-cta"
        onClick={() => {
          setPaidMode('markieren');
          setPaidTargets([paidTarget()]);
        }}
      >
        Als bezahlt markieren
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
        back={{ to: '/rechnungen', label: 'Rechnungen' }}
        title={invoice.invoice_number}
        status={<span className={INVOICE_STATE_BADGE[s]}>{INVOICE_STATE_LABEL[s]}</span>}
        subtitle={invoice.title ?? undefined}
        primary={primary}
        menu={[
          { label: 'Bearbeiten', onSelect: () => setEditor({ kind: 'edit', invoice, items: data.items }), hidden: s === 'bezahlt' },
          { label: 'PDF herunterladen', onSelect: download, hidden: s === 'bezahlt' },
          { label: 'Als bezahlt markieren', onSelect: () => setPaidTargets([paidTarget()]), hidden: s !== 'entwurf' },
          {
            label: 'Zahlungsdatum ändern',
            onSelect: () => {
              setPaidMode('aendern');
              setPaidTargets([paidTarget()]);
            },
            hidden: s !== 'bezahlt',
          },
          { label: 'Kopie als neue Rechnung', onSelect: () => setEditor({ kind: 'copy', invoice, items: data.items }) },
          { label: 'Löschen', onSelect: remove, danger: true, hidden: s === 'bezahlt' },
        ]}
        highlights={[
          { label: 'Betrag', value: formatChfDisplay(Number(invoice.total)) },
          { label: 'Firma', value: invoice.customers ? <Link className="hover:underline" to={`/kontakte/firmen/${invoice.customer_id}`}>{invoice.customers.name}</Link> : '–' },
          { label: 'Rechnungsdatum', value: formatDate(invoice.issue_date) },
          {
            label: s === 'bezahlt' ? 'Bezahlt am' : 'Fällig',
            value: s === 'bezahlt' ? (invoice.paid_at ? formatDate(invoice.paid_at) : 'fehlt') : formatDate(invoice.due_date),
            hint: s === 'ueberfaellig' && due !== null ? <span className="text-negative">seit {-due} Tagen überfällig</span> : invoice.paid_at_source === 'faelligkeit' ? 'aus Fälligkeit übernommen' : undefined,
          },
          { label: 'Projekt', value: invoice.projects?.name ?? '–' },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="overflow-hidden rounded-card bg-surface shadow-card xl:col-span-2" aria-label="Vorschau">
          {preview.url ? (
            <iframe title={`Vorschau ${invoice.invoice_number}`} src={preview.url} className="h-[80vh] w-full" />
          ) : preview.error ? (
            <EmptyState title="Vorschau nicht möglich" text={preview.error} />
          ) : (
            <div className="skeleton m-6 h-[60vh]" aria-label="Vorschau wird erstellt" />
          )}
        </section>

        <div className="space-y-6">
          <SideCard title="Verlauf">
            <Timeline
              events={[
                { key: 'erstellt', label: 'Erstellt', day: formatDate(invoice.created_at), done: true },
                { key: 'versendet', label: 'Versendet', day: invoice.sent_at ? formatDate(invoice.sent_at) : s === 'entwurf' ? null : 'Datum nicht erfasst', done: s !== 'entwurf' },
                { key: 'faellig', label: s === 'ueberfaellig' ? 'Fällig (überschritten)' : 'Fällig', day: formatDate(invoice.due_date), done: s === 'bezahlt' || s === 'ueberfaellig' },
                { key: 'bezahlt', label: 'Bezahlt', day: invoice.paid_at ? formatDate(invoice.paid_at) : s === 'bezahlt' ? 'Datum fehlt' : null, done: s === 'bezahlt' },
              ]}
            />
          </SideCard>

          <SideCard title="Verknüpft">
            <ul className="space-y-2 text-sm">
              <li>
                {data.timeEntries.length > 0 ? (
                  <Link className="hover:underline" to={`/zeiterfassung?ansicht=alle&rechnung=${invoice.id}`}>
                    {data.timeEntries.length} Zeiten, {formatHours(hours)}
                  </Link>
                ) : (
                  <span className="text-fg-muted">Keine Zeiten verknüpft</span>
                )}
              </li>
              <li>
                {data.quote ? (
                  <Link className="hover:underline" to={`/offerten/${data.quote.id}`}>
                    Aus Offerte {data.quote.quote_number}
                  </Link>
                ) : (
                  <span className="text-fg-muted">Ohne Offerte</span>
                )}
              </li>
              {invoice.is_recurring_revenue && <li className="badge-info">Wiederkehrender Umsatz</li>}
            </ul>
          </SideCard>

          <SideCard title="Positionen">
            <ul className="divide-y divide-line text-sm">
              {data.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 py-2">
                  <span className="line-clamp-2 min-w-0">{plainText(item.description)}</span>
                  <span className="shrink-0 tabular-nums">{formatChfDisplay(Number(item.total))}</span>
                </li>
              ))}
            </ul>
          </SideCard>
        </div>
      </div>

      <InvoiceEditor mode={editor} onClose={() => setEditor(null)} />
      <MarkPaidDrawer targets={paidTargets} mode={paidMode} onClose={() => setPaidTargets([])} />
    </div>
  );
}

/** Positionstexte sind Rich Text; fuer die Kurzliste nur der Text (React maskiert ihn). */
function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
