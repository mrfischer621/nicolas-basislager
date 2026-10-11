import toast from 'react-hot-toast';
import Modal from '../Modal';
import QuoteForm from '../QuoteForm';
import QuoteToInvoiceModal from '../QuoteToInvoiceModal';
import type { Customer, Quote, QuoteItem } from '../../lib/supabase';
import { useCompany } from '../../context/CompanyContext';
import { useConfirm } from '../../context/ConfirmProvider';
import { useCustomers, useProjects } from '../../hooks/queries';
import { useCompanySettings } from '../../hooks/useCompanySettings';
import { nextInvoiceNumber, useInvoiceSummary } from '../../hooks/useInvoices';
import { convertQuote, saveQuote, suggestDealStage, useInvalidateQuotes, useQuoteSummary, type QuoteFormData } from '../../hooks/useQuotes';
import { updateOpportunities } from '../../hooks/usePipeline';
import { nextQuoteNumber } from '../../utils/quoteViews';
import { asError } from '../../utils/errors';

export type QuoteEditorMode =
  | { kind: 'new'; customerId?: string; opportunityId?: string }
  | { kind: 'edit'; quote: Quote; items: QuoteItem[] }
  | { kind: 'copy'; quote: Quote; items: QuoteItem[] }
  | { kind: 'convert'; quote: Quote; items: QuoteItem[]; customer: Customer };

/** Offerten-Maske und Umwandlung in eine Rechnung, gemeinsam fuer Liste und Detail. */
export function QuoteEditor({ mode, onClose, onSaved }: { mode: QuoteEditorMode | null; onClose: () => void; onSaved?: (kind: 'quote' | 'invoice', id: string) => void }) {
  const confirm = useConfirm();
  const { selectedCompany } = useCompany();
  const { data: customers = [] } = useCustomers();
  const { data: projects = [] } = useProjects();
  const { data: quoteSummary = [] } = useQuoteSummary();
  const { data: invoiceSummary = [] } = useInvoiceSummary();
  const { data: settings } = useCompanySettings();
  const invalidate = useInvalidateQuotes();
  if (!mode || !selectedCompany) return null;

  // Nach Statuswechsel: Phase des verknuepften Deals vorschlagen
  const followDeal = async (opportunityId: string | null | undefined, status: Quote['status']) => {
    if (!opportunityId) return;
    const s = await suggestDealStage(opportunityId, status);
    if (!s) return;
    if (await confirm({ title: 'Deal nachführen', message: `Deal in die Phase «${s.stageName}» verschieben?`, confirmLabel: 'Verschieben' })) {
      await updateOpportunities([opportunityId], { stage_id: s.stageId });
      await invalidate();
      toast.success(`Deal in «${s.stageName}» verschoben.`);
    }
  };

  if (mode.kind === 'convert') {
    return (
      <Modal isOpen onClose={onClose} title={`Offerte ${mode.quote.quote_number} in Rechnung umwandeln`} size="xl">
        <QuoteToInvoiceModal
          quote={mode.quote}
          items={mode.items}
          customer={mode.customer}
          nextInvoiceNumber={nextInvoiceNumber(invoiceSummary.map((i) => i.invoice_number))}
          paymentTermsDays={settings?.payment_terms_days ?? 30}
          onCancel={onClose}
          onConvert={async (data) => {
            try {
              const id = await convertQuote(selectedCompany.id, mode.quote, data);
              await invalidate();
              toast.success(`Rechnung ${data.invoiceNumber} als Entwurf erstellt.`);
              onClose();
              onSaved?.('invoice', id);
            } catch (caught) {
              throw new Error(asError(caught).message ?? 'Rechnung nicht erstellt');
            }
          }}
        />
      </Modal>
    );
  }

  const editing = mode.kind === 'edit' ? mode.quote : null;
  const keep = mode.kind === 'new' ? mode.customerId : mode.quote.customer_id;
  const submit = async (data: QuoteFormData, totals: { subtotal: number; vat_amount: number; total: number }) => {
    try {
      const id = await saveQuote(selectedCompany.id, data, totals, editing);
      await invalidate();
      toast.success(`Offerte ${data.quote.quote_number} gespeichert.`);
      onClose();
      onSaved?.('quote', id);
      if (!editing || editing.status !== data.quote.status) await followDeal(data.quote.opportunity_id, data.quote.status);
    } catch (caught) {
      const err = asError(caught);
      toast.error(err.code === '23505' ? `Die Nummer ${data.quote.quote_number} gibt es schon.` : `Offerte nicht gespeichert: ${err.message}`);
      throw err;
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={mode.kind === 'edit' ? `Offerte ${mode.quote.quote_number} bearbeiten` : mode.kind === 'copy' ? `Kopie von ${mode.quote.quote_number}` : 'Neue Offerte'} size="xl">
      <QuoteForm
        onSubmit={submit}
        customers={customers.filter((c) => c.is_active !== false || c.id === keep)}
        projects={projects.filter((p) => p.is_active !== false)}
        nextQuoteNumber={nextQuoteNumber(quoteSummary.map((q) => q.quote_number))}
        initialCustomerId={mode.kind === 'new' ? mode.customerId : undefined}
        initialOpportunityId={mode.kind === 'new' ? mode.opportunityId : undefined}
        existingQuote={mode.kind === 'edit' ? mode.quote : undefined}
        existingItems={mode.kind === 'edit' ? mode.items : undefined}
        copyFrom={mode.kind === 'copy' ? { quote: mode.quote, items: mode.items } : undefined}
      />
    </Modal>
  );
}
