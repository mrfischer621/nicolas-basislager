import { useState, useEffect } from 'react';
import { Trash2, Plus, AlertCircle } from 'lucide-react';
import type { Quote, QuoteItem, Customer } from '../lib/supabase';
import { asError } from '../utils/errors';

interface QuoteToInvoiceModalProps {
  quote: Quote;
  items: QuoteItem[];
  customer: Customer;
  nextInvoiceNumber: string;
  onConvert: (data: {
    invoiceNumber: string;
    dueDate: string;
    items: Array<{ description: string; quantity: number; unit_price: number }>;
    vatRate: number;
  }) => Promise<void>;
  onCancel: () => void;
}

export default function QuoteToInvoiceModal({
  quote,
  items: initialItems,
  customer,
  nextInvoiceNumber,
  onConvert,
  onCancel,
}: QuoteToInvoiceModalProps) {
  const [invoiceNumber, setInvoiceNumber] = useState(nextInvoiceNumber);
  const [dueDate, setDueDate] = useState('');
  const [vatRate, setVatRate] = useState(quote.vat_rate.toString());
  const [items, setItems] = useState<Array<{ description: string; quantity: string; unit_price: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize items from quote items
  useEffect(() => {
    setItems(
      initialItems.map((item) => ({
        description: item.description,
        quantity: item.quantity.toString(),
        unit_price: item.unit_price.toString(),
      }))
    );
  }, [initialItems]);

  // Set default due date (30 days from now)
  useEffect(() => {
    const due = new Date();
    due.setDate(due.getDate() + 30);
    setDueDate(due.toISOString().split('T')[0]);
  }, []);

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      return sum + qty * price;
    }, 0);

    const vat_amount = subtotal * (parseFloat(vatRate) / 100);
    const total = subtotal + vat_amount;

    return { subtotal, vat_amount, total };
  };

  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: '1', unit_price: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const validItems = items
        .filter((item) => item.description && item.unit_price)
        .map((item) => ({
          description: item.description,
          quantity: parseFloat(item.quantity) || 1,
          unit_price: parseFloat(item.unit_price),
        }));

      if (validItems.length === 0) {
        setError('Bitte fügen Sie mindestens eine Position hinzu.');
        return;
      }

      await onConvert({
        invoiceNumber,
        dueDate,
        items: validItems,
        vatRate: parseFloat(vatRate),
      });
    } catch (caught) {
      const err = asError(caught);
      setError(err?.message || 'Fehler beim Erstellen der Rechnung.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-accent-subtle border border-accent-border rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="text-accent flex-shrink-0" size={20} />
          <div>
            <p className="text-sm text-accent">
              <strong>Angebot {quote.quote_number}</strong> wird in eine Rechnung umgewandelt.
            </p>
            <p className="text-sm text-accent mt-1">
              Kunde: <strong>{customer.name}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-danger-subtle border border-danger-subtle text-danger px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Invoice Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="invoiceNumber" className="block text-sm font-medium text-fg mb-1">
              Rechnungsnummer
            </label>
            <input
              type="text"
              id="invoiceNumber"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              required
              className="w-full px-4 py-2 border border-line rounded-lg bg-canvas font-medium text-fg"
              readOnly
            />
          </div>

          <div>
            <label htmlFor="dueDate" className="block text-sm font-medium text-fg mb-1">
              Fälligkeitsdatum
            </label>
            <input
              type="date"
              id="dueDate"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
            />
          </div>

          <div>
            <label htmlFor="vatRate" className="block text-sm font-medium text-fg mb-1">
              MwSt-Satz (%)
            </label>
            <input
              type="number"
              id="vatRate"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              step="0.1"
              min="0"
              max="100"
              className="w-full px-4 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
            />
          </div>
        </div>

        {/* Items */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-fg">Positionen</h3>
            <button
              type="button"
              onClick={handleAddItem}
              className="rounded-lg px-3 py-1.5 text-sm font-medium bg-raised text-fg hover:bg-sunken transition flex items-center gap-2"
            >
              <Plus size={16} />
              Position hinzufügen
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-end">
                {/* Description */}
                <div className="col-span-6">
                  {index === 0 && (
                    <label className="block text-xs font-medium text-fg-muted mb-1">
                      Beschreibung
                    </label>
                  )}
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                    placeholder="Beschreibung"
                    required
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition text-sm"
                  />
                </div>

                {/* Quantity */}
                <div className="col-span-2">
                  {index === 0 && (
                    <label className="block text-xs font-medium text-fg-muted mb-1">
                      Menge
                    </label>
                  )}
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                    placeholder="Menge"
                    step="0.01"
                    min="0"
                    required
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition text-sm"
                  />
                </div>

                {/* Unit Price */}
                <div className="col-span-3">
                  {index === 0 && (
                    <label className="block text-xs font-medium text-fg-muted mb-1">
                      Einzelpreis (CHF)
                    </label>
                  )}
                  <input
                    type="number"
                    value={item.unit_price}
                    onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                    placeholder="Preis"
                    step="0.01"
                    min="0"
                    required
                    className="w-full px-3 py-2 border border-line rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 transition text-sm"
                  />
                </div>

                {/* Delete Button */}
                <div className="col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    disabled={items.length === 1}
                    className="p-2 text-danger hover:bg-danger-subtle rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="border-t pt-4">
          <div className="max-w-sm ml-auto space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-fg-muted">Zwischentotal:</span>
              <span className="font-medium">CHF {totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-fg-muted">MwSt ({vatRate}%):</span>
              <span className="font-medium">CHF {totals.vat_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-brand border-t pt-2">
              <span>Gesamttotal:</span>
              <span>CHF {totals.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-fg hover:bg-raised rounded-lg transition"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={isSubmitting || items.length === 0}
            className="rounded-lg px-4 py-2 font-medium bg-brand text-accent-fg hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Erstellt Rechnung...' : 'Rechnung erstellen'}
          </button>
        </div>
      </form>
    </div>
  );
}
