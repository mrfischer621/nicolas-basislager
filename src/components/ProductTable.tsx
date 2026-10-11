import { Pencil, Archive, RotateCcw } from 'lucide-react';
import type { Product } from '../lib/supabase';

interface ProductTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
}

export default function ProductTable({ products, onEdit, onArchive, onRestore }: ProductTableProps) {
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF',
    }).format(amount);
  };

  const truncateDescription = (text: string | null, wordLimit: number = 10): string => {
    if (!text) return '-';
    const words = text.split(' ');
    if (words.length <= wordLimit) return text;
    return words.slice(0, wordLimit).join(' ') + '...';
  };

  if (products.length === 0) {
    return (
      <div className="card p-6">
        <p className="text-fg-muted text-center">Keine Produkte vorhanden</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-canvas border-b border-line">
            <tr>
              <th className="sticky left-0 z-10 bg-canvas px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Kategorie</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Preis</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Einheit</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Beschreibung</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-fg-muted uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-fg-muted uppercase tracking-wider">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {products.map((product) => (
              <tr
                key={product.id}
                className={`hover:bg-canvas transition ${
                  !product.is_active ? 'opacity-50' : ''
                }`}
              >
                <td className="sticky left-0 z-10 bg-surface px-6 py-4 whitespace-nowrap group-hover:bg-canvas">
                  <span className="text-sm font-medium text-fg">{product.name}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-fg-muted">{product.category || '-'}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-fg">
                    {formatCurrency(product.price)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-fg-muted">{product.unit}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-fg-muted">
                    {truncateDescription(product.description)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      product.is_active
                        ? 'bg-success-subtle text-success-on-subtle'
                        : 'bg-raised text-fg-muted'
                    }`}
                  >
                    {product.is_active ? 'Aktiv' : 'Archiviert'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => onEdit(product)}
                      className="p-2 text-brand hover:bg-canvas rounded-lg transition"
                      title="Bearbeiten"
                      aria-label="Bearbeiten"
                    >
                      <Pencil size={18} />
                    </button>
                    {product.is_active ? (
                      <button
                        onClick={() => onArchive(product.id)}
                        className="p-2 text-warning-on-subtle hover:bg-warning-subtle rounded-lg transition"
                        title="Archivieren"
                        aria-label="Archivieren"
                      >
                        <Archive size={18} />
                      </button>
                    ) : (
                      <button
                        onClick={() => onRestore(product.id)}
                        className="p-2 text-success-on-subtle hover:bg-success-subtle rounded-lg transition"
                        title="Wiederherstellen"
                        aria-label="Wiederherstellen"
                      >
                        <RotateCcw size={18} />
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
