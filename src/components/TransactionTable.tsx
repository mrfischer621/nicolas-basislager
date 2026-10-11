import { useState, useRef, useEffect } from 'react';
import { useConfirm } from '../context/ConfirmProvider';
import toast from 'react-hot-toast';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Eye, MoreVertical, Paperclip } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Transaction, Customer, Project } from '../lib/supabase';
import { formatChfDisplay } from '../utils/money';

const ITEMS_PER_PAGE = 10;

interface TransactionTableProps {
  transactions: Transaction[];
  customers: Customer[];
  projects: Project[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
}

// Portal-based dropdown menu component
function ActionMenu({
  transaction,
  onEdit,
  onDelete,
  isOpen,
  onToggle,
  onClose
}: {
  transaction: Transaction;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const confirmDialog = useConfirm();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.right - 192, // 192px = w-48
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={onToggle}
        className="text-fg-subtle hover:text-brand transition-colors"
      >
        <MoreVertical className="w-5 h-5" />
      </button>
      {isOpen && createPortal(
        <div
          ref={menuRef}
          className="fixed w-48 bg-surface rounded-lg shadow-lg border border-line z-50"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          <button
            onClick={() => {
              onEdit(transaction);
              onClose();
            }}
            className="block w-full text-left px-4 py-2 text-sm text-fg hover:bg-raised rounded-t-lg"
          >
            Bearbeiten
          </button>
          <button
            onClick={async () => {
              if (await confirmDialog({
                title: 'Buchung löschen',
                message: 'Möchten Sie diese Buchung wirklich löschen?',
                confirmLabel: 'Löschen',
                destructive: true,
              })) {
                onDelete(transaction.id);
              }
              onClose();
            }}
            className="block w-full text-left px-4 py-2 text-sm text-danger hover:bg-raised rounded-b-lg"
          >
            Löschen
          </button>
        </div>,
        document.body
      )}
    </>
  );
}

export default function TransactionTable({ transactions, customers, projects, onEdit, onDelete }: TransactionTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Calculate pagination
  const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedTransactions = transactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Reset to page 1 if transactions change and current page is out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [transactions.length, totalPages, currentPage]);

  const getCustomerName = (customerId: string | null) => {
    if (!customerId) return '-';
    const customer = customers.find((c) => c.id === customerId);
    return customer?.name || '-';
  };

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return '-';
    const project = projects.find((p) => p.id === projectId);
    return project?.name || '-';
  };

  const getCategoryBadgeColor = (category: string | null) => {
    if (!category) return 'bg-raised text-fg';

    const colors: Record<string, string> = {
      'Materialaufwand': 'bg-accent-subtle text-accent',
      'Sonstige': 'bg-raised text-fg',
      'Personalkosten': 'bg-accent-subtle text-accent',
      'Miete': 'bg-warning-subtle text-warning',
      'Marketing': 'bg-accent-subtle text-accent',
    };

    return colors[category] || 'bg-raised text-fg';
  };

  const formatAmount = (amount: number, type: 'einnahme' | 'ausgabe') => {
    const formatted = amount.toFixed(2);
    const prefix = type === 'einnahme' ? '+' : '-';
    const colorClass = type === 'einnahme' ? 'text-success' : 'text-danger';

    return (
      <span className={`font-semibold ${colorClass}`}>
        {prefix} CHF {formatted}
      </span>
    );
  };

  const calculateTotal = () => {
    // in Rappen summieren (wie die zentrale Aggregation), sonst Gleitkommafehler
    const rappen = transactions.reduce((sum, t) => {
      const r = Math.round(t.amount * 100);
      return t.type === 'einnahme' ? sum + r : sum - r;
    }, 0);
    return rappen / 100;
  };

  if (transactions.length === 0) {
    return (
      <div className="bg-surface rounded-lg shadow-sm p-6">
        <p className="text-fg-muted text-center">Keine Buchungen vorhanden. Erstellen Sie die erste Buchung.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-canvas border-b border-line">
            <tr>
              <th className="sticky left-0 z-10 bg-canvas px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">
                Datum ↓
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">
                Nr
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-fg-muted uppercase tracking-wider">
                Betrag
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">
                Text
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">
                Kategorie
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">
                Lieferant / Zahler
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">
                Kunde
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">
                Projekt
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-fg-muted uppercase tracking-wider">
                Beleg
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-fg-muted uppercase tracking-wider">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {paginatedTransactions.map((transaction, index) => (
                <tr
                  key={transaction.id}
                  className={`${index % 2 === 0 ? 'bg-surface' : 'bg-canvas'} hover:bg-raised transition-colors`}
                >
                  <td className={`sticky left-0 z-10 px-6 py-4 whitespace-nowrap text-sm text-fg ${index % 2 === 0 ? 'bg-surface' : 'bg-canvas'} group-hover:bg-raised`}>
                    {new Date(transaction.date).toLocaleDateString('de-CH')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-fg">
                    {transaction.transaction_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    {formatAmount(transaction.amount, transaction.type)}
                  </td>
                  <td className="px-6 py-4 text-sm text-fg">
                    <div className="max-w-xs truncate">
                      {transaction.description || '-'}
                    </div>
                    {transaction.tags && transaction.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {transaction.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex px-2 py-0.5 text-xs rounded-full bg-brand text-accent-fg"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {transaction.category && (
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryBadgeColor(
                          transaction.category
                        )}`}
                      >
                        {transaction.category}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-fg">
                    {transaction.counterparty || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-fg">
                    {getCustomerName(transaction.customer_id)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-fg">
                    {getProjectName(transaction.project_id)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {transaction.receipt_url ? (
                      <button
                        onClick={async () => {
                          const { data, error } = await supabase.storage
                            .from('receipts')
                            .createSignedUrl(transaction.receipt_url!, 60);
                          if (error) {
                            console.error('Error creating signed URL:', error);
                            toast.error('Fehler beim Öffnen des Belegs.');
                            return;
                          }
                          if (data?.signedUrl) {
                            window.open(data.signedUrl, '_blank');
                          }
                        }}
                        className="inline-flex items-center justify-center text-fg-subtle hover:text-brand transition-colors"
                        title="Beleg anzeigen"
                        aria-label="Beleg anzeigen"
                      >
                        <Paperclip className="w-5 h-5" />
                      </button>
                    ) : (
                      <span className="text-fg-subtle">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => onEdit(transaction)}
                        className="text-fg-subtle hover:text-brand transition-colors"
                        title="Details anzeigen"
                        aria-label="Details anzeigen"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <ActionMenu
                        transaction={transaction}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        isOpen={openMenuId === transaction.id}
                        onToggle={() => setOpenMenuId(openMenuId === transaction.id ? null : transaction.id)}
                        onClose={() => setOpenMenuId(null)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Footer: Pagination + Total Summary */}
      {transactions.length > 0 && (
        <div className="px-6 py-4 bg-canvas border-t border-line">
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-fg-muted">
                Zeige {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, transactions.length)} von {transactions.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-md border border-line-strong text-fg-muted hover:bg-raised disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Vorherige Seite"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-fg min-w-[80px] text-center">
                  Seite {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-md border border-line-strong text-fg-muted hover:bg-raised disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Nächste Seite"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Total Summary */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-fg">
              Saldo der angezeigten Buchungen:
            </span>
            <span className={`text-lg font-bold ${calculateTotal() >= 0 ? 'text-success' : 'text-danger'}`}>
              {formatChfDisplay(calculateTotal())}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
