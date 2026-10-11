import { useState } from 'react';
import { Download, Trash2, Pencil, Eye } from 'lucide-react';
import { zurichDay } from '../utils/financeAggregation';
import { formatChfDisplay } from '../utils/money';
import { EmptyState } from './ui';

const dmy = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;
import { useConfirm } from '../context/ConfirmProvider';
import type { Invoice, Customer } from '../lib/supabase';
import { canEditInvoice, getEditBlockedReason } from '../utils/invoiceUtils';

type InvoiceTableProps = {
  invoices: Invoice[];
  customers: Customer[];
  onDelete: (id: string) => Promise<void>;
  onDownloadPDF: (invoice: Invoice) => Promise<void>;
  onPreviewPDF: (invoice: Invoice) => Promise<void>;
  onEdit: (invoice: Invoice) => void;
  /** Zahlungsdatum einer bereits bezahlten Rechnung nachtragen (nur paid_at). */
  onSetPaidDate?: (invoice: Invoice, day: string) => Promise<void>;
};

/** Inline-Erfassung fuer bezahlte Rechnungen ohne Zahlungsdatum. */
function PaidDateInput({ invoice, onSave }: { invoice: Invoice; onSave: (invoice: Invoice, day: string) => Promise<void> }) {
  const [day, setDay] = useState(zurichDay(new Date()));
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="mt-2 flex items-center justify-center gap-1"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await onSave(invoice, day);
        } finally {
          setSaving(false);
        }
      }}
    >
      <input
        type="date"
        required
        value={day}
        onChange={(e) => setDay(e.target.value)}
        aria-label={`Zahlungsdatum für ${invoice.invoice_number}`}
        className="rounded border border-line-strong px-1.5 py-0.5 text-xs"
      />
      <button type="submit" disabled={saving} className="rounded px-1.5 py-0.5 text-xs font-medium underline disabled:opacity-50">
        {saving ? '…' : 'Speichern'}
      </button>
    </form>
  );
}

const statusColors = {
  entwurf: 'badge-neutral',
  versendet: 'badge-accent',
  bezahlt: 'badge-success',
  überfällig: 'badge-danger',
};

const statusLabels = {
  entwurf: 'Entwurf',
  versendet: 'Versendet',
  bezahlt: 'Bezahlt',
  überfällig: 'Überfällig',
};

export default function InvoiceTable({ invoices, customers, onDelete, onDownloadPDF, onPreviewPDF, onEdit, onSetPaidDate }: InvoiceTableProps) {
  const confirmDialog = useConfirm();
  const getCustomerName = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    return customer?.name || 'Unbekannt';
  };

  const handleDelete = async (id: string, invoiceNumber: string) => {
    if (await confirmDialog({ title: 'Rechnung löschen', confirmLabel: 'Löschen', message: `Möchten Sie die Rechnung "${invoiceNumber}" wirklich löschen?`, destructive: true })) {
      await onDelete(id);
    }
  };

  if (invoices.length === 0) {
    return (
      <div className="card">
        <EmptyState title="Keine Rechnungen" text="Erstelle die erste Rechnung mit «Neue Rechnung»." />
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line">
            <tr>
              <th scope="col" className="caps-sm whitespace-nowrap px-4 py-3 text-left">
                Rechnungsnummer
              </th>
              <th scope="col" className="caps-sm whitespace-nowrap px-4 py-3 text-left">
                Kunde
              </th>
              <th scope="col" className="caps-sm whitespace-nowrap px-4 py-3 text-left">
                Rechnungsdatum
              </th>
              <th scope="col" className="caps-sm whitespace-nowrap px-4 py-3 text-left">
                Fällig am
              </th>
              <th scope="col" className="caps-sm whitespace-nowrap px-4 py-3 text-right">
                Gesamttotal
              </th>
              <th scope="col" className="caps-sm whitespace-nowrap px-4 py-3 text-center">
                Status
              </th>
              <th scope="col" className="caps-sm whitespace-nowrap px-4 py-3 text-right">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="border-b border-line last:border-b-0 hover:bg-canvas">
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm font-medium text-fg">{invoice.invoice_number}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm text-fg-muted">{getCustomerName(invoice.customer_id)}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm text-fg-muted">
                    {dmy(invoice.issue_date)}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm text-fg-muted">
                    {invoice.due_date ? dmy(invoice.due_date) : '–'}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  <div className="text-sm font-medium text-fg">
                    {formatChfDisplay(invoice.total)}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-center">
                  <span className={statusColors[invoice.status]}>
                    {statusLabels[invoice.status]}
                  </span>
                  {invoice.status === 'bezahlt' && !invoice.paid_at && (
                    <>
                      <div className="mt-1 text-xs font-medium text-warning">Zahlungsdatum fehlt</div>
                      {onSetPaidDate && <PaidDateInput invoice={invoice} onSave={onSetPaidDate} />}
                    </>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => onEdit(invoice)}
                      disabled={!canEditInvoice(invoice.status)}
                      className="rounded-lg p-1.5 text-fg-muted transition hover:bg-raised hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
                      title={canEditInvoice(invoice.status) ? 'Bearbeiten' : getEditBlockedReason(invoice.status)}
                      aria-label={canEditInvoice(invoice.status) ? 'Bearbeiten' : getEditBlockedReason(invoice.status)}
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => onPreviewPDF(invoice)}
                      className="rounded-lg p-1.5 text-fg-muted transition hover:bg-raised hover:text-fg"
                      title="PDF Vorschau"
                      aria-label="PDF Vorschau"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => onDownloadPDF(invoice)}
                      className="rounded-lg p-1.5 text-fg-muted transition hover:bg-raised hover:text-fg"
                      title="PDF herunterladen"
                      aria-label="PDF herunterladen"
                    >
                      <Download size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(invoice.id, invoice.invoice_number)}
                      className="rounded-lg p-1.5 text-fg-muted transition hover:bg-danger-subtle hover:text-danger"
                      title="Löschen"
                      aria-label="Löschen"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
