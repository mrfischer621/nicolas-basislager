import { useState, useEffect, useMemo } from 'react';
import { useConfirm } from '../context/ConfirmProvider';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Product } from '../lib/supabase';
import ProductForm from '../components/ProductForm';
import ProductTable from '../components/ProductTable';
import Modal from '../components/Modal';
import { useCompany } from '../context/CompanyContext';
import { useProducts, useInvalidateData } from '../hooks/queries';
import { Plus, Layers } from 'lucide-react';
import toast from 'react-hot-toast';

type FilterType = 'alle' | 'aktiv' | 'archiviert';

export default function Produkte() {
  const confirmDialog = useConfirm();
  const { selectedCompany } = useCompany();
  const [searchParams, setSearchParams] = useSearchParams();
  // Alle Produkte einmal laden und zwischenspeichern; der Filter greift
  // clientseitig, damit ein Filterwechsel keine neue Abfrage ausloest
  const { data: allProducts = [], isLoading: loading, error: queryError } = useProducts();
  const invalidate = useInvalidateData();
  const error = queryError ? 'Fehler beim Laden der Produkte' : null;
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>('aktiv');
  const [groupByCategory, setGroupByCategory] = useState(false);

  // Filter clientseitig - die Liste liegt bereits vollstaendig im Cache.
  // Muss vor dem useEffect stehen, der products als Abhaengigkeit nutzt.
  const products = useMemo(() => {
    if (filter === 'aktiv') return allProducts.filter(p => p.is_active);
    if (filter === 'archiviert') return allProducts.filter(p => !p.is_active);
    return allProducts;
  }, [allProducts, filter]);

  /** Nach einer Aenderung den Cache verwerfen, damit neu geladen wird */
  const fetchProducts = async () => {
    await invalidate.products();
  };

  // Handle query parameter for opening specific product
  useEffect(() => {
    const productId = searchParams.get('id');
    if (productId && products.length > 0) {
      const product = products.find(p => p.id === productId);
      if (product) {
        handleEdit(product);
        setSearchParams({}); // Clear query param after opening
      }
    }
  }, [searchParams, products]);

  const handleSubmit = async (data: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    if (!selectedCompany) return;

    try {
      // Set active company session before INSERT/UPDATE
      await supabase.rpc('set_active_company', { company_id: selectedCompany.id });

      if (editingProduct) {
        // Update existing product
        const { error: updateError } = await supabase
          .from('products')
          .update(data as any)
          .eq('id', editingProduct.id);

        if (updateError) throw updateError;
      } else {
        // Insert new product with company_id
        const { error: insertError } = await supabase
          .from('products')
          .insert([{ ...data, company_id: selectedCompany.id } as any]);

        if (insertError) throw insertError;
      }

      setIsModalOpen(false);
      setEditingProduct(undefined);
      await fetchProducts();
    } catch (err) {
      console.error('Error saving product:', err);
      toast.error('Fehler beim Speichern des Produkts');
      throw err;
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleArchive = async (id: string) => {
    if (!(await confirmDialog({ title: 'Produkt archivieren', confirmLabel: 'Archivieren', message: 'Möchten Sie dieses Produkt wirklich archivieren?', destructive: true }))) return;

    try {
      const { error: archiveError } = await supabase
        .from('products')
        .update({ is_active: false } as any)
        .eq('id', id);

      if (archiveError) throw archiveError;

      toast.success('Produkt archiviert');
      await fetchProducts();
    } catch (err) {
      console.error('Error archiving product:', err);
      toast.error('Fehler beim Archivieren des Produkts');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      const { error: restoreError } = await supabase
        .from('products')
        .update({ is_active: true } as any)
        .eq('id', id);

      if (restoreError) throw restoreError;

      toast.success('Produkt wiederhergestellt');
      await fetchProducts();
    } catch (err) {
      console.error('Error restoring product:', err);
      toast.error('Fehler beim Wiederherstellen des Produkts');
    }
  };

  const handleAddNew = () => {
    setEditingProduct(undefined);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(undefined);
  };

  // Group products by category
  const groupedProducts = useMemo(() => {
    if (!groupByCategory) return null;

    const groups = new Map<string, Product[]>();

    products.forEach(product => {
      const category = product.category || 'Ohne Kategorie';
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(product);
    });

    // Sort categories alphabetically, but "Ohne Kategorie" always last
    const sortedEntries = Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === 'Ohne Kategorie') return 1;
      if (b === 'Ohne Kategorie') return -1;
      return a.localeCompare(b);
    });

    return new Map(sortedEntries);
  }, [products, groupByCategory]);

  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Firma wird geladen...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produkte</h1>
          <p className="text-gray-600 mt-1">Verwalten Sie Ihre Produkte und Dienstleistungen</p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition"
        >
          <Plus size={20} />
          Neues Produkt
        </button>
      </div>

      {/* Filter Tabs & Group Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('alle')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'alle'
                ? 'bg-brand text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            Alle
          </button>
          <button
            onClick={() => setFilter('aktiv')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'aktiv'
                ? 'bg-brand text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            Aktiv
          </button>
          <button
            onClick={() => setFilter('archiviert')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'archiviert'
                ? 'bg-brand text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            Archiviert
          </button>
        </div>

        {/* Group by Category Toggle */}
        <button
          onClick={() => setGroupByCategory(!groupByCategory)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
            groupByCategory
              ? 'bg-brand text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Layers size={18} />
          Nach Kategorie gruppieren
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-gray-500 text-center">Lädt Produkte...</p>
        </div>
      ) : groupByCategory && groupedProducts ? (
        /* Grouped View */
        <div className="space-y-6">
          {Array.from(groupedProducts.entries()).map(([category, categoryProducts]) => (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">{category}</h2>
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-sm rounded-full">
                  {categoryProducts.length}
                </span>
              </div>
              <ProductTable
                products={categoryProducts}
                onEdit={handleEdit}
                onArchive={handleArchive}
                onRestore={handleRestore}
              />
            </div>
          ))}
        </div>
      ) : (
        /* Normal View */
        <ProductTable
          products={products}
          onEdit={handleEdit}
          onArchive={handleArchive}
          onRestore={handleRestore}
        />
      )}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingProduct ? 'Produkt bearbeiten' : 'Neues Produkt'}
        size="lg"
      >
        <ProductForm
          onSubmit={handleSubmit}
          editingProduct={editingProduct}
          onCancel={handleCloseModal}
        />
      </Modal>
    </div>
  );
}
