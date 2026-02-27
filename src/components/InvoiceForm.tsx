import { useState, useEffect } from 'react';
import { Trash2, Plus, AlertTriangle, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Invoice, InvoiceItem, Customer, Project, Product } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';
import { shouldWarnOnEdit, getEditWarningMessage } from '../utils/invoiceUtils';
import TimeEntryImportModal from './TimeEntryImportModal';
import RichTextEditor from './RichTextEditor';

/** Returns true when an HTML string (or plain string) has no visible text content. */
function isHtmlEmpty(html: string): boolean {
  return !html || html.replace(/<[^>]*>/g, '').trim() === '';
}

type InvoiceFormData = {
  invoice: Omit<Invoice, 'id' | 'created_at' | 'subtotal' | 'vat_amount' | 'total' | 'total_discount_percent'>;
  items: Array<Omit<InvoiceItem, 'id' | 'invoice_id' | 'total'>>;
  timeEntryIds?: string[]; // IDs of time entries to link after save
};

type InvoiceFormProps = {
  onSubmit: (data: InvoiceFormData, calculatedTotals: { subtotal: number; vat_amount: number; total: number; discountAmount: number }, timeEntryIds?: string[]) => Promise<void>;
  customers: Customer[];
  projects: Project[];
  nextInvoiceNumber: string;
  existingInvoice?: Invoice;
  existingItems?: InvoiceItem[];
};

type ItemState = {
  description: string;
  quantity: string;
  unit_price: string;
  discount_percent: string;
  vat_rate: string; // Per-line VAT rate (empty = use company default)
  product_id?: string;
};

export default function InvoiceForm({ onSubmit, customers, projects, nextInvoiceNumber, existingInvoice, existingItems }: InvoiceFormProps) {
  const { selectedCompany } = useCompany();
  const isEditMode = !!existingInvoice;

  // Initialize state with existing values or defaults
  const [customerId, setCustomerId] = useState(existingInvoice?.customer_id || '');
  const [projectId, setProjectId] = useState(existingInvoice?.project_id || '');
  const [invoiceNumber, setInvoiceNumber] = useState(existingInvoice?.invoice_number || nextInvoiceNumber);
  const [issueDate, setIssueDate] = useState(
    existingInvoice?.issue_date || new Date().toISOString().split('T')[0]
  );
  const [dueDate, setDueDate] = useState(existingInvoice?.due_date || '');
  const [status, setStatus] = useState<Invoice['status']>(existingInvoice?.status || 'entwurf');

  // New fields for Phase 3.3
  const [title, setTitle] = useState(existingInvoice?.title || '');
  const [introText, setIntroText] = useState(existingInvoice?.introduction_text || '');
  const [footerText, setFooterText] = useState(existingInvoice?.footer_text || '');

  // Discount System (Task 3.2) - Migrate from legacy total_discount_percent
  const initDiscountType = (): 'percent' | 'fixed' => {
    if (existingInvoice?.discount_type) return existingInvoice.discount_type;
    // Legacy migration: if old field has value, use 'percent'
    if (existingInvoice?.total_discount_percent && existingInvoice.total_discount_percent > 0) return 'percent';
    return 'percent';
  };
  const initDiscountValue = (): string => {
    if (existingInvoice?.discount_value !== undefined && existingInvoice.discount_value > 0) {
      return existingInvoice.discount_value.toString();
    }
    // Legacy migration: migrate old total_discount_percent to discount_value
    if (existingInvoice?.total_discount_percent && existingInvoice.total_discount_percent > 0) {
      return existingInvoice.total_discount_percent.toString();
    }
    return '0';
  };

  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>(initDiscountType());
  const [discountValue, setDiscountValue] = useState(initDiscountValue());
  const [showDiscounts, setShowDiscounts] = useState(
    (parseFloat(initDiscountValue()) > 0) ||
    (existingItems && existingItems.some(item => item.discount_percent > 0)) ||
    false
  );

  const [items, setItems] = useState<ItemState[]>(
    existingItems && existingItems.length > 0
      ? existingItems.map(item => ({
          description: item.description,
          quantity: item.quantity.toString(),
          unit_price: item.unit_price.toString(),
          discount_percent: (item.discount_percent || 0).toString(),
          vat_rate: (item.vat_rate || 0).toString(),
        }))
      : [{ description: '', quantity: '1', unit_price: '', discount_percent: '0', vat_rate: '' }]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [isTimeImportModalOpen, setIsTimeImportModalOpen] = useState(false);
  const [importedTimeEntryIds, setImportedTimeEntryIds] = useState<string[]>([]);

  // Show warning for sent/overdue invoices in edit mode
  const showEditWarning = isEditMode && shouldWarnOnEdit(existingInvoice.status);
  const editWarningMessage = isEditMode ? getEditWarningMessage(existingInvoice.status) : '';

  // Only update invoice number from prop in create mode
  useEffect(() => {
    if (!isEditMode) {
      setInvoiceNumber(nextInvoiceNumber);
    }
  }, [nextInvoiceNumber, isEditMode]);

  // Auto-calculate due date only in create mode
  useEffect(() => {
    if (!isEditMode) {
      const issue = new Date(issueDate);
      const due = new Date(issue);
      due.setDate(due.getDate() + 30);
      setDueDate(due.toISOString().split('T')[0]);
    }
  }, [issueDate, isEditMode]);

  useEffect(() => {
    if (selectedCompany) {
      fetchProducts();
    }
  }, [selectedCompany]);

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
    const vatEnabled = selectedCompany?.vat_enabled || false;

    // Calculate line results with per-line VAT
    const lineResults = items.map(item => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      const lineDiscount = parseFloat(item.discount_percent) || 0;

      // Line NETTO (after line discount)
      const lineTotal = qty * price;
      const lineDiscountAmount = lineTotal * (lineDiscount / 100);
      const lineNetto = lineTotal - lineDiscountAmount;

      // Line VAT (only if VAT enabled)
      let lineVatRate = 0;
      if (vatEnabled) {
        // Use line-specific VAT rate, or company default if empty
        const itemVatRate = parseFloat(item.vat_rate);
        lineVatRate = !isNaN(itemVatRate) && item.vat_rate.trim() !== ''
          ? itemVatRate
          : (selectedCompany?.default_vat_rate || 0);
      }
      const lineVatAmount = lineNetto * (lineVatRate / 100);

      return { lineNetto, lineVatAmount, lineVatRate };
    });

    // Sum all line NETTOs = subtotal
    const itemsSubtotal = lineResults.reduce((sum, line) => sum + line.lineNetto, 0);

    // Apply total discount to subtotal (NEW SYSTEM: percent or fixed)
    const discountVal = parseFloat(discountValue) || 0;
    let totalDiscountAmount = 0;

    if (discountType === 'percent') {
      // Percentage discount (0-100%)
      totalDiscountAmount = itemsSubtotal * (discountVal / 100);
    } else {
      // Fixed discount (CHF amount)
      totalDiscountAmount = discountVal;
    }

    // Ensure discount doesn't exceed subtotal
    totalDiscountAmount = Math.min(totalDiscountAmount, itemsSubtotal);
    const subtotalAfterDiscount = itemsSubtotal - totalDiscountAmount;

    // Adjust VAT proportionally after total discount
    const discountFactor = itemsSubtotal > 0 ? subtotalAfterDiscount / itemsSubtotal : 1;
    const totalVatBeforeDiscount = lineResults.reduce((sum, line) => sum + line.lineVatAmount, 0);
    const vat_amount = totalVatBeforeDiscount * discountFactor;

    // Grand total = discounted NETTO + VAT
    const total = subtotalAfterDiscount + vat_amount;

    return {
      subtotal: itemsSubtotal,
      discountAmount: totalDiscountAmount,
      vat_amount,
      total,
      lineVatAmounts: lineResults.map(line => line.lineVatAmount * discountFactor),
    };
  };

  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: '1', unit_price: '', discount_percent: '0', vat_rate: '' }]);
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
      // Use product.vat_rate OR company.default_vat_rate (only if VAT enabled)
      let effectiveVatRate = '';
      if (selectedCompany?.vat_enabled) {
        if (product.vat_rate !== null) {
          effectiveVatRate = product.vat_rate.toString();
        } else {
          // Empty string means "use company default" - will be handled in calculations
          effectiveVatRate = '';
        }
      }

      const newItems = [...items];
      newItems[index] = {
        ...newItems[index],
        product_id: productId,
        description: `${product.name} (${product.unit})`,
        unit_price: product.price.toString(),
        vat_rate: effectiveVatRate,
      };
      setItems(newItems);
    }
  };

  const loadCompanyTemplate = () => {
    if (selectedCompany) {
      setIntroText(selectedCompany.invoice_intro_text || '');
      setFooterText(selectedCompany.invoice_footer_text || '');
    }
  };

  const handleTimeEntryImport = (importedItems: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    timeEntryIds: string[];
  }>) => {
    // Add imported items to the items list
    const newItems: ItemState[] = importedItems.map(item => ({
      description: item.description,
      quantity: item.quantity.toString(),
      unit_price: item.unit_price.toString(),
      discount_percent: '0',
      vat_rate: '', // Use company default
    }));

    // Remove empty first item if present
    setItems(prev => {
      const hasOnlyEmptyItem = prev.length === 1 && isHtmlEmpty(prev[0].description) && !prev[0].unit_price;
      return hasOnlyEmptyItem ? newItems : [...prev, ...newItems];
    });

    // Collect all time entry IDs for later update
    const allTimeEntryIds = importedItems.flatMap(item => item.timeEntryIds);
    setImportedTimeEntryIds(prev => [...prev, ...allTimeEntryIds]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const totals = calculateTotals();

      // Get effective VAT rate for each item (for database storage)
      const getEffectiveVatRate = (item: ItemState) => {
        if (!selectedCompany?.vat_enabled) return 0;

        const itemVatRate = parseFloat(item.vat_rate);
        if (!isNaN(itemVatRate) && item.vat_rate.trim() !== '') {
          return itemVatRate;
        }
        return selectedCompany?.default_vat_rate || 0;
      };

      const invoiceData: InvoiceFormData = {
        invoice: {
          company_id: selectedCompany!.id,
          invoice_number: invoiceNumber,
          customer_id: customerId,
          project_id: projectId || null,
          issue_date: issueDate,
          due_date: dueDate || null,
          vat_rate: selectedCompany?.default_vat_rate || 0,
          status,
          paid_at: null,
          title: title || null,
          introduction_text: introText || null,
          footer_text: footerText || null,
          // Discount system (Task 3.2)
          discount_type: discountType,
          discount_value: parseFloat(discountValue) || 0,
        },
        items: items
          .filter(item => !isHtmlEmpty(item.description) && item.unit_price)
          .map((item, index) => ({
            description: item.description,
            quantity: parseFloat(item.quantity) || 1,
            unit_price: parseFloat(item.unit_price),
            discount_percent: parseFloat(item.discount_percent) || 0,
            vat_rate: getEffectiveVatRate(item),
            vat_amount: totals.lineVatAmounts?.[index] || 0,
          })),
      };

      await onSubmit(invoiceData, { subtotal: totals.subtotal, vat_amount: totals.vat_amount, total: totals.total, discountAmount: totals.discountAmount }, importedTimeEntryIds.length > 0 ? importedTimeEntryIds : undefined);
    } catch (error) {
      console.error('Error submitting invoice:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totals = calculateTotals();

  // Calculate line total with discount for display
  const getLineTotal = (item: ItemState) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unit_price) || 0;
    const discount = parseFloat(item.discount_percent) || 0;
    const subtotal = qty * price;
    const discountAmount = subtotal * (discount / 100);
    return subtotal - discountAmount;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        {isEditMode ? 'Rechnung bearbeiten' : 'Neue Rechnung'}
      </h2>

      {/* Warning for editing sent/overdue invoices */}
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
        {/* Customer, Project, Invoice Number */}
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
            <label htmlFor="invoiceNumber" className="block text-sm font-medium text-gray-700 mb-1">
              Rechnungsnummer
            </label>
            <input
              type="text"
              id="invoiceNumber"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 font-medium text-gray-900"
              readOnly
            />
          </div>
        </div>

        {/* Title (new) */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Titel / Betreff (optional)
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z.B. Webentwicklung Januar 2026"
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
          />
        </div>

        {/* Dates and Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="issueDate" className="block text-sm font-medium text-gray-700 mb-1">
              Rechnungsdatum <span className="text-red-500">*</span>
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
            <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-1">
              Fällig am
            </label>
            <input
              type="date"
              id="dueDate"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
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
              onChange={(e) => setStatus(e.target.value as Invoice['status'])}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
            >
              <option value="entwurf">Entwurf</option>
              <option value="versendet">Versendet</option>
              <option value="bezahlt">Bezahlt</option>
              <option value="überfällig">Überfällig</option>
            </select>
          </div>
        </div>

        {/* Introduction Text (new) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="introText" className="block text-sm font-medium text-gray-700">
              Einleitungstext (optional)
            </label>
            <button
              type="button"
              onClick={loadCompanyTemplate}
              className="text-xs text-brand hover:underline"
            >
              Vorlage laden
            </button>
          </div>
          <textarea
            id="introText"
            value={introText}
            onChange={(e) => setIntroText(e.target.value)}
            placeholder="Einleitungstext für die Rechnung..."
            rows={2}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition resize-none"
          />
        </div>

        {/* Items Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Positionen</h3>
            <div className="flex items-center gap-2">
              {/* Time Entry Import Button - only show when customer is selected */}
              {customerId && (
                <button
                  type="button"
                  onClick={() => setIsTimeImportModalOpen(true)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium bg-brand/10 text-brand hover:bg-brand/20 transition flex items-center gap-2"
                >
                  <Clock size={16} />
                  Zeiten laden
                </button>
              )}
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

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/50">
                {/* Row 1: Product, Qty, Price, VAT, Discount, Delete */}
                <div className="grid grid-cols-12 gap-2 items-end">
                  {/* Product Selector */}
                  <div className="col-span-3">
                    {index === 0 && (
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Produkt
                      </label>
                    )}
                    <select
                      value={item.product_id || ''}
                      onChange={(e) => handleProductSelect(index, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition text-sm bg-white"
                    >
                      <option value="">Frei</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity */}
                  <div className="col-span-2">
                    {index === 0 && (
                      <label className="block text-xs font-medium text-gray-600 mb-1">
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
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition text-sm bg-white"
                    />
                  </div>

                  {/* Unit Price */}
                  <div className="col-span-2">
                    {index === 0 && (
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Preis (CHF)
                      </label>
                    )}
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition text-sm bg-white"
                    />
                  </div>

                  {/* VAT Rate (conditional - only if VAT enabled) */}
                  {selectedCompany?.vat_enabled && (
                    <div className="col-span-2">
                      {index === 0 && (
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          MWST %
                        </label>
                      )}
                      <input
                        type="number"
                        value={item.vat_rate}
                        onChange={(e) => handleItemChange(index, 'vat_rate', e.target.value)}
                        placeholder={selectedCompany.default_vat_rate.toString()}
                        step="0.1"
                        min="0"
                        max="100"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition text-sm bg-white"
                      />
                    </div>
                  )}

                  {/* Line Discount (conditional) */}
                  {showDiscounts && (
                    <div className="col-span-2">
                      {index === 0 && (
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Rabatt %
                        </label>
                      )}
                      <input
                        type="number"
                        value={item.discount_percent}
                        onChange={(e) => handleItemChange(index, 'discount_percent', e.target.value)}
                        placeholder="0"
                        step="0.1"
                        min="0"
                        max="100"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition text-sm bg-white"
                      />
                    </div>
                  )}

                  {/* Spacer + Delete */}
                  <div className={`flex items-end justify-between ${selectedCompany?.vat_enabled && showDiscounts ? 'col-span-3' : selectedCompany?.vat_enabled || showDiscounts ? 'col-span-3' : 'col-span-5'}`}>
                    <div className="text-sm text-gray-600">
                      <span className="font-semibold text-gray-900">
                        CHF {getLineTotal(item).toFixed(2)}
                      </span>
                      {showDiscounts && parseFloat(item.discount_percent) > 0 && (
                        <span className="text-xs text-green-600 ml-1.5">
                          -{item.discount_percent}%
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      disabled={items.length === 1}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Row 2: Description – Rich Text Editor (full width) */}
                <div>
                  {index === 0 && (
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Beschreibung <span className="text-red-500">*</span>
                      <span className="ml-1 font-normal text-gray-400">(Text auswählen für Formatierung)</span>
                    </label>
                  )}
                  <RichTextEditor
                    value={item.description}
                    onChange={(html) => handleItemChange(index, 'description', html)}
                    placeholder="Beschreibung der Position..."
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Text (new) */}
        <div>
          <label htmlFor="footerText" className="block text-sm font-medium text-gray-700 mb-1">
            Bemerkungen / Fusstext (optional)
          </label>
          <textarea
            id="footerText"
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            placeholder="Bemerkungen oder zusätzliche Informationen..."
            rows={2}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition resize-none"
          />
        </div>

        {/* Totals Section */}
        <div className="border-t pt-4">
          <div className="max-w-sm ml-auto space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Zwischentotal (Netto):</span>
              <span className="font-medium">CHF {totals.subtotal.toFixed(2)}</span>
            </div>

            {/* Total Discount (conditional) - NEW SYSTEM */}
            {showDiscounts && (
              <div className="flex justify-between text-sm items-center gap-4">
                <span className="text-gray-600">Gesamtrabatt:</span>
                <div className="flex items-center gap-2">
                  {/* Toggle Button for Type */}
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

                  {/* Value Input */}
                  <input
                    type="number"
                    value={discountValue}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      // Validation: percent max 100, fixed max subtotal
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

                  {/* Discount Amount Display */}
                  {totals.discountAmount > 0 && (
                    <span className="font-medium text-green-600">
                      -CHF {totals.discountAmount.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* VAT - only show if VAT enabled */}
            {selectedCompany?.vat_enabled && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">MWST (per Position):</span>
                <span className="font-medium">CHF {totals.vat_amount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-lg font-bold text-brand border-t pt-2">
              <span>Gesamttotal:</span>
              <span>CHF {totals.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isSubmitting || items.length === 0}
            className="rounded-lg px-4 py-2 font-medium bg-brand text-white hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Speichert...' : isEditMode ? 'Änderungen speichern' : 'Rechnung speichern'}
          </button>
        </div>
      </form>

      {/* Time Entry Import Modal */}
      <TimeEntryImportModal
        isOpen={isTimeImportModalOpen}
        onClose={() => setIsTimeImportModalOpen(false)}
        customerId={customerId}
        projectId={projectId}
        onImport={handleTimeEntryImport}
      />
    </div>
  );
}
