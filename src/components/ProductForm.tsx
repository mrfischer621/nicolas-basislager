import { useState, useEffect } from 'react';
import type { Product } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';

interface ProductFormProps {
  onSubmit: (data: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  editingProduct?: Product;
  onCancel?: () => void;
}

export default function ProductForm({ onSubmit, editingProduct, onCancel }: ProductFormProps) {
  const { selectedCompany } = useCompany();
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    unit: 'Stück',
    description: '',
    is_active: true,
    vat_rate: '', // Empty string means "use company default"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editingProduct) {
      setFormData({
        name: editingProduct.name,
        category: editingProduct.category || '',
        price: editingProduct.price.toString(),
        unit: editingProduct.unit,
        description: editingProduct.description || '',
        is_active: editingProduct.is_active,
        vat_rate: editingProduct.vat_rate !== null ? editingProduct.vat_rate.toString() : '',
      });
    }
  }, [editingProduct]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name ist erforderlich';
    }

    const price = parseFloat(formData.price);
    if (!formData.price || isNaN(price) || price < 0) {
      newErrors.price = 'Bitte geben Sie einen gültigen Preis ein (≥ 0)';
    }

    if (!formData.unit.trim()) {
      newErrors.unit = 'Einheit ist erforderlich';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        company_id: selectedCompany!.id,
        name: formData.name.trim(),
        category: formData.category.trim() || null,
        price: parseFloat(formData.price),
        unit: formData.unit.trim(),
        description: formData.description.trim() || null,
        vat_rate: formData.vat_rate ? parseFloat(formData.vat_rate) : null,
        is_active: formData.is_active,
      });

      // Reset form if not editing
      if (!editingProduct) {
        setFormData({
          name: '',
          category: '',
          price: '',
          unit: 'Stück',
          description: '',
          is_active: true,
          vat_rate: '',
        });
      }
    } catch (error) {
      console.error('Error submitting product:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const unitOptions = ['Stück', 'Stunden', 'kg', 'Liter', 'm', 'm²', 'm³', 'Paket', 'Set'];

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-4">
      <h2 className="text-xl font-semibold text-fg">
        {editingProduct ? 'Produkt bearbeiten' : 'Neues Produkt'}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-fg mb-1">
            Name <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent ${
              errors.name ? 'border-danger' : 'border-line-strong'
            }`}
            placeholder="Produktname"
          />
          {errors.name && <p className="text-danger text-sm mt-1">{errors.name}</p>}
        </div>

        {/* Category - Dropdown (Phase 3.2) */}
        <div>
          <label className="block text-sm font-medium text-fg mb-1">
            Kategorie
          </label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-3 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
          >
            <option value="">Keine Kategorie</option>
            {selectedCompany?.product_categories?.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          {(!selectedCompany?.product_categories || selectedCompany.product_categories.length === 0) && (
            <p className="text-xs text-fg-muted mt-1">
              Keine Kategorien verfügbar. Definieren Sie Kategorien in den Einstellungen.
            </p>
          )}
        </div>

        {/* Price */}
        <div>
          <label className="block text-sm font-medium text-fg mb-1">
            Preis (CHF) <span className="text-danger">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent ${
              errors.price ? 'border-danger' : 'border-line-strong'
            }`}
            placeholder="0.00"
          />
          {errors.price && <p className="text-danger text-sm mt-1">{errors.price}</p>}
        </div>

        {/* VAT Rate - only show if company.vat_enabled */}
        {selectedCompany?.vat_enabled && (
          <div>
            <label className="block text-sm font-medium text-fg mb-1">
              MWST-Satz (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={formData.vat_rate}
              onChange={(e) => setFormData({ ...formData, vat_rate: e.target.value })}
              className="w-full px-3 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
              placeholder={`Standard (${selectedCompany.default_vat_rate}%)`}
            />
            <p className="text-xs text-fg-muted mt-1">
              Leer lassen für Standard ({selectedCompany.default_vat_rate}%)
            </p>
          </div>
        )}

        {/* Unit */}
        <div>
          <label className="block text-sm font-medium text-fg mb-1">
            Einheit <span className="text-danger">*</span>
          </label>
          <select
            value={formData.unit}
            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent ${
              errors.unit ? 'border-danger' : 'border-line-strong'
            }`}
          >
            {unitOptions.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
          {errors.unit && <p className="text-danger text-sm mt-1">{errors.unit}</p>}
        </div>

        {/* Active Status */}
        <div className="flex items-center pt-6">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-brand border-line-strong rounded focus:ring-brand"
            />
            <span className="ml-2 text-sm text-fg">Produkt aktiv</span>
          </label>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-fg mb-1">Beschreibung</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-line-strong rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
          placeholder="Optionale Produktbeschreibung"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 bg-brand text-accent-fg rounded-lg hover:bg-opacity-90 transition disabled:opacity-50"
        >
          {isSubmitting ? 'Speichern...' : editingProduct ? 'Aktualisieren' : 'Hinzufügen'}
        </button>
        {editingProduct && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 bg-sunken text-fg rounded-lg hover:bg-sunken transition"
          >
            Abbrechen
          </button>
        )}
      </div>
    </form>
  );
}
