import { useState, useEffect } from 'react';
import { Trash2, Plus, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Quote, QuoteItem, Customer, Project, Product } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';
import { shouldWarnOnEdit, getEditWarningMessage } from '../utils/quoteUtils';
import { roundRappen, sumRappen } from '../utils/money';

/** Round to nearest 5 Rappen */
function swissRound(amount: number): number {
  return Math.round(amount * 20) / 20;
}

/** Format CHF amount with apostrophe thousand separators */
function formatChf(amount: number): string {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

type QuoteFormData = {
  quote: Omit<Quote, 'id' | 'created_at' | 'updated_at' | 'subtotal' | 'vat_amount' | 'total'>;
  items: Array<Omit<QuoteItem, 'id' | 'quote_id' | 'total'>>;
};

type QuoteFormProps = {
  onSubmit: (data: QuoteFormData, calculatedTotals: { subtotal: number; vat_amount: number; total: number }) => Promise<void>;
  customers: Customer[];
  projects: Project[];
  nextQuoteNumber: string;
  initialCustomerId?: string;
  initialOpportunityId?: string;
  existingQuote?: Quote;
  existingItems?: QuoteItem[];
};

export default function QuoteForm({
  onSubmit,
  customers,
  projects,
  nextQuoteNumber,
  initialCustomerId,
  initialOpportunityId,
  existingQuote,
  existingItems,
}: QuoteFormProps) {
  const { selectedCompany } = useCompany();
  const isEditMode = !!existingQuote;

  // Initialize state with existing values or defaults
  const [customerId, setCustomerId] = useState(existingQuote?.customer_id || initialCustomerId || '');
  const [projectId, setProjectId] = useState(existingQuote?.project_id || '');
  const [quoteNumber, setQuoteNumber] = useState(existingQuote?.quote_number || nextQuoteNumber);
  const [issueDate, setIssueDate] = useState(
    existingQuote?.issue_date || new Date().toISOString().split('T')[0]
  );
  const [validUntil, setValidUntil] = useState(existingQuote?.valid_until || '');
  const [status, setStatus] = useState<Quote['status']>(existingQuote?.status || 'offen');
  const [vatRate, setVatRate] = useState(existingQuote?.vat_rate?.toString() || '7.7');
  const [items, setItems] = useState<Array<{ description: string; quantity: string; unit_price: string; product_id?: string; sort_order: number }>>(
    existingItems && existingItems.length > 0
      ? existingItems.map((item, index) => ({
          description: item.description,
          quantity: item.quantity.toString(),
          unit_price: item.unit_price.toString(),
          sort_order: item.sort_order ?? index,
        }))
      : [{ description: '', quantity: '1', unit_price: '', sort_order: 0 }]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  // Per-quote intro/outro text (overrides company-level templates when set)
  const [introText, setIntroText] = useState(existingQuote?.intro_text || '');
  const [outroText, setOutroText] = useState(existingQuote?.outro_text || '');

  // Discount System (Task 3.2)
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>(
    existingQuote?.discount_type || 'percent'
  );
  const [discountValue, setDiscountValue] = useState(
    existingQuote?.discount_value?.toString() || '0'
  );
  const [showDiscounts, setShowDiscounts] = useState(
    (existingQuote?.discount_value && existingQuote.discount_value > 0) || false
  );

  // Show warning for sent/accepted/rejected quotes in edit mode
  const showEditWarning = isEditMode && shouldWarnOnEdit(existingQuote.status);
  const editWarningMessage = isEditMode ? getEditWarningMessage(existingQuote.status) : '';

  // Only update quote number from prop in create mode
  useEffect(() => {
    if (!isEditMode) {
      setQuoteNumber(nextQuoteNumber);
    }
  }, [nextQuoteNumber, isEditMode]);

  // Set default validity date (30 days from issue date) - only in create mode
  useEffect(() => {
    if (!isEditMode) {
      const issue = new Date(issueDate);
      const validity = new Date(issue);
      validity.setDate(validity.getDate() + 30);
      setValidUntil(validity.toISOString().split('T')[0]);
    }
  }, [issueDate, isEditMode]);

  useEffect(() => {
    if (selectedCompany) {
      fetchProducts();
    }
  }, [selectedCompany]);

  // Set initial customer from props (e.g., from Sales Pipeline) - only in create mode
  useEffect(() => {
    if (!isEditMode && initialCustomerId) {
      setCustomerId(initialCustomerId);
    }
  }, [initialCustomerId, isEditMode]);

  const fetchProducts = async () => {
    if (!selectedCompany) return;

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const customerProjects = customerId
    ? projects.filter((p) => p.customer_id === customerId)
    : [];

  const calculateTotals = () => {
    // Step 1: Zwischensumme aus auf Rappen gerundeten Zeilenbetraegen,
    // damit die angezeigten Zeilen exakt die angezeigte Summe ergeben
    const subtotal = sumRappen(items.map(item => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      return roundRappen(qty * price);
    }));

    // Step 2: Calculate discount amount
    const discountVal = parseFloat(discountValue) || 0;
    let discountAmount = 0;

    if (discountType === 'percent') {
      // Percentage discount (0-100%)
      discountAmount = subtotal * (discountVal / 100);
    } else {
      // Fixed discount (CHF amount)
      discountAmount = discountVal;
    }

    // Ensure discount doesn't exceed subtotal
    discountAmount = roundRappen(Math.min(discountAmount, subtotal));

    // Step 3: Net after discount
    const nettoNachRabatt = roundRappen(subtotal - discountAmount);

    // Step 4: VAT on discounted amount (only if VAT enabled)
    const vatEnabled = selectedCompany?.vat_enabled || false;
    const vat_amount = vatEnabled ? roundRappen(nettoNachRabatt * (parseFloat(vatRate) / 100)) : 0;

    // Step 5: Total aus gerundeten Werten -> Netto + MwSt. = Total
    const total = roundRappen(nettoNachRabatt + vat_amount);

    return { subtotal, discountAmount, vat_amount, total };
  };

  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: '1', unit_price: '', sort_order: items.length }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleProductSelect = (index: number, productId: string) => {
    if (!productId) {
      // Clear selection - set to free entry mode
      handleItemChange(index, 'product_id', '');
      return;
    }

    const product = products.find(p => p.id === productId);
    if (product) {
      const newItems = [...items];
      newItems[index] = {
        ...newItems[index],
        product_id: productId,
        description: `${product.name} (${product.unit})`,
        unit_price: product.price.toString(),
      };
      setItems(newItems);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const totals = calculateTotals();

      const quoteData: QuoteFormData = {
        quote: {
          company_id: selectedCompany!.id,
          quote_number: quoteNumber,
          customer_id: customerId,
          project_id: projectId || null,
          opportunity_id: initialOpportunityId || null,
          issue_date: issueDate,
          valid_until: validUntil,
          vat_rate: parseFloat(vatRate),
          status,
          converted_to_invoice_id: null,
          converted_at: null,
          // Discount system (Task 3.2)
          discount_type: discountType,
          discount_value: parseFloat(discountValue) || 0,
          // Per-quote text overrides
          intro_text: introText.trim() || null,
          outro_text: outroText.trim() || null,
        },
        items: items
          .filter(item => item.description && item.unit_price)
          .map((item, index) => ({
            description: item.description,
            quantity: parseFloat(item.quantity) || 1,
            unit_price: parseFloat(item.unit_price),
            sort_order: index,
          })),
      };

      await onSubmit(quoteData, { subtotal: totals.subtotal, vat_amount: totals.vat_amount, total: totals.total });
    } catch (error) {
      console.error('Error submitting quote:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totals = calculateTotals();

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        {isEditMode ? 'Angebot bearbeiten' : 'Neues Angebot'}
      </h2>

      {/* Warning for editing sent/accepted/rejected quotes */}
      {showEditWarning && (
        <div className="mb-4 flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <AlertTriangle className="flex-shrink-0 text-amber-600 mt-0.5" size={20} />
          <div>
            <p className="text-amber-800 font-medium">{editWarningMessage}</p>
            <p className="text-amber-700 text-sm mt-1">
              Änderungen werden gespeichert, stellen Sie sicher, dass der Kunde über die Korrektur informiert wird.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="customer" className="block text-sm font-medium text-gray-700 mb-1">
              Kunde <span className="text-red-500">*</span>
            </label>
            <select
              id="customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
            >
              <option value="">Kunde auswählen</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="project" className="block text-sm font-medium text-gray-700 mb-1">
              Projekt (optional)
            </label>
            <select
              id="project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={!customerId}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition disabled:bg-gray-50"
            >
              <option value="">Kein Projekt</option>
              {customerProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="quoteNumber" className="block text-sm font-medium text-gray-700 mb-1">
              Angebotsnummer
            </label>
            <input
              type="text"
              id="quoteNumber"
              value={quoteNumber}
              onChange={(e) => setQuoteNumber(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 font-medium text-gray-900"
              readOnly
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="issueDate" className="block text-sm font-medium text-gray-700 mb-1">
              Angebotsdatum <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="issueDate"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
            />
          </div>

          <div>
            <label htmlFor="validUntil" className="block text-sm font-medium text-gray-700 mb-1">
              Gültig bis <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="validUntil"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
            />
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as Quote['status'])}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
            >
              <option value="offen">Offen</option>
              <option value="versendet">Versendet</option>
              <option value="akzeptiert">Akzeptiert</option>
              <option value="abgelehnt">Abgelehnt</option>
            </select>
          </div>
        </div>

        {/* Intro Text — shown above items in PDF */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Einleitungstext <span className="text-xs font-normal text-gray-400">(optional — überschreibt die Firmenvorlage für dieses Angebot)</span>
          </label>
          <textarea
            value={introText}
            onChange={(e) => setIntroText(e.target.value)}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${el.scrollHeight}px`;
            }}
            placeholder={selectedCompany?.quote_intro_text || 'Einleitungstext für dieses Angebot…'}
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition text-sm resize-none overflow-hidden"
            style={{ minHeight: '72px' }}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Positionen</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDiscounts(!showDiscounts)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition flex items-center gap-2"
              >
                {showDiscounts ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                Rabatte
              </button>
              <button
                type="button"
                onClick={handleAddItem}
                className="rounded-lg px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition flex items-center gap-2"
              >
                <Plus size={16} />
                Position hinzufügen
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                {/* Row 1: Product selector */}
                <div className="mb-2">
                  {index === 0 && (
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Produkt (optional)
                    </label>
                  )}
                  <select
                    value={item.product_id || ''}
                    onChange={(e) => handleProductSelect(index, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition text-sm bg-white"
                  >
                    <option value="">Freie Eingabe</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} - CHF {product.price.toFixed(2)}/{product.unit}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Row 2: Description textarea */}
                <div className="mb-2">
                  {index === 0 && (
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Beschreibung <span className="font-normal text-gray-400">(1. Zeile = Titel fett im PDF)</span>
                    </label>
                  )}
                  <textarea
                    value={item.description}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                    onInput={(e) => {
                      const el = e.currentTarget;
                      el.style.height = 'auto';
                      el.style.height = `${el.scrollHeight}px`;
                    }}
                    placeholder={"Titel (wird fett im PDF)\nZusätzliche Beschreibung (optional)"}
                    rows={2}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition text-sm resize-none overflow-hidden bg-white"
                    style={{ minHeight: '56px' }}
                  />
                </div>

                {/* Row 3: Menge, Einzelpreis, Total, Delete */}
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3">
                    {index === 0 && (
                      <label className="block text-xs font-medium text-gray-600 mb-1">Menge</label>
                    )}
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      placeholder="Menge"
                      step="0.01"
                      min="0"
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition text-sm bg-white"
                    />
                  </div>

                  <div className="col-span-3">
                    {index === 0 && (
                      <label className="block text-xs font-medium text-gray-600 mb-1">Einzelpreis (CHF)</label>
                    )}
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                      placeholder="Preis"
                      step="0.01"
                      min="0"
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition text-sm bg-white"
                    />
                  </div>

                  <div className="col-span-5 flex items-center justify-end">
                    <span className="text-sm text-gray-500 mr-1">Total:</span>
                    <span className="font-semibold text-gray-900 text-sm">
                      CHF {formatChf((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0))}
                    </span>
                  </div>

                  <div className="col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      disabled={items.length === 1}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="max-w-sm ml-auto space-y-2">

            {/* Discount input controls (collapsible) */}
            {showDiscounts && (
              <div className="flex justify-between text-sm items-center gap-4 pb-1">
                <span className="text-gray-600">Rabatt:</span>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setDiscountType('percent')}
                      className={`px-2 py-1 text-xs font-medium transition ${
                        discountType === 'percent'
                          ? 'bg-brand text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('fixed')}
                      className={`px-2 py-1 text-xs font-medium transition ${
                        discountType === 'fixed'
                          ? 'bg-brand text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      CHF
                    </button>
                  </div>
                  <input
                    type="number"
                    value={discountValue}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      if (discountType === 'percent' && val > 100) return;
                      if (discountType === 'fixed' && val > totals.subtotal) return;
                      setDiscountValue(e.target.value);
                    }}
                    step={discountType === 'percent' ? '0.1' : '0.01'}
                    min="0"
                    max={discountType === 'percent' ? '100' : totals.subtotal.toFixed(2)}
                    className="w-20 px-2 py-1 border border-gray-200 rounded text-sm text-right"
                    placeholder="0"
                  />
                </div>
              </div>
            )}

            {/* Zwischensumme */}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Zwischensumme</span>
              <span className="font-medium tabular-nums">CHF {formatChf(totals.subtotal)}</span>
            </div>

            {/* Rabatt display row (shown whenever discount > 0) */}
            {totals.discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">
                  Rabatt{discountType === 'percent' ? ` (${discountValue}%)` : ''}
                </span>
                <span className="font-medium text-green-600 tabular-nums">
                  - CHF {formatChf(totals.discountAmount)}
                </span>
              </div>
            )}

            {/* VAT - only show if VAT enabled */}
            {selectedCompany?.vat_enabled && (
              <div className="flex justify-between text-sm items-center gap-4">
                <span className="text-gray-500">MwSt ({vatRate}%):</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={vatRate}
                    onChange={(e) => setVatRate(e.target.value)}
                    step="0.1"
                    min="0"
                    max="100"
                    className="w-20 px-2 py-1 border border-gray-200 rounded text-sm text-right"
                  />
                  <span className="font-medium tabular-nums">CHF {formatChf(totals.vat_amount)}</span>
                </div>
              </div>
            )}

            {/* Total — Swiss-rounded */}
            <div className="flex justify-between items-baseline border-t-2 border-gray-300 pt-2 mt-1">
              <span className="text-base font-bold text-gray-900">Total</span>
              <span className="text-lg font-bold text-gray-900 tabular-nums">
                CHF {formatChf(swissRound(totals.total))}
              </span>
            </div>
          </div>
        </div>

        {/* Outro Text — shown below items/totals in PDF */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Schlusstext <span className="text-xs font-normal text-gray-400">(optional — überschreibt die Firmenvorlage für dieses Angebot)</span>
          </label>
          <textarea
            value={outroText}
            onChange={(e) => setOutroText(e.target.value)}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${el.scrollHeight}px`;
            }}
            placeholder={selectedCompany?.quote_footer_text || 'Schlusstext / Dank für dieses Angebot…'}
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition text-sm resize-none overflow-hidden"
            style={{ minHeight: '72px' }}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting || items.length === 0}
            className="rounded-lg px-4 py-2 font-medium bg-brand text-white hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Speichert...' : isEditMode ? 'Änderungen speichern' : 'Angebot speichern'}
          </button>
        </div>
      </form>
    </div>
  );
}
