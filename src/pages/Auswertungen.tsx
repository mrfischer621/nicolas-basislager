import { useState, useMemo, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Calendar, BarChart3, FileText, Download, AlertCircle } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useAnalytics, getPresetRange, type DateRange } from '../hooks/useAnalytics';
import { supabase } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';
import type { Transaction, Category } from '../lib/supabase';

// Type for financial bookkeeping data
interface CategorySummary {
  categoryName: string;
  categoryColor: string;
  isTaxRelevant: boolean;
  total: number;
  count: number;
}

interface FinancialBookkeepingData {
  einnahmen: CategorySummary[];
  ausgaben: CategorySummary[];
  totalEinnahmen: number;
  totalAusgaben: number;
  gewinnVerlust: number;
}

// Type for CSV export
interface TransactionWithCategory extends Transaction {
  category_details?: Category | null;
}

// Format CHF currency
const formatCHF = (value: number) => {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

// Color palette - Sage brand colors
const COLORS = {
  income: '#166534', // success-dark (green-800)
  expense: '#991b1b', // danger-dark (red-800)
  profit: '#6b8a5e', // sage-500 (brand)
  primary: '#6b8a5e', // sage-500 (brand)
};

const PIE_COLORS = ['#6b8a5e', '#8aa67c', '#aec2a3', '#547047', '#435839', '#ced9c7', '#38472f', '#2f3a28'];

type ViewMode = 'charts' | 'bookkeeping';

export default function Auswertungen() {
  const { selectedCompany } = useCompany();

  // View mode toggle
  const [viewMode, setViewMode] = useState<ViewMode>('bookkeeping');

  // Default to last 90 days (Roadmap 1.2)
  const [selectedPreset, setSelectedPreset] = useState<string>('last_90_days');
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  // Financial bookkeeping data state
  const [bookkeepingData, setBookkeepingData] = useState<FinancialBookkeepingData | null>(null);
  const [bookkeepingLoading, setBookkeepingLoading] = useState(false);
  const [rawTransactions, setRawTransactions] = useState<TransactionWithCategory[]>([]);

  // Determine active date range - memoized to prevent infinite loop
  const dateRange = useMemo(() => {
    return customRange || getPresetRange(selectedPreset);
  }, [customRange, selectedPreset]);

  // Fetch analytics data
  const { loading, error, kpi, timeline, byCustomer, byCategory, byTags } = useAnalytics(dateRange);

  // Fetch financial bookkeeping data when dateRange changes
  const fetchBookkeepingData = useCallback(async () => {
    if (!selectedCompany || !dateRange) return;

    try {
      setBookkeepingLoading(true);
      const fromDate = dateRange.from.toISOString().split('T')[0];
      const toDate = dateRange.to.toISOString().split('T')[0];

      // Fetch invoices, transactions, and categories in parallel (same logic as useAnalytics)
      const [invoicesResult, transactionsResult, categoriesResult] = await Promise.all([
        // Fetch paid invoices with customer data
        supabase
          .from('invoices')
          .select('*, customers(*)')
          .eq('company_id', selectedCompany.id)
          .eq('status', 'bezahlt')
          .or(`and(paid_at.gte.${fromDate},paid_at.lte.${toDate}),and(paid_at.is.null,issue_date.gte.${fromDate},issue_date.lte.${toDate})`),

        // Fetch transactions
        supabase
          .from('transactions')
          .select('*')
          .eq('company_id', selectedCompany.id)
          .gte('date', fromDate)
          .lte('date', toDate)
          .order('date', { ascending: true }),

        // Fetch categories
        supabase
          .from('categories')
          .select('*')
          .eq('company_id', selectedCompany.id)
          .eq('is_active', true)
      ]);

      if (invoicesResult.error) throw invoicesResult.error;
      if (transactionsResult.error) throw transactionsResult.error;
      if (categoriesResult.error) throw categoriesResult.error;

      // Convert paid invoices to transaction format
      const invoiceTransactions: Transaction[] = (invoicesResult.data || [])
        .map((invoice: any) => {
          const transactionDate = invoice.paid_at || invoice.issue_date;
          return {
            id: `invoice-${invoice.id}`,
            company_id: selectedCompany.id,
            type: 'einnahme' as const,
            date: transactionDate,
            amount: invoice.total,
            description: `Rechnung ${invoice.invoice_number} - ${invoice.customers?.name || 'Unbekannt'}`,
            category: 'Umsatz',
            project_id: invoice.project_id,
            customer_id: invoice.customer_id,
            invoice_id: invoice.id,
            document_url: null,
            receipt_url: null,
            tags: null,
            billable: true,
            transaction_number: invoice.invoice_number,
            created_at: invoice.created_at,
          };
        })
        .filter((t) => t.date >= fromDate && t.date <= toDate);

      const regularTransactions = transactionsResult.data || [];
      const cats = categoriesResult.data || [];

      // Combine invoices and transactions
      const allTransactions = [...invoiceTransactions, ...regularTransactions];

      // Create a lookup map for categories by name
      const categoryByName = new Map<string, Category>();
      cats.forEach(cat => categoryByName.set(cat.name, cat));

      // Attach category details to ALL transactions (for CSV export)
      const transactionsWithCategories: TransactionWithCategory[] = allTransactions.map(t => ({
        ...t,
        category_details: t.category ? categoryByName.get(t.category) || null : null
      }));
      setRawTransactions(transactionsWithCategories);

      // Group by category and type
      const einnahmenMap = new Map<string, CategorySummary>();
      const ausgabenMap = new Map<string, CategorySummary>();

      allTransactions.forEach(t => {
        const categoryName = t.category || 'Ohne Kategorie';
        const categoryDetails = categoryByName.get(categoryName);
        const map = t.type === 'einnahme' ? einnahmenMap : ausgabenMap;

        if (!map.has(categoryName)) {
          map.set(categoryName, {
            categoryName,
            categoryColor: categoryDetails?.color || '#6B7280',
            isTaxRelevant: categoryDetails?.is_tax_relevant ?? true,
            total: 0,
            count: 0
          });
        }

        const summary = map.get(categoryName)!;
        summary.total += t.amount;
        summary.count += 1;
      });

      // Convert to arrays and sort by total
      const einnahmen = Array.from(einnahmenMap.values()).sort((a, b) => b.total - a.total);
      const ausgaben = Array.from(ausgabenMap.values()).sort((a, b) => b.total - a.total);

      const totalEinnahmen = einnahmen.reduce((sum, e) => sum + e.total, 0);
      const totalAusgaben = ausgaben.reduce((sum, a) => sum + a.total, 0);

      setBookkeepingData({
        einnahmen,
        ausgaben,
        totalEinnahmen,
        totalAusgaben,
        gewinnVerlust: totalEinnahmen - totalAusgaben
      });
    } catch (err) {
      console.error('Error fetching financial bookkeeping data:', err);
    } finally {
      setBookkeepingLoading(false);
    }
  }, [selectedCompany, dateRange]);

  useEffect(() => {
    if (viewMode === 'bookkeeping') {
      fetchBookkeepingData();
    }
  }, [viewMode, fetchBookkeepingData]);

  // CSV Export function
  const handleExportCSV = async () => {
    if (!rawTransactions.length) {
      toast.error('Keine Daten zum Exportieren vorhanden.');
      return;
    }

    // Generate signed URLs for receipts
    const transactionsWithUrls = await Promise.all(
      rawTransactions.map(async (t) => {
        let receiptUrl = '';
        if (t.receipt_url) {
          try {
            const { data } = await supabase.storage
              .from('receipts')
              .createSignedUrl(t.receipt_url, 86400); // 24h valid
            receiptUrl = data?.signedUrl || '';
          } catch {
            receiptUrl = '';
          }
        }
        return { ...t, signed_receipt_url: receiptUrl };
      })
    );

    // CSV headers
    const headers = [
      'Datum',
      'Kategorie',
      'Steuerrelevant',
      'Beschreibung',
      'Betrag',
      'Typ',
      'Beleg-URL'
    ];

    // CSV rows
    const rows = transactionsWithUrls.map(t => [
      new Date(t.date).toLocaleDateString('de-CH'),
      t.category || 'Ohne Kategorie',
      t.category_details?.is_tax_relevant ? 'Ja' : 'Nein',
      (t.description || '').replace(/"/g, '""'), // Escape quotes
      t.amount.toFixed(2),
      t.type === 'einnahme' ? 'Einnahme' : 'Ausgabe',
      t.signed_receipt_url || ''
    ]);

    // Build CSV content
    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
    ].join('\n');

    // Add BOM for Excel compatibility with special characters
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

    // Trigger download
    const fromStr = dateRange.from.toISOString().split('T')[0];
    const toStr = dateRange.to.toISOString().split('T')[0];
    const filename = `buchungen_${fromStr}_bis_${toStr}.csv`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    setCustomRange(null);
    setShowCustomPicker(false);
  };

  const handleCustomRange = () => {
    setShowCustomPicker(true);
    // Initialize custom range with last 30 days as sensible default
    // This prevents getPresetRange('custom') from being called with null customRange
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    today.setHours(23, 59, 59, 999);
    setCustomRange({ from: thirtyDaysAgo, to: today });
    setSelectedPreset('custom');
  };

  const applyCustomRange = (from: string, to: string) => {
    setCustomRange({
      from: new Date(from),
      to: new Date(to),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl text-content-secondary">Lädt...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-content-heading">Auswertungen</h1>

          {/* View Mode Toggle & Export */}
          <div className="flex items-center gap-3">
            <div className="flex bg-sage-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('bookkeeping')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'bookkeeping'
                    ? 'bg-white text-content-heading shadow-sm'
                    : 'text-content-secondary hover:text-content-heading'
                }`}
              >
                <FileText className="w-4 h-4" />
                Buchungen
              </button>
              <button
                onClick={() => setViewMode('charts')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'charts'
                    ? 'bg-white text-content-heading shadow-sm'
                    : 'text-content-secondary hover:text-content-heading'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Charts
              </button>
            </div>

            {viewMode === 'bookkeeping' && (
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg font-medium hover:bg-brand-dark transition-colors"
              >
                <Download className="w-4 h-4" />
                Export für Treuhänder (CSV)
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex gap-3 items-center flex-wrap">
            <button
              onClick={() => handlePresetChange('current_month')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedPreset === 'current_month'
                  ? 'bg-brand text-white'
                  : 'bg-sage-100 text-content-body hover:bg-sage-200'
              }`}
            >
              Aktueller Monat
            </button>
            <button
              onClick={() => handlePresetChange('last_month')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedPreset === 'last_month'
                  ? 'bg-brand text-white'
                  : 'bg-sage-100 text-content-body hover:bg-sage-200'
              }`}
            >
              Letzter Monat
            </button>
            <button
              onClick={() => handlePresetChange('current_year')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedPreset === 'current_year'
                  ? 'bg-brand text-white'
                  : 'bg-sage-100 text-content-body hover:bg-sage-200'
              }`}
            >
              Dieses Jahr
            </button>
            <button
              onClick={() => handlePresetChange('last_year')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedPreset === 'last_year'
                  ? 'bg-brand text-white'
                  : 'bg-sage-100 text-content-body hover:bg-sage-200'
              }`}
            >
              Letztes Jahr
            </button>
            <button
              onClick={() => handlePresetChange('last_30_days')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedPreset === 'last_30_days'
                  ? 'bg-brand text-white'
                  : 'bg-sage-100 text-content-body hover:bg-sage-200'
              }`}
            >
              Letzte 30 Tage
            </button>
            <button
              onClick={() => handlePresetChange('last_90_days')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedPreset === 'last_90_days'
                  ? 'bg-brand text-white'
                  : 'bg-sage-100 text-content-body hover:bg-sage-200'
              }`}
            >
              Letzte 90 Tage
            </button>
            <button
              onClick={handleCustomRange}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                selectedPreset === 'custom'
                  ? 'bg-brand text-white'
                  : 'bg-sage-100 text-content-body hover:bg-sage-200'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Benutzerdefiniert
            </button>
          </div>

          {/* Custom Date Picker */}
          {showCustomPicker && customRange && (
            <div className="mt-4 flex gap-4 items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-content-secondary">Von:</label>
                <input
                  type="date"
                  value={customRange.from.toISOString().split('T')[0]}
                  onChange={(e) => {
                    e.preventDefault();
                    if (e.target.value) {
                      applyCustomRange(e.target.value, customRange.to.toISOString().split('T')[0]);
                    }
                  }}
                  className="px-3 py-2 border border-surface-border rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-content-secondary">Bis:</label>
                <input
                  type="date"
                  value={customRange.to.toISOString().split('T')[0]}
                  onChange={(e) => {
                    e.preventDefault();
                    if (e.target.value) {
                      applyCustomRange(customRange.from.toISOString().split('T')[0], e.target.value);
                    }
                  }}
                  className="px-3 py-2 border border-surface-border rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Financial Bookkeeping View */}
      {viewMode === 'bookkeeping' && (
        <>
          {bookkeepingLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-xl text-content-secondary">Lädt Buchungen...</div>
            </div>
          ) : bookkeepingData ? (
            <div className="space-y-6">
              {/* Summary KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="text-sm font-medium text-content-secondary mb-2">Total Einnahmen</div>
                  <div className="text-3xl font-bold text-success-dark">{formatCHF(bookkeepingData.totalEinnahmen)}</div>
                  <div className="text-sm text-content-tertiary mt-1">{bookkeepingData.einnahmen.reduce((s, e) => s + e.count, 0)} Buchungen</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="text-sm font-medium text-content-secondary mb-2">Total Ausgaben</div>
                  <div className="text-3xl font-bold text-danger-dark">{formatCHF(bookkeepingData.totalAusgaben)}</div>
                  <div className="text-sm text-content-tertiary mt-1">{bookkeepingData.ausgaben.reduce((s, a) => s + a.count, 0)} Buchungen</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6 border-2 border-surface-border">
                  <div className="text-sm font-medium text-content-secondary mb-2">Gewinn / Verlust</div>
                  <div className={`text-3xl font-bold ${bookkeepingData.gewinnVerlust >= 0 ? 'text-success-dark' : 'text-danger-dark'}`}>
                    {formatCHF(bookkeepingData.gewinnVerlust)}
                  </div>
                </div>
              </div>

              {/* Two-Column Layout: Einnahmen / Ausgaben */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Einnahmen Section */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="bg-green-50 px-6 py-4 border-b border-green-100">
                    <h2 className="text-lg font-semibold text-green-800 flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full" />
                      Einnahmen
                    </h2>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {bookkeepingData.einnahmen.length === 0 ? (
                      <div className="px-6 py-8 text-center text-content-tertiary">
                        Keine Einnahmen im gewählten Zeitraum
                      </div>
                    ) : (
                      bookkeepingData.einnahmen.map((cat) => (
                        <div key={cat.categoryName} className="px-6 py-4 flex items-center justify-between hover:bg-sage-50">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: cat.categoryColor }}
                            />
                            <div>
                              <div className="font-medium text-content-heading flex items-center gap-2">
                                {cat.categoryName}
                                {cat.isTaxRelevant && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                    <AlertCircle className="w-3 h-3 mr-0.5" />
                                    Steuer
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-content-tertiary">{cat.count} Buchung{cat.count !== 1 ? 'en' : ''}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-success-dark">{formatCHF(cat.total)}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {bookkeepingData.einnahmen.length > 0 && (
                    <div className="bg-green-50 px-6 py-4 border-t border-green-100 flex justify-between items-center">
                      <span className="font-medium text-green-800">Total Einnahmen</span>
                      <span className="font-bold text-green-700 text-lg">{formatCHF(bookkeepingData.totalEinnahmen)}</span>
                    </div>
                  )}
                </div>

                {/* Ausgaben Section */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="bg-red-50 px-6 py-4 border-b border-red-100">
                    <h2 className="text-lg font-semibold text-red-800 flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full" />
                      Ausgaben
                    </h2>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {bookkeepingData.ausgaben.length === 0 ? (
                      <div className="px-6 py-8 text-center text-content-tertiary">
                        Keine Ausgaben im gewählten Zeitraum
                      </div>
                    ) : (
                      bookkeepingData.ausgaben.map((cat) => (
                        <div key={cat.categoryName} className="px-6 py-4 flex items-center justify-between hover:bg-sage-50">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: cat.categoryColor }}
                            />
                            <div>
                              <div className="font-medium text-content-heading flex items-center gap-2">
                                {cat.categoryName}
                                {cat.isTaxRelevant && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                    <AlertCircle className="w-3 h-3 mr-0.5" />
                                    Steuer
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-content-tertiary">{cat.count} Buchung{cat.count !== 1 ? 'en' : ''}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-danger-dark">{formatCHF(cat.total)}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {bookkeepingData.ausgaben.length > 0 && (
                    <div className="bg-red-50 px-6 py-4 border-t border-red-100 flex justify-between items-center">
                      <span className="font-medium text-red-800">Total Ausgaben</span>
                      <span className="font-bold text-red-700 text-lg">{formatCHF(bookkeepingData.totalAusgaben)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Result Banner */}
              <div className={`rounded-lg shadow p-6 ${bookkeepingData.gewinnVerlust >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={`text-lg font-semibold ${bookkeepingData.gewinnVerlust >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                      {bookkeepingData.gewinnVerlust >= 0 ? 'Gewinn' : 'Verlust'}
                    </h3>
                    <p className="text-sm text-content-secondary mt-1">
                      Einnahmen ({formatCHF(bookkeepingData.totalEinnahmen)}) - Ausgaben ({formatCHF(bookkeepingData.totalAusgaben)})
                    </p>
                  </div>
                  <div className={`text-4xl font-bold ${bookkeepingData.gewinnVerlust >= 0 ? 'text-success-dark' : 'text-danger-dark'}`}>
                    {formatCHF(Math.abs(bookkeepingData.gewinnVerlust))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-content-tertiary">Keine Daten verfügbar</div>
            </div>
          )}
        </>
      )}

      {/* Charts View */}
      {viewMode === 'charts' && (
        <>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Total Income */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-content-secondary mb-2">Gesamteinnahmen</div>
          <div className="text-3xl font-bold text-success-dark">{formatCHF(kpi.income)}</div>
        </div>

        {/* Total Expenses */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-content-secondary mb-2">Gesamtausgaben</div>
          <div className="text-3xl font-bold text-danger-dark">{formatCHF(kpi.expense)}</div>
        </div>

        {/* Net Profit */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-content-secondary mb-2">Nettogewinn</div>
          <div
            className={`text-3xl font-bold ${
              kpi.profit >= 0 ? 'text-success-dark' : 'text-danger-dark'
            }`}
          >
            {formatCHF(kpi.profit)}
          </div>
        </div>
      </div>

      {/* Main Timeline Chart */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-bold text-content-heading mb-6">Zeitverlauf</h2>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={timeline}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => formatCHF(value)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
              formatter={(value: number | undefined) => value !== undefined ? formatCHF(value) : ''}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="income"
              name="Einnahmen"
              stroke={COLORS.income}
              strokeWidth={2}
              dot={{ fill: COLORS.income }}
            />
            <Line
              type="monotone"
              dataKey="expense"
              name="Ausgaben"
              stroke={COLORS.expense}
              strokeWidth={2}
              dot={{ fill: COLORS.expense }}
            />
            <Line
              type="monotone"
              dataKey="monthlyProfit"
              name="Perioden-Gewinn"
              stroke={COLORS.profit}
              strokeWidth={2}
              dot={{ fill: COLORS.profit }}
            />
            <Line
              type="monotone"
              dataKey="cumulativeProfit"
              name="Kumulativer Gewinn"
              stroke={COLORS.primary}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: COLORS.primary }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Customer */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-content-heading mb-6">Pro Kunde</h2>
          {byCustomer.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byCustomer.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  type="number"
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => formatCHF(value)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number | undefined) => value !== undefined ? formatCHF(value) : ''}
                />
                <Bar dataKey="amount" fill={COLORS.primary}>
                  {byCustomer.slice(0, 10).map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.type === 'einnahme' ? COLORS.income : COLORS.expense}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-content-tertiary py-8">Keine Daten verfügbar</div>
          )}
        </div>

        {/* By Category */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-content-heading mb-6">Nach Konto (Kategorie)</h2>
          {byCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={byCategory.slice(0, 8)}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry: any) => `${entry.category}: ${formatCHF(entry.amount)}`}
                  labelLine={false}
                >
                  {byCategory.slice(0, 8).map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number | undefined) => value !== undefined ? formatCHF(value) : ''}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-content-tertiary py-8">Keine Daten verfügbar</div>
          )}
        </div>

        {/* By Tags */}
        <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <h2 className="text-xl font-bold text-content-heading mb-6">Nach Tags</h2>
          {byTags.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byTags.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  type="number"
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => formatCHF(value)}
                />
                <YAxis
                  type="category"
                  dataKey="tag"
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                  width={150}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number | undefined) => value !== undefined ? formatCHF(value) : ''}
                />
                <Bar dataKey="amount" fill={COLORS.primary} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-content-tertiary py-8">Keine Tags vorhanden</div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
}
