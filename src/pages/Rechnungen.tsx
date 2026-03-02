import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Invoice, InvoiceItem, Customer, Project, Company } from '../lib/supabase';
import InvoiceForm from '../components/InvoiceForm';
import InvoiceTable from '../components/InvoiceTable';
import Modal from '../components/Modal';
import PdfPreviewModal from '../components/PdfPreviewModal';
import { downloadInvoicePDF, getInvoicePdfBlobUrl } from '../utils/pdfGenerator';
import { validateInvoiceData } from '../utils/invoiceValidation';
import { canEditInvoice, getEditBlockedReason } from '../utils/invoiceUtils';
import { useCompany } from '../context/CompanyContext';
import { Plus, AlertCircle } from 'lucide-react';

type InvoiceFormData = {
  invoice: Omit<Invoice, 'id' | 'created_at' | 'subtotal' | 'vat_amount' | 'total' | 'total_discount_percent'>;
  items: Array<Omit<InvoiceItem, 'id' | 'invoice_id' | 'total'>>;
};

interface Toast {
  type: 'success' | 'error';
  message: string;
}

export default function Rechnungen() {
  const { selectedCompany } = useCompany();
  const [searchParams, setSearchParams] = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState(`RE-${new Date().getFullYear()}-001`);
  const [toast, setToast] = useState<Toast | null>(null);
  const isFetchingRef = useRef(false);

  // Edit mode state
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editingItems, setEditingItems] = useState<InvoiceItem[]>([]);

  // PDF Preview state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [previewData, setPreviewData] = useState<{
    invoice: Invoice;
    items: InvoiceItem[];
    customer: Customer;
    company: Company;
    logoBase64?: string | null;
    introText?: string | null;
    footerText?: string | null;
  } | null>(null);

  useEffect(() => {
    console.log('[Rechnungen] useEffect triggered, selectedCompany:', selectedCompany?.name);
    if (selectedCompany) {
      console.log('[Rechnungen] Calling fetchData...');
      fetchData();
    }
  }, [selectedCompany]);

  // Auto-hide toast after 5 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Handle query parameter for opening specific invoice
  useEffect(() => {
    const invoiceId = searchParams.get('id');
    if (invoiceId && invoices.length > 0) {
      const invoice = invoices.find(i => i.id === invoiceId);
      if (invoice) {
        handleEdit(invoice);
        setSearchParams({}); // Clear query param after opening
      }
    }
  }, [searchParams, invoices]);

  // Early return if no company selected
  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Firma wird geladen...</p>
      </div>
    );
  }

  const fetchData = async () => {
    console.log('[Rechnungen] fetchData called for company:', selectedCompany?.name);
    if (!selectedCompany) return;

    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      console.log('[Rechnungen] Already fetching, skipping duplicate call');
      return;
    }

    try {
      isFetchingRef.current = true;
      setIsLoading(true);
      setError(null);

      console.log('[Rechnungen] Fetching data...');

      const [invoicesResult, customersResult, projectsResult] = await Promise.all([
        supabase
          .from('invoices')
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
      ]);

      if (invoicesResult.error) throw invoicesResult.error;
      if (customersResult.error) throw customersResult.error;
      if (projectsResult.error) throw projectsResult.error;

      setInvoices(invoicesResult.data || []);
      setCustomers(customersResult.data || []);
      setProjects(projectsResult.data || []);

      console.log('[Rechnungen] Data fetched successfully:', {
        invoices: invoicesResult.data?.length || 0,
        customers: customersResult.data?.length || 0,
        projects: projectsResult.data?.length || 0
      });

      // Generate next invoice number (COMPANY-SPECIFIC)
      // Find the highest invoice number for the current year
      const currentYear = new Date().getFullYear();
      let highestNumber = 0;

      if (invoicesResult.data && invoicesResult.data.length > 0) {
        for (const invoice of invoicesResult.data) {
          const invoiceNumber = (invoice as any).invoice_number;
          const match = invoiceNumber?.match(/RE-(\d{4})-(\d{3})/);
          if (match) {
            const invoiceYear = parseInt(match[1]);
            const num = parseInt(match[2]);
            // Only consider invoices from current year
            if (invoiceYear === currentYear && num > highestNumber) {
              highestNumber = num;
            }
          }
        }
      }

      // Set next invoice number
      setNextInvoiceNumber(`RE-${currentYear}-${String(highestNumber + 1).padStart(3, '0')}`);
    } catch (err) {
      console.error('[Rechnungen] Error fetching data:', err);
      setError('Fehler beim Laden der Daten. Bitte überprüfen Sie Ihre Supabase-Konfiguration.');
    } finally {
      console.log('[Rechnungen] fetchData completed, setting isLoading to false');
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  };

  const handleSubmit = async (
    data: InvoiceFormData,
    calculatedTotals: { subtotal: number; vat_amount: number; total: number; discountAmount?: number },
    timeEntryIds?: string[]
  ) => {
    if (!selectedCompany) return;

    const isUpdate = !!editingInvoice;

    try {
      // Ensure session variable is set (fixes RLS policy enforcement)
      const { error: sessionError } = await supabase.rpc('set_active_company', {
        company_id: selectedCompany.id
      });

      if (sessionError) {
        console.error('Failed to set active company:', sessionError);
        throw sessionError;
      }

      // Helper to calculate item total with discount
      const calculateItemTotal = (item: typeof data.items[0]) => {
        const lineTotal = item.quantity * item.unit_price;
        const discountAmount = lineTotal * ((item.discount_percent || 0) / 100);
        return lineTotal - discountAmount;
      };

      if (isUpdate) {
        // UPDATE MODE: Update existing invoice
        const { error: invoiceError } = await supabase
          .from('invoices')
          .update({
            customer_id: data.invoice.customer_id,
            project_id: data.invoice.project_id,
            issue_date: data.invoice.issue_date,
            due_date: data.invoice.due_date,
            vat_rate: data.invoice.vat_rate,
            status: data.invoice.status,
            paid_at: data.invoice.paid_at,
            subtotal: calculatedTotals.subtotal,
            vat_amount: calculatedTotals.vat_amount,
            total: calculatedTotals.total,
            // New fields for Phase 3.3
            title: data.invoice.title,
            introduction_text: data.invoice.introduction_text,
            footer_text: data.invoice.footer_text,
            // Discount system (Task 3.2)
            discount_type: data.invoice.discount_type,
            discount_value: data.invoice.discount_value,
          })
          .eq('id', editingInvoice.id);

        if (invoiceError) throw invoiceError;

        // DATA INTEGRITY: Delete all old items and insert new ones
        // This is the safest approach - no complex ID matching required
        const { error: deleteError } = await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', editingInvoice.id);

        if (deleteError) throw deleteError;

        // Insert new items with discount and VAT
        const itemsWithInvoiceId = data.items.map(item => ({
          invoice_id: editingInvoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent || 0,
          vat_rate: item.vat_rate,
          vat_amount: item.vat_amount,
          total: calculateItemTotal(item),
        }));

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(itemsWithInvoiceId as any);

        if (itemsError) throw itemsError;

        handleCloseModal();
        setToast({ type: 'success', message: 'Rechnung erfolgreich aktualisiert!' });
        await fetchData();
      } else {
        // CREATE MODE: Insert new invoice
        const { data: invoiceData, error: invoiceError } = await supabase
          .from('invoices')
          .insert([{
            ...data.invoice,
            company_id: selectedCompany.id,
            subtotal: calculatedTotals.subtotal,
            vat_amount: calculatedTotals.vat_amount,
            total: calculatedTotals.total,
          }] as any)
          .select()
          .single();

        if (invoiceError) throw invoiceError;

        // Insert invoice items with discount and VAT
        const itemsWithInvoiceId = data.items.map(item => ({
          invoice_id: (invoiceData as any).id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent || 0,
          vat_rate: item.vat_rate,
          vat_amount: item.vat_amount,
          total: calculateItemTotal(item),
        }));

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(itemsWithInvoiceId as any);

        if (itemsError) throw itemsError;

        // Link time entries to the new invoice (atomic update)
        if (timeEntryIds && timeEntryIds.length > 0) {
          const { error: timeEntriesError } = await supabase
            .from('time_entries')
            .update({ invoice_id: (invoiceData as any).id })
            .in('id', timeEntryIds);

          if (timeEntriesError) {
            console.error('Error linking time entries:', timeEntriesError);
            // Don't throw - invoice was created successfully, just warn
            setToast({
              type: 'success',
              message: `Rechnung erstellt, aber ${timeEntryIds.length} Zeiteinträge konnten nicht verknüpft werden.`
            });
          } else {
            setToast({ type: 'success', message: `Rechnung erfolgreich erstellt mit ${timeEntryIds.length} verknüpften Zeiteinträgen!` });
          }
        } else {
          setToast({ type: 'success', message: 'Rechnung erfolgreich erstellt!' });
        }

        handleCloseModal();
        await fetchData();
      }
    } catch (err: any) {
      console.error('Error saving invoice:', err);
      // Show user-friendly error message
      if (err?.code === '23505') {
        setToast({
          type: 'error',
          message: `Rechnungsnummer "${data.invoice.invoice_number}" existiert bereits. Bitte wählen Sie eine andere Nummer.`
        });
      } else {
        setToast({
          type: 'error',
          message: 'Fehler beim Speichern der Rechnung: ' + (err?.message || 'Unbekannter Fehler')
        });
      }
      throw err;
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Möchten Sie diese Rechnung wirklich löschen?')) return;

    try {
      // First, unlink any time entries from this invoice (set invoice_id to NULL)
      // This is redundant with ON DELETE SET NULL but provides explicit control
      await supabase
        .from('time_entries')
        .update({ invoice_id: null })
        .eq('invoice_id', id);

      // Delete invoice items first (cascade should handle this, but being explicit)
      await supabase.from('invoice_items').delete().eq('invoice_id', id);

      // Delete invoice
      const { error } = await supabase.from('invoices').delete().eq('id', id);

      if (error) throw error;
      setToast({ type: 'success', message: 'Rechnung und Verknüpfungen erfolgreich gelöscht.' });
      await fetchData();
    } catch (err) {
      console.error('Error deleting invoice:', err);
      setToast({ type: 'error', message: 'Fehler beim Löschen der Rechnung.' });
    }
  };

  const handleAddNew = () => {
    // Reset edit mode for new invoice
    setEditingInvoice(null);
    setEditingItems([]);
    setIsModalOpen(true);
  };

  const handleEdit = async (invoice: Invoice) => {
    // Check if editing is allowed
    if (!canEditInvoice(invoice.status)) {
      setToast({ type: 'error', message: getEditBlockedReason(invoice.status) });
      return;
    }

    try {
      // Fetch invoice items
      const { data: items, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('id', { ascending: true });

      if (error) throw error;

      setEditingInvoice(invoice);
      setEditingItems(items || []);
      setIsModalOpen(true);
    } catch (err) {
      console.error('Error loading invoice items:', err);
      setToast({ type: 'error', message: 'Fehler beim Laden der Rechnungspositionen.' });
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingInvoice(null);
    setEditingItems([]);
  };

  // Helper function to prepare PDF data (shared by preview and download)
  const preparePdfData = async (invoice: Invoice) => {
    if (!selectedCompany) {
      throw new Error('Keine Firma ausgewählt');
    }

    // Fetch invoice items and fresh company data in parallel
    const [itemsResult, companyResult] = await Promise.all([
      supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id),
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
    const customer = customers.find((c) => c.id === invoice.customer_id);
    if (!customer) {
      throw new Error('Kunde nicht gefunden');
    }

    // Validate data
    const validation = validateInvoiceData(
      { ...invoice, items: items || [] },
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
      invoice,
      items: items || [],
      customer,
      company: freshCompanyData,
      logoBase64,
      // Use invoice-specific texts if available, otherwise pdfGenerator falls back to company defaults
      introText: invoice.introduction_text,
      footerText: invoice.footer_text,
    };
  };

  const handlePreviewPDF = async (invoice: Invoice) => {
    try {
      const data = await preparePdfData(invoice);
      const blobUrl = await getInvoicePdfBlobUrl(data);

      setPreviewInvoice(invoice);
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
    setPreviewInvoice(null);
    setPreviewData(null);
  };

  const handlePreviewDownload = async () => {
    if (!previewData) return;

    try {
      await downloadInvoicePDF(previewData);
      setToast({ type: 'success', message: 'PDF erfolgreich heruntergeladen' });
    } catch (err) {
      console.error('Error downloading PDF:', err);
      setToast({
        type: 'error',
        message: `Fehler beim Herunterladen: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`,
      });
    }
  };

  const handleDownloadPDF = async (invoice: Invoice) => {
    try {
      const data = await preparePdfData(invoice);
      await downloadInvoicePDF(data);
      setToast({ type: 'success', message: 'PDF erfolgreich erstellt' });
    } catch (err) {
      console.error('Error generating PDF:', err);
      setToast({
        type: 'error',
        message: `Fehler beim Erstellen des PDFs: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rechnungen</h1>
          <p className="text-gray-600 mt-1">Erstellen und verwalten Sie Ihre Rechnungen</p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition"
        >
          <Plus size={20} />
          Neue Rechnung
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
          Bitte erstellen Sie zuerst Kunden, bevor Sie Rechnungen erstellen.
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-gray-500 text-center">Lädt Rechnungen...</p>
        </div>
      ) : (
        <InvoiceTable
          invoices={invoices}
          customers={customers}
          onDelete={handleDelete}
          onDownloadPDF={handleDownloadPDF}
          onPreviewPDF={handlePreviewPDF}
          onEdit={handleEdit}
        />
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingInvoice ? 'Rechnung bearbeiten' : 'Neue Rechnung'}
        size="xl"
      >
        <InvoiceForm
          onSubmit={handleSubmit}
          customers={customers}
          projects={projects}
          nextInvoiceNumber={nextInvoiceNumber}
          existingInvoice={editingInvoice || undefined}
          existingItems={editingItems.length > 0 ? editingItems : undefined}
        />
      </Modal>

      {/* PDF Preview Modal */}
      <PdfPreviewModal
        isOpen={isPreviewOpen}
        onClose={handlePreviewClose}
        pdfBlobUrl={previewBlobUrl}
        onDownload={handlePreviewDownload}
        title="Rechnungs-Vorschau"
        fileName={previewInvoice ? `Rechnung_${previewInvoice.invoice_number}.pdf` : ''}
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
