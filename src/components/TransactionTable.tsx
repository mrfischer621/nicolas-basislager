import { useState, useRef, useEffect } from 'react';
import { useConfirm } from '../context/ConfirmProvider';
import toast from 'react-hot-toast';
import { createPortal } from 'react-dom';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, MoreVertical, Paperclip } from 'lucide-react';
import { EmptyState } from './ui';
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
        type="button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Aktionen für Buchung ${transaction.transaction_number ?? ''}`.trim()}
        className="rounded-lg p-1.5 text-fg-muted transition-colors hover:bg-raised hover:text-fg"
      >
        <MoreVertical className="h-5 w-5" aria-hidden="true" />
      </button>
      {isOpen && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-50 w-48 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg"
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          <button
            onClick={() => {
              onEdit(transaction);
              onClose();
            }}
            type="button"
            role="menuitem"
            autoFocus
            className="block w-full px-4 py-2 text-left text-sm text-fg hover:bg-raised focus:bg-raised"
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
            type="button"
            role="menuitem"
            className="block w-full px-4 py-2 text-left text-sm text-danger-on-subtle hover:bg-danger-subtle focus:bg-danger-subtle"
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
  const [requestedPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Calculate pagination
  const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);
  // Ausserhalb des Bereichs (z.B. nach Filtern) auf Seite 1 zurueck, ohne Effekt
  const currentPage = requestedPage > totalPages ? 1 : requestedPage;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedTransactions = transactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);


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

  const dmy = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;

  // Betrag gruen (Einnahme) bzw. rot (Ausgabe) in der Textvariante, dazu
  // Vorzeichen und Pfeil: Farbe ist nie das einzige Signal.
  const formatAmount = (amount: number, type: 'einnahme' | 'ausgabe') => (
    <span
      className={`inline-flex items-center justify-end gap-1 font-semibold tabular-nums ${
        type === 'einnahme' ? 'text-positive' : 'text-negative'
      }`}
    >
      {type === 'einnahme' ? (
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {type === 'einnahme' ? '+ ' : '− '}
      {formatChfDisplay(amount)}
    </span>
  );

  const typeBadge = (type: 'einnahme' | 'ausgabe') =>
    type === 'einnahme' ? <span className="badge-positive">Einnahme</span> : <span className="badge-negative">Ausgabe</span>;

  const openReceipt = async (path: string) => {
    const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 60);
    if (error) {
      console.error('Error creating signed URL:', error);
      toast.error('Fehler beim Öffnen des Belegs.');
      return;
    }
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
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
      <div className="card">
        <EmptyState title="Keine Buchungen gefunden" text="Passe Filter oder Suche an, oder erfasse eine neue Buchung." />
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Handy: Liste */}
      <ul className="divide-y divide-line md:hidden">
        {paginatedTransactions.map((t) => (
          <li key={t.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <button type="button" onClick={() => onEdit(t)} className="min-w-0 flex-1 text-left">
              <span className="block truncate font-medium text-fg">{t.counterparty || t.description || t.category || 'Buchung'}</span>
              <span className="block truncate text-xs text-fg-muted">
                {dmy(t.date)} · {t.transaction_number} · {t.category || 'Ohne Kategorie'}
                {!t.receipt_url && t.id.startsWith('invoice-') === false ? ' · ohne Beleg' : ''}
              </span>
            </button>
            <div className="flex items-center gap-1">
              {formatAmount(t.amount, t.type)}
              {!t.id.startsWith('invoice-') && (
                <ActionMenu
                  transaction={t}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  isOpen={openMenuId === t.id}
                  onToggle={() => setOpenMenuId(openMenuId === t.id ? null : t.id)}
                  onClose={() => setOpenMenuId(null)}
                />
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop: Tabelle */}
      <div className="hidden overflow-x-auto md:block">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Datum</th>
              <th scope="col">Nr</th>
              <th scope="col">Typ</th>
              <th scope="col">Lieferant / Zahler</th>
              <th scope="col">Text</th>
              <th scope="col">Kategorie</th>
              <th scope="col" className="text-right">Betrag</th>
              <th scope="col" className="text-center">Beleg</th>
              <th scope="col"><span className="sr-only">Aktionen</span></th>
            </tr>
          </thead>
          <tbody>
            {paginatedTransactions.map((transaction) => (
              <tr key={transaction.id}>
                <td className="whitespace-nowrap tabular-nums">{dmy(transaction.date)}</td>
                <td className="whitespace-nowrap font-medium">{transaction.transaction_number}</td>
                <td className="whitespace-nowrap">{typeBadge(transaction.type)}</td>
                <td className="max-w-[12rem] truncate">{transaction.counterparty || '–'}</td>
                <td className="max-w-xs">
                  <div className="truncate">{transaction.description || '–'}</div>
                  {(transaction.customer_id || transaction.project_id) && (
                    <div className="truncate text-xs text-fg-muted">
                      {[getCustomerName(transaction.customer_id), getProjectName(transaction.project_id)].filter((x) => x !== '-').join(' · ')}
                    </div>
                  )}
                  {transaction.tags && transaction.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {transaction.tags.map((tag) => (
                        <span key={tag} className="badge-accent">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap">
                  {transaction.category ? <span className="badge-neutral">{transaction.category}</span> : <span className="text-fg-muted">–</span>}
                </td>
                <td className="whitespace-nowrap text-right">{formatAmount(transaction.amount, transaction.type)}</td>
                <td className="text-center">
                  {transaction.receipt_url ? (
                    <button
                      type="button"
                      onClick={() => openReceipt(transaction.receipt_url!)}
                      className="rounded-lg p-1.5 text-fg-muted hover:bg-raised hover:text-fg"
                      aria-label={`Beleg zu ${transaction.transaction_number ?? 'Buchung'} anzeigen`}
                    >
                      <Paperclip className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : transaction.id.startsWith('invoice-') ? (
                    <span className="text-xs text-fg-muted">Rechnung</span>
                  ) : (
                    <span className="badge-warning">Beleg fehlt</span>
                  )}
                </td>
                <td className="text-right">
                  {!transaction.id.startsWith('invoice-') && (
                    <ActionMenu
                      transaction={transaction}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      isOpen={openMenuId === transaction.id}
                      onToggle={() => setOpenMenuId(openMenuId === transaction.id ? null : transaction.id)}
                      onClose={() => setOpenMenuId(null)}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer: Pagination + Total Summary */}
      {transactions.length > 0 && (
        <div className="border-t border-line bg-canvas px-4 py-4 md:px-5">
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-fg-muted">
                Zeige {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, transactions.length)} von {transactions.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
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
                  type="button"
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
              Saldo der angezeigten Buchungen
            </span>
            <span className="whitespace-nowrap font-display text-lg font-black tabular-nums text-fg">
              {formatChfDisplay(calculateTotal())}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
