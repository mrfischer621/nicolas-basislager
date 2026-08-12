import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Quote, QuoteItem, Customer, Project, Company } from '../lib/supabase';
import QuoteForm from '../components/QuoteForm';
import QuoteTable from '../components/QuoteTable';
import QuoteToInvoiceModal from '../components/QuoteToInvoiceModal';
import Modal from '../components/Modal';
import PdfPreviewModal from '../components/PdfPreviewModal';
import { downloadQuotePDF, getQuotePdfBlobUrl } from '../utils/pdfLazy';
import { validateQuoteData } from '../utils/quoteValidation';
import { canEditQuote, getEditBlockedReason } from '../utils/quoteUtils';
import { useCompany } from '../context/CompanyContext';
import { Plus, AlertCircle } from 'lucide-react';

type QuoteFormData = {
  quote: Omit<Quote, 'id' | 'created_at' | 'updated_at' | 'subtotal' | 'vat_amount' | 'total'>;
  items: Array<Omit<QuoteItem, 'id' | 'quote_id' | 'total'>>;
};

interface Toast {
  type: 'success' | 'error';
  message: string;
}

export default function Angebote() {
  const { selectedCompany } = useCompany();
  const [searchParams] = useSearchParams();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [convertingQuote, setConvertingQuote] = useState<Quote | null>(null);
  const [convertingQuoteItems, setConvertingQuoteItems] = useState<QuoteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextQuoteNumber, setNextQuoteNumber] = useState(`AN-${new Date().getFullYear()}-001`);
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState(`RE-${new Date().getFullYear()}-001`);
  const [toast, setToast] = useState<Toast | null>(null);
  const isFetchingRef = useRef(false);

  // Edit mode state
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [editingItems, setEditingItems] = useState<QuoteItem[]>([]);

  // PDF Preview state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewQuote, setPreviewQuote] = useState<Quote | null>(null);
  const [previewData, setPreviewData] = useState<{
    quote: Quote;
    items: QuoteItem[];
    customer: Customer;
    company: Company;
    logoBase64?: string | null;
    introText?: string | null;
    footerText?: string | null;
  } | null>(null);

  // Get URL params for Sales Pipeline integration
  const initialCustomerId = searchParams.get('customerId') || undefined;
  const initialOpportunityId = searchParams.get('opportunityId') || undefined;

  useEffect(() => {
    if (selectedCompany) {
      fetchData();
    }
  }, [selectedCompany]);

  // Auto-open form if coming from Sales Pipeline with customerId
  useEffect(() => {
    if (initialCustomerId && customers.length > 0) {
      setIsModalOpen(true);
    }
  }, [initialCustomerId, customers]);

  // Auto-hide toast after 5 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Early return if no company selected
  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Firma wird geladen...</p>
      </div>
    );
  }

  const fetchData = async () => {
    if (!selectedCompany) return;

    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      return;
    }

    try {
      isFetchingRef.current = true;
      setIsLoading(true);
      setError(null);

      const [quotesResult, customersResult, projectsResult, invoicesResult] = await Promise.all([
        supabase
          .from('quotes')
          .select('*')
          .eq('company_id', selectedCompany.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('customers')
          .select('*')
          .eq('company_id', selectedCompany.id)
          .order('name', { ascending: true }),
        supabase
          .from('projects')
          .select('*')
          .eq('company_id', selectedCompany.id)
          .order('name', { ascending: true }),
        supabase
          .from('invoices')
          .select('invoice_number')
          .eq('company_id', selectedCompany.id),
      ]);

      if (quotesResult.error) throw quotesResult.error;
      if (customersResult.error) throw customersResult.error;
      if (projectsResult.error) throw projectsResult.error;
      if (invoicesResult.error) throw invoicesResult.error;

      setQuotes(quotesResult.data || []);
      setCustomers(customersResult.data || []);
      setProjects(projectsResult.data || []);

      // Generate next quote number (COMPANY-SPECIFIC)
      const currentYear = new Date().getFullYear();
      let highestQuoteNumber = 0;

      if (quotesResult.data && quotesResult.data.length > 0) {
        for (const quote of quotesResult.data) {
          const quoteNumber = (quote as any).quote_number;
          const match = quoteNumber?.match(/AN-(\d{4})-(\d{3})/);
          if (match) {
            const quoteYear = parseInt(match[1]);
            const num = parseInt(match[2]);
            if (quoteYear === currentYear && num > highestQuoteNumber) {
              highestQuoteNumber = num;
            }
          }
        }
      }
      setNextQuoteNumber(`AN-${currentYear}-${String(highestQuoteNumber + 1).padStart(3, '0')}`);

      // Generate next invoice number (for conversion)
      let highestInvoiceNumber = 0;
      if (invoicesResult.data && invoicesResult.data.length > 0) {
        for (const invoice of invoicesResult.data) {
          const invoiceNumber = (invoice as any).invoice_number;
          const match = invoiceNumber?.match(/RE-(\d{4})-(\d{3})/);
          if (match) {
            const invoiceYear = parseInt(match[1]);
            const num = parseInt(match[2]);
            if (invoiceYear === currentYear && num > highestInvoiceNumber) {
              highestInvoiceNumber = num;
            }
          }
        }
      }
      setNextInvoiceNumber(`RE-${currentYear}-${String(highestInvoiceNumber + 1).padStart(3, '0')}`);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Fehler beim Laden der Daten. Bitte überprüfen Sie Ihre Supabase-Konfiguration.');
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  };

  const handleSubmit = async (
    data: QuoteFormData,
    calculatedTotals: { subtotal: number; vat_amount: number; total: number }
  ) => {
    if (!selectedCompany) return;

    const isUpdate = !!editingQuote;

    try {
      // Ensure session variable is set (fixes RLS policy enforcement)
      const { error: sessionError } = await supabase.rpc('set_active_company', {
        company_id: selectedCompany.id
      });

      if (sessionError) {
        console.error('Failed to set active company:', sessionError);
        throw sessionError;
      }

      if (isUpdate) {
        // UPDATE MODE: Update existing quote
        const { error: quoteError } = await supabase
          .from('quotes')
          .update({
            customer_id: data.quote.customer_id,
            project_id: data.quote.project_id,
            issue_date: data.quote.issue_date,
            valid_until: data.quote.valid_until,
            vat_rate: data.quote.vat_rate,
            status: data.quote.status,
            subtotal: calculatedTotals.subtotal,
            vat_amount: calculatedTotals.vat_amount,
            total: calculatedTotals.total,
            // Discount system (Task 3.2)
            discount_type: data.quote.discount_type,
            discount_value: data.quote.discount_value,
            // Per-quote text overrides
            intro_text: data.quote.intro_text ?? null,
            outro_text: data.quote.outro_text ?? null,
          })
          .eq('id', editingQuote.id);

        if (quoteError) throw quoteError;

        // DATA INTEGRITY: Delete all old items and insert new ones
        // This is the safest approach - no complex ID matching required
        const { error: deleteError } = await supabase
          .from('quote_items')
          .delete()
          .eq('quote_id', editingQuote.id);

        if (deleteError) throw deleteError;

        // Insert new items
        const itemsWithQuoteId = data.items.map((item, index) => ({
          quote_id: editingQuote.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.quantity * item.unit_price,
          sort_order: index,
        }));

        const { error: itemsError } = await supabase
          .from('quote_items')
          .insert(itemsWithQuoteId as any);

        if (itemsError) throw itemsError;

        handleCloseModal();
        setToast({ type: 'success', message: 'Angebot erfolgreich aktualisiert!' });
        await fetchData();
      } else {
        // CREATE MODE: Insert new quote
        const { data: quoteData, error: quoteError } = await supabase
          .from('quotes')
          .insert([{
            ...data.quote,
            company_id: selectedCompany.id,
            subtotal: calculatedTotals.subtotal,
            vat_amount: calculatedTotals.vat_amount,
            total: calculatedTotals.total,
          }] as any)
          .select()
          .single();

        if (quoteError) throw quoteError;

        // Insert quote items
        const itemsWithQuoteId = data.items.map((item, index) => ({
          quote_id: (quoteData as any).id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.quantity * item.unit_price,
          sort_order: index,
        }));

        const { error: itemsError } = await supabase
          .from('quote_items')
          .insert(itemsWithQuoteId as any);

        if (itemsError) throw itemsError;

        handleCloseModal();
        setToast({ type: 'success', message: 'Angebot erfolgreich erstellt!' });
        await fetchData();
      }
    } catch (err: any) {
      console.error('Error saving quote:', err);
      if (err?.code === '23505') {
        setToast({
          type: 'error',
          message: `Angebotsnummer "${data.quote.quote_number}" existiert bereits. Bitte wählen Sie eine andere Nummer.`
        });
      } else {
        setToast({
          type: 'error',
          message: 'Fehler beim Speichern des Angebots: ' + (err?.message || 'Unbekannter Fehler')
        });
      }
      throw err;
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // Delete quote items first (cascade should handle this, but being explicit)
      await supabase.from('quote_items').delete().eq('quote_id', id);

      // Delete quote
      const { error } = await supabase.from('quotes').delete().eq('id', id);

      if (error) throw error;
      setToast({ type: 'success', message: 'Angebot erfolgreich gelöscht!' });
      await fetchData();
    } catch (err) {
      console.error('Error deleting quote:', err);
      setToast({ type: 'error', message: 'Fehler beim Löschen des Angebots.' });
    }
  };

  const handleAddNew = () => {
    // Reset edit mode for new quote
    setEditingQuote(null);
    setEditingItems([]);
    setIsModalOpen(true);
  };

  const handleEdit = async (quote: Quote) => {
    // Check if editing is allowed
    if (!canEditQuote(quote.status)) {
      setToast({ type: 'error', message: getEditBlockedReason(quote.status) });
      return;
    }

    try {
      // Fetch quote items
      const { data: items, error } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quote.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      setEditingQuote(quote);
      setEditingItems(items || []);
      setIsModalOpen(true);
    } catch (err) {
      console.error('Error loading quote items:', err);
      setToast({ type: 'error', message: 'Fehler beim Laden der Angebotspositionen.' });
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingQuote(null);
    setEditingItems([]);
  };

  // Helper function to prepare PDF data (shared by preview and download)
  const preparePdfData = async (quote: Quote) => {
    if (!selectedCompany) {
      throw new Error('Keine Firma ausgewählt');
    }

    // Fetch quote items and fresh company data in parallel
    const [itemsResult, companyResult] = await Promise.all([
      supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quote.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('companies')
        .select('*')
        .eq('id', selectedCompany.id)
        .single()
    ]);

    if (itemsResult.error) throw itemsResult.error;
    if (companyResult.error) throw companyResult.error;

    const items = itemsResult.data;
    const freshCompanyData = companyResult.data;

    // Get customer
    const customer = customers.find((c) => c.id === quote.customer_id);
    if (!customer) {
      throw new Error('Kunde nicht gefunden');
    }

    // Validate data
    const validation = validateQuoteData(
      { ...quote, items: items || [] },
      freshCompanyData,
      customer
    );

    if (!validation.valid) {
      throw new Error(validation.errors.join(' • '));
    }

    // Prefetch logo as base64 so the PDF generator doesn't need a second network call
    let logoBase64: string | null = null;
    if (freshCompanyData.logo_url) {
      try {
        const resp = await fetch(freshCompanyData.logo_url);
        if (resp.ok) {
          const blob = await resp.blob();
          logoBase64 = await new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        }
      } catch {
        // Logo is optional — continue without it
      }
    }

    return {
      quote,
      items: items || [],
      customer,
      company: freshCompanyData,
      logoBase64,
      // Per-quote text overrides (null = fall back to company-level templates in PDF generator)
      introText: quote.intro_text ?? undefined,
      footerText: quote.outro_text ?? undefined,
    };
  };

  const handlePreviewPDF = async (quote: Quote) => {
    try {
      const data = await preparePdfData(quote);
      const blobUrl = await getQuotePdfBlobUrl(data);

      setPreviewQuote(quote);
      setPreviewData(data);
      setPreviewBlobUrl(blobUrl);
      setIsPreviewOpen(true);
    } catch (err) {
      console.error('Error generating PDF preview:', err);
      setToast({
        type: 'error',
        message: `Fehler beim Erstellen der Vorschau: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`,
      });
    }
  };

  const handlePreviewClose = () => {
    // Cleanup blob URL to prevent memory leaks
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
    }
    setIsPreviewOpen(false);
    setPreviewBlobUrl(null);
    setPreviewQuote(null);
    setPreviewData(null);
  };

  const handlePreviewDownload = async () => {
    if (!previewData) return;

    try {
      await downloadQuotePDF(previewData);
      setToast({ type: 'success', message: 'PDF erfolgreich heruntergeladen' });
    } catch (err) {
      console.error('Error downloading PDF:', err);
      setToast({
        type: 'error',
        message: `Fehler beim Herunterladen: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`,
      });
    }
  };

  const handleDownloadPDF = async (quote: Quote) => {
    try {
      const data = await preparePdfData(quote);
      await downloadQuotePDF(data);
      setToast({ type: 'success', message: 'PDF erfolgreich erstellt' });
    } catch (err) {
      console.error('Error generating PDF:', err);
      setToast({
        type: 'error',
        message: `Fehler beim Erstellen des PDFs: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`,
      });
    }
  };

  const handleConvertToInvoice = async (quote: Quote) => {
    try {
      // Fetch quote items
      const { data: items, error } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quote.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      setConvertingQuote(quote);
      setConvertingQuoteItems(items || []);
      setIsConvertModalOpen(true);
    } catch (err) {
      console.error('Error fetching quote items:', err);
      setToast({ type: 'error', message: 'Fehler beim Laden der Angebotspositionen.' });
    }
  };

  const handleConvertConfirm = async (data: {
    invoiceNumber: string;
    dueDate: string;
    items: Array<{ description: string; quantity: number; unit_price: number }>;
    vatRate: number;
  }) => {
    if (!selectedCompany || !convertingQuote) return;

    try {
      // Calculate totals
      const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
      const vatAmount = subtotal * (data.vatRate / 100);
      const total = subtotal + vatAmount;

      // Ensure session variable is set before INSERT
      await supabase.rpc('set_active_company', { company_id: selectedCompany.id });

      // Create invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          company_id: selectedCompany.id,
          invoice_number: data.invoiceNumber,
          customer_id: convertingQuote.customer_id,
          project_id: convertingQuote.project_id,
          issue_date: new Date().toISOString().split('T')[0],
          due_date: data.dueDate,
          subtotal,
          vat_rate: data.vatRate,
          vat_amount: vatAmount,
          total,
          status: 'entwurf',
          paid_at: null,
        }] as any)
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice items
      const invoiceItems = data.items.map((item) => ({
        invoice_id: (invoiceData as any).id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.quantity * item.unit_price,
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItems as any);

      if (itemsError) throw itemsError;

      // Update quote status to 'bestaetigt' and link to invoice
      const { error: updateError } = await supabase
        .from('quotes')
        .update({
          status: 'bestaetigt',
          converted_to_invoice_id: (invoiceData as any).id,
          converted_at: new Date().toISOString(),
        })
        .eq('id', convertingQuote.id);

      if (updateError) throw updateError;

      setIsConvertModalOpen(false);
      setConvertingQuote(null);
      setConvertingQuoteItems([]);
      setToast({ type: 'success', message: 'Rechnung erfolgreich erstellt!' });
      await fetchData();
    } catch (err: any) {
      console.error('Error converting quote to invoice:', err);
      setToast({
        type: 'error',
        message: 'Fehler beim Erstellen der Rechnung: ' + (err?.message || 'Unbekannter Fehler')
      });
      throw err;
    }
  };

  const getCustomerById = (customerId: string): Customer | undefined => {
    return customers.find((c) => c.id === customerId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Angebote</h1>
          <p className="text-gray-600 mt-1">Erstellen und verwalten Sie Ihre Angebote</p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition"
        >
          <Plus size={20} />
          Neues Angebot
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Warning if no customers */}
      {customers.length === 0 && !isLoading && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
          Bitte erstellen Sie zuerst Kunden, bevor Sie Angebote erstellen.
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-gray-500 text-center">Lädt Angebote...</p>
        </div>
      ) : (
        <QuoteTable
          quotes={quotes}
          customers={customers}
          onDelete={handleDelete}
          onDownloadPDF={handleDownloadPDF}
          onPreviewPDF={handlePreviewPDF}
          onConvertToInvoice={handleConvertToInvoice}
          onEdit={handleEdit}
        />
      )}

      {/* New/Edit Quote Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingQuote ? 'Angebot bearbeiten' : 'Neues Angebot'}
        size="xl"
      >
        <QuoteForm
          onSubmit={handleSubmit}
          customers={customers}
          projects={projects}
          nextQuoteNumber={nextQuoteNumber}
          initialCustomerId={editingQuote ? undefined : initialCustomerId}
          initialOpportunityId={editingQuote ? undefined : initialOpportunityId}
          existingQuote={editingQuote || undefined}
          existingItems={editingItems.length > 0 ? editingItems : undefined}
        />
      </Modal>

      {/* Convert to Invoice Modal */}
      <Modal
        isOpen={isConvertModalOpen}
        onClose={() => {
          setIsConvertModalOpen(false);
          setConvertingQuote(null);
          setConvertingQuoteItems([]);
        }}
        title="Angebot in Rechnung umwandeln"
        size="lg"
      >
        {convertingQuote && (
          <QuoteToInvoiceModal
            quote={convertingQuote}
            items={convertingQuoteItems}
            customer={getCustomerById(convertingQuote.customer_id)!}
            nextInvoiceNumber={nextInvoiceNumber}
            onConvert={handleConvertConfirm}
            onCancel={() => {
              setIsConvertModalOpen(false);
              setConvertingQuote(null);
              setConvertingQuoteItems([]);
            }}
          />
        )}
      </Modal>

      {/* PDF Preview Modal */}
      <PdfPreviewModal
        isOpen={isPreviewOpen}
        onClose={handlePreviewClose}
        pdfBlobUrl={previewBlobUrl}
        onDownload={handlePreviewDownload}
        title="Angebots-Vorschau"
        fileName={previewQuote ? `Angebot_${previewQuote.quote_number}.pdf` : ''}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md animate-slide-in">
          <div
            className={`flex items-start gap-3 rounded-lg px-4 py-3 shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            {toast.type === 'success' ? (
              <div className="flex-shrink-0 w-5 h-5 text-green-600">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            ) : (
              <AlertCircle
                className={`flex-shrink-0 ${toast.type === 'error' ? 'text-red-600' : 'text-green-600'}`}
                size={20}
              />
            )}
            <div className="flex-1">
              <p className={toast.type === 'success' ? 'text-green-800' : 'text-red-800'}>
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => setToast(null)}
              className={`flex-shrink-0 ${
                toast.type === 'success'
                  ? 'text-green-600 hover:text-green-800'
                  : 'text-red-600 hover:text-red-800'
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
