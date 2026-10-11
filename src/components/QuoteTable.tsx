import { Download, Trash2, FileCheck, Pencil, Eye } from 'lucide-react';
import { useConfirm } from '../context/ConfirmProvider';
import type { Quote, Customer } from '../lib/supabase';
import { canEditQuote, getEditBlockedReason } from '../utils/quoteUtils';

type QuoteTableProps = {
  quotes: Quote[];
  customers: Customer[];
  onDelete: (id: string) => Promise<void>;
  onDownloadPDF: (quote: Quote) => Promise<void>;
  onPreviewPDF: (quote: Quote) => Promise<void>;
  onConvertToInvoice: (quote: Quote) => void;
  onEdit?: (quote: Quote) => void;
};

const statusColors: Record<Quote['status'], string> = {
  offen: 'bg-raised text-fg',
  versendet: 'bg-accent-subtle text-accent',
  akzeptiert: 'bg-success-subtle text-success',
  abgelehnt: 'bg-danger-subtle text-danger',
  bestaetigt: 'bg-success-subtle text-success',
  ueberfallig: 'bg-warning-subtle text-warning',
};

const statusLabels: Record<Quote['status'], string> = {
  offen: 'Offen',
  versendet: 'Versendet',
  akzeptiert: 'Akzeptiert',
  abgelehnt: 'Abgelehnt',
  bestaetigt: 'Bestätigt',
  ueberfallig: 'Überfällig',
};

export default function QuoteTable({
  quotes,
  customers,
  onDelete,
  onDownloadPDF,
  onPreviewPDF,
  onConvertToInvoice,
  onEdit,
}: QuoteTableProps) {
  const confirmDialog = useConfirm();
  const getCustomerName = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    return customer?.name || 'Unbekannt';
  };

  const handleDelete = async (id: string, quoteNumber: string) => {
    if (await confirmDialog({ title: 'Angebot löschen', confirmLabel: 'Löschen', message: `Möchten Sie das Angebot "${quoteNumber}" wirklich löschen?`, destructive: true })) {
      await onDelete(id);
    }
  };

  // Check if quote can be deleted (only offen)
  const isDeletable = (status: Quote['status']) => {
    return status === 'offen';
  };

  // Check if quote can be converted to invoice (only akzeptiert)
  const isConvertible = (status: Quote['status']) => {
    return status === 'akzeptiert';
  };

  if (quotes.length === 0) {
    return (
      <div className="bg-surface rounded-lg shadow-sm p-6">
        <p className="text-fg-muted text-center">Keine Angebote vorhanden. Erstellen Sie das erste Angebot.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-canvas border-b border-line">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">
                Angebotsnummer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">
                Kunde
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">
                Angebotsdatum
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">
                Gültig bis
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-fg-muted uppercase tracking-wider">
                Gesamttotal
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-fg-muted uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-fg-muted uppercase tracking-wider">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {quotes.map((quote) => (
              <tr key={quote.id} className="hover:bg-canvas transition">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-fg">{quote.quote_number}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-fg-muted">{getCustomerName(quote.customer_id)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-fg-muted">
                    {new Date(quote.issue_date).toLocaleDateString('de-CH')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-fg-muted">
                    {new Date(quote.valid_until).toLocaleDateString('de-CH')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-sm font-medium text-fg">
                    CHF {quote.total.toFixed(2)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusColors[quote.status]}`}>
                    {statusLabels[quote.status]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex justify-end gap-2">
                    {/* 1. Edit - disabled for bestaetigt (converted to invoice) */}
                    {onEdit && (
                      <button
                        onClick={() => onEdit(quote)}
                        disabled={!canEditQuote(quote.status)}
                        className="p-2 text-fg-muted hover:bg-raised rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                        title={canEditQuote(quote.status) ? 'Bearbeiten' : getEditBlockedReason(quote.status)}
                        aria-label={canEditQuote(quote.status) ? 'Bearbeiten' : getEditBlockedReason(quote.status)}
                      >
                        <Pencil size={18} />
                      </button>
                    )}

                    {/* 2. PDF Preview - always available */}
                    <button
                      onClick={() => onPreviewPDF(quote)}
                      className="p-2 text-accent hover:bg-accent-subtle rounded-lg transition"
                      title="PDF Vorschau"
                      aria-label="PDF Vorschau"
                    >
                      <Eye size={18} />
                    </button>

                    {/* 3. PDF Download - always available */}
                    <button
                      onClick={() => onDownloadPDF(quote)}
                      className="p-2 text-brand hover:bg-canvas rounded-lg transition"
                      title="PDF herunterladen"
                      aria-label="PDF herunterladen"
                    >
                      <Download size={18} />
                    </button>

                    {/* 4. Convert to Invoice - only for akzeptiert */}
                    {isConvertible(quote.status) && (
                      <button
                        onClick={() => onConvertToInvoice(quote)}
                        className="p-2 text-success hover:bg-success-subtle rounded-lg transition"
                        title="Als Rechnung erstellen"
                        aria-label="Als Rechnung erstellen"
                      >
                        <FileCheck size={18} />
                      </button>
                    )}

                    {/* 5. Delete - only for offen */}
                    {isDeletable(quote.status) && (
                      <button
                        onClick={() => handleDelete(quote.id, quote.quote_number)}
                        className="p-2 text-danger hover:bg-danger-subtle rounded-lg transition"
                        title="Löschen"
                        aria-label="Löschen"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
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
