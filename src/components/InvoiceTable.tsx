import { Download, Trash2, Pencil, Eye } from 'lucide-react';
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
};

const statusColors = {
  entwurf: 'bg-sage-100 text-sage-800',
  versendet: 'bg-brand-light text-brand-darker',
  bezahlt: 'bg-success-light text-success-dark',
  überfällig: 'bg-danger-light text-danger-dark',
};

const statusLabels = {
  entwurf: 'Entwurf',
  versendet: 'Versendet',
  bezahlt: 'Bezahlt',
  überfällig: 'Überfällig',
};

export default function InvoiceTable({ invoices, customers, onDelete, onDownloadPDF, onPreviewPDF, onEdit }: InvoiceTableProps) {
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
      <div className="bg-white rounded-lg shadow-sm p-6">
        <p className="text-content-tertiary text-center">Keine Rechnungen vorhanden. Erstellen Sie die erste Rechnung.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-sage-50 border-b border-surface-border">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-content-tertiary uppercase tracking-wider">
                Rechnungsnummer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-content-tertiary uppercase tracking-wider">
                Kunde
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-content-tertiary uppercase tracking-wider">
                Rechnungsdatum
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-content-tertiary uppercase tracking-wider">
                Fällig am
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-content-tertiary uppercase tracking-wider">
                Gesamttotal
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-content-tertiary uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-content-tertiary uppercase tracking-wider">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-sage-50 transition">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-content-heading">{invoice.invoice_number}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-content-secondary">{getCustomerName(invoice.customer_id)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-content-secondary">
                    {new Date(invoice.issue_date).toLocaleDateString('de-CH')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-content-secondary">
                    {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('de-CH') : '-'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm font-medium text-content-heading">
                    CHF {invoice.total.toFixed(2)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusColors[invoice.status]}`}>
                    {statusLabels[invoice.status]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => onEdit(invoice)}
                      disabled={!canEditInvoice(invoice.status)}
                      className="p-2 text-content-secondary hover:bg-sage-100 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                      title={canEditInvoice(invoice.status) ? 'Bearbeiten' : getEditBlockedReason(invoice.status)}
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => onPreviewPDF(invoice)}
                      className="p-2 text-brand hover:bg-brand-light rounded-lg transition"
                      title="PDF Vorschau"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => onDownloadPDF(invoice)}
                      className="p-2 text-brand hover:bg-sage-50 rounded-lg transition"
                      title="PDF herunterladen"
                    >
                      <Download size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(invoice.id, invoice.invoice_number)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Löschen"
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
