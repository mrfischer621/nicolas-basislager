import toast from 'react-hot-toast';
import Modal from '../Modal';
import InvoiceForm from '../InvoiceForm';
import type { Invoice, InvoiceItem } from '../../lib/supabase';
import { useCompany } from '../../context/CompanyContext';
import { useCustomers, useProjects } from '../../hooks/queries';
import { useCompanySettings } from '../../hooks/useCompanySettings';
import { nextInvoiceNumber, saveInvoice, useInvalidateInvoices, useInvoiceSummary, type InvoiceFormData } from '../../hooks/useInvoices';
import { asError } from '../../utils/errors';

export type InvoiceEditorMode =
  | { kind: 'new'; preset?: { customerId: string; projectId?: string | null; items: Array<{ description: string; quantity: number; unit_price: number; timeEntryIds: string[] }> } }
  | { kind: 'edit'; invoice: Invoice; items: InvoiceItem[] }
  | { kind: 'copy'; invoice: Invoice; items: InvoiceItem[] };

/**
 * Rechnungsmaske als Dialog, gemeinsam fuer Liste, Detailseite und
 * Zeiterfassung (Sammelaktion "Rechnung erstellen").
 */
export function InvoiceEditor({ mode, onClose, onSaved }: { mode: InvoiceEditorMode | null; onClose: () => void; onSaved?: (id: string) => void }) {
  const { selectedCompany } = useCompany();
  const { data: customers = [] } = useCustomers();
  const { data: projects = [] } = useProjects();
  const { data: summary = [] } = useInvoiceSummary();
  const { data: settings } = useCompanySettings();
  const invalidate = useInvalidateInvoices();

  if (!mode || !selectedCompany) return null;
  const editing = mode.kind === 'edit' ? mode.invoice : null;
  // Auswahl: nur aktive Firmen und Projekte, ausser der gespeicherte Eintrag
  const keepCustomer = mode.kind === 'new' ? mode.preset?.customerId : mode.invoice.customer_id;
  const keepProject = mode.kind === 'new' ? mode.preset?.projectId : mode.invoice.project_id;
  const activeCustomers = customers.filter((c) => c.is_active !== false || c.id === keepCustomer);
  const activeProjects = projects.filter((p) => p.is_active !== false || p.id === keepProject);

  const submit = async (data: InvoiceFormData, totals: { subtotal: number; vat_amount: number; total: number }, timeEntryIds?: string[]) => {
    try {
      const { id, linkError } = await saveInvoice(selectedCompany.id, data, totals, editing?.id ?? null, timeEntryIds);
      await invalidate();
      if (linkError) toast.error(`Rechnung gespeichert, aber ${timeEntryIds?.length ?? 0} Zeiten konnten nicht verknüpft werden.`);
      else if (timeEntryIds?.length) toast.success(`Rechnung ${data.invoice.invoice_number} mit ${timeEntryIds.length} Zeiten gespeichert.`);
      else toast.success(`Rechnung ${data.invoice.invoice_number} gespeichert.`);
      onClose();
      onSaved?.(id);
    } catch (caught) {
      const err = asError(caught);
      toast.error(
        err.code === '23505'
          ? `Die Nummer ${data.invoice.invoice_number} gibt es schon. Wähl eine andere.`
          : `Rechnung nicht gespeichert: ${err.message}`
      );
      throw err;
    }
  };

  const title = mode.kind === 'edit' ? `Rechnung ${mode.invoice.invoice_number} bearbeiten` : mode.kind === 'copy' ? `Kopie von ${mode.invoice.invoice_number}` : 'Neue Rechnung';

  return (
    <Modal isOpen onClose={onClose} title={title} size="xl">
      <InvoiceForm
        onSubmit={submit}
        customers={activeCustomers}
        projects={activeProjects}
        nextInvoiceNumber={nextInvoiceNumber(summary.map((s) => s.invoice_number))}
        existingInvoice={mode.kind === 'edit' ? mode.invoice : undefined}
        existingItems={mode.kind === 'edit' ? mode.items : undefined}
        copyFrom={mode.kind === 'copy' ? { invoice: mode.invoice, items: mode.items } : undefined}
        preset={mode.kind === 'new' ? mode.preset : undefined}
        paymentTermsDays={settings?.payment_terms_days ?? 30}
      />
    </Modal>
  );
}
