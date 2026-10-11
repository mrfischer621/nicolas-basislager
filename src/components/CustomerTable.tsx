import { Link } from 'react-router-dom';
import { Pencil, Archive, RotateCcw, Users, Trash2 } from 'lucide-react';
import type { Customer } from '../lib/supabase';
import type { CustomerWithStats } from '../pages/Kunden';
import { getCustomerDisplayName } from '../utils/customerUtils';

type CustomerTableProps = {
  customers: CustomerWithStats[];
  onEdit: (customer: Customer) => void;
  onRowClick: (customer: Customer) => void;
  onArchive: (id: string) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

// Format currency for display
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2
  }).format(amount);
};

export default function CustomerTable({ customers, onEdit, onRowClick, onArchive, onRestore, onDelete }: CustomerTableProps) {

  if (customers.length === 0) {
    return (
      <div className="card p-6">
        <p className="text-fg-muted text-center">Keine Kunden vorhanden. Erstellen Sie den ersten Kunden.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-canvas border-b border-line">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">
                Firma
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">
                Kontaktperson
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">
                E-Mail
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">
                Ort
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">
                Telefon
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-fg-muted uppercase tracking-wider">
                Offene Rechnungen
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-fg-muted uppercase tracking-wider">
                Kontakte
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-fg-muted uppercase tracking-wider">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {customers.map((customer) => {
              const location = [customer.zip_code, customer.city].filter(Boolean).join(' ') || '-';

              return (
                <tr
                  key={customer.id}
                  onClick={() => onRowClick(customer)}
                  className="hover:bg-canvas transition cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-fg">
                      {customer.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-fg-muted">{getCustomerDisplayName(customer)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-fg-muted">{customer.email || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-fg-muted">{location}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-fg-muted">{customer.phone || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {customer.open_invoice_amount > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning-subtle text-warning-on-subtle">
                        {formatCurrency(customer.open_invoice_amount)}
                      </span>
                    ) : (
                      <span className="text-sm text-fg-muted">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                    <Link
                      to={`/kontakte/firmen/${customer.id}?tab=personen`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm text-fg-muted hover:bg-raised hover:text-brand transition"
                    >
                      <Users size={16} />
                      <span>{customer.contacts_count}</span>
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      customer.is_active
                        ? 'bg-success-subtle text-success-on-subtle'
                        : 'bg-raised text-fg-muted'
                    }`}>
                      {customer.is_active ? 'Aktiv' : 'Archiviert'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onEdit(customer)}
                        className="p-2 text-brand hover:bg-canvas rounded-lg transition"
                        title="Bearbeiten"
                        aria-label="Bearbeiten"
                      >
                        <Pencil size={18} />
                      </button>
                      {customer.is_active ? (
                        <button
                          onClick={() => onArchive(customer.id)}
                          className="p-2 text-warning-on-subtle hover:bg-warning-subtle rounded-lg transition"
                          title="Archivieren"
                          aria-label="Archivieren"
                        >
                          <Archive size={18} />
                        </button>
                      ) : (
                        <button
                          onClick={() => onRestore(customer.id)}
                          className="p-2 text-success-on-subtle hover:bg-success-subtle rounded-lg transition"
                          title="Wiederherstellen"
                          aria-label="Wiederherstellen"
                        >
                          <RotateCcw size={18} />
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(customer.id)}
                        className="p-2 text-danger-on-subtle hover:bg-danger-subtle rounded-lg transition"
                        title="Löschen"
                        aria-label="Löschen"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
