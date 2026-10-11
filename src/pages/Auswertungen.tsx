import { useState, useMemo } from 'react';
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
import { useAnalytics } from '../hooks/useAnalytics';
import { useCategories } from '../hooks/queries';
import { supabase } from '../lib/supabase';
import { presetRange, byCategory as groupByCategory, NO_CATEGORY, type DayRange, type RangePreset } from '../utils/financeAggregation';
import PaidWithoutDateNotice from '../components/PaidWithoutDateNotice';

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
  // View mode toggle
  const [viewMode, setViewMode] = useState<ViewMode>('bookkeeping');

  // Default to last 90 days (Roadmap 1.2)
  const [selectedPreset, setSelectedPreset] = useState<string>('last_90_days');
  const [customRange, setCustomRange] = useState<DayRange | null>(null);
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  // Aktiver Zeitraum als Kalendertage (YYYY-MM-DD)
  const dateRange = useMemo<DayRange>(() => {
    return customRange || presetRange(selectedPreset as RangePreset);
  }, [customRange, selectedPreset]);

  // Beide Modi ("Buchungen" und "Charts") beruhen auf derselben Aggregation
  const { loading, error, kpi, timeline, byCustomer, byCategory, byTags, entries, paidWithoutDate } =
    useAnalytics(dateRange);
  const { data: categories = [] } = useCategories();

  const bookkeepingData = useMemo<FinancialBookkeepingData>(() => {
    const categoryByName = new Map(categories.map((c) => [c.name, c]));
    const toSummary = (type: 'einnahme' | 'ausgabe') =>
      groupByCategory(entries)
        .filter((g) => g.type === type)
        .map((g) => {
          const details = categoryByName.get(g.key);
          return {
            categoryName: g.key,
            categoryColor: details?.color || '#6B7280',
            isTaxRelevant: details?.is_tax_relevant ?? true,
            total: g.amount,
            count: g.count,
          };
        });
    return {
      einnahmen: toSummary('einnahme'),
      ausgaben: toSummary('ausgabe'),
      totalEinnahmen: kpi.income,
      totalAusgaben: kpi.expense,
      gewinnVerlust: kpi.profit,
    };
  }, [entries, categories, kpi]);
  const bookkeepingLoading = loading;

  // CSV Export function
  const handleExportCSV = async () => {
    if (!entries.length) {
      toast.error('Keine Daten zum Exportieren vorhanden.');
      return;
    }

    // Generate signed URLs for receipts
    const transactionsWithUrls = await Promise.all(
      entries.map(async (t) => {
        let receiptUrl = '';
        if (t.receiptUrl) {
          try {
            const { data } = await supabase.storage
              .from('receipts')
              .createSignedUrl(t.receiptUrl, 86400); // 24h valid
            receiptUrl = data?.signedUrl || '';
          } catch {
            receiptUrl = '';
          }
        }
        return { ...t, signed_receipt_url: receiptUrl };
      })
    );

    // CSV headers
    const categoryByName = new Map(categories.map((c) => [c.name, c]));
    const headers = [
      'Datum',
      'Beleg-Nr',
      'Kategorie',
      'Lieferant / Zahler',
      'Steuerrelevant',
      'Beschreibung',
      'Betrag',
      'Typ',
      'Beleg-URL'
    ];

    // CSV rows
    const rows = transactionsWithUrls.map(t => [
      `${t.date.slice(8, 10)}.${t.date.slice(5, 7)}.${t.date.slice(0, 4)}`,
      t.number || '',
      t.category || NO_CATEGORY,
      (t.counterparty || '').replace(/"/g, '""'),
      (t.category ? categoryByName.get(t.category)?.is_tax_relevant ?? true : true) ? 'Ja' : 'Nein',
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
    const filename = `buchungen_${dateRange.from}_bis_${dateRange.to}.csv`;
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
    setCustomRange(presetRange('last_30_days'));
    setSelectedPreset('custom');
  };

  const applyCustomRange = (from: string, to: string) => {
    setCustomRange({ from, to });
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
            <div className="flex bg-raised rounded-lg p-1">
              <button
                onClick={() => setViewMode('bookkeeping')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'bookkeeping'
                    ? 'bg-surface text-content-heading shadow-sm'
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
                    ? 'bg-surface text-content-heading shadow-sm'
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
                className="flex items-center gap-2 px-4 py-2 bg-brand text-accent-fg rounded-lg font-medium hover:bg-brand-dark transition-colors"
              >
                <Download className="w-4 h-4" />
                Export für Treuhänder (CSV)
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-surface rounded-lg shadow p-4">
          <div className="flex gap-3 items-center flex-wrap">
            <button
              onClick={() => handlePresetChange('current_month')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedPreset === 'current_month'
                  ? 'bg-brand text-accent-fg'
                  : 'bg-raised text-content-body hover:bg-sunken'
              }`}
            >
              Aktueller Monat
            </button>
            <button
              onClick={() => handlePresetChange('last_month')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedPreset === 'last_month'
                  ? 'bg-brand text-accent-fg'
                  : 'bg-raised text-content-body hover:bg-sunken'
              }`}
            >
              Letzter Monat
            </button>
            <button
              onClick={() => handlePresetChange('current_year')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedPreset === 'current_year'
                  ? 'bg-brand text-accent-fg'
                  : 'bg-raised text-content-body hover:bg-sunken'
              }`}
            >
              Dieses Jahr
            </button>
            <button
              onClick={() => handlePresetChange('last_year')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedPreset === 'last_year'
                  ? 'bg-brand text-accent-fg'
                  : 'bg-raised text-content-body hover:bg-sunken'
              }`}
            >
              Letztes Jahr
            </button>
            <button
              onClick={() => handlePresetChange('last_30_days')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedPreset === 'last_30_days'
                  ? 'bg-brand text-accent-fg'
                  : 'bg-raised text-content-body hover:bg-sunken'
              }`}
            >
              Letzte 30 Tage
            </button>
            <button
              onClick={() => handlePresetChange('last_90_days')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedPreset === 'last_90_days'
                  ? 'bg-brand text-accent-fg'
                  : 'bg-raised text-content-body hover:bg-sunken'
              }`}
            >
              Letzte 90 Tage
            </button>
            <button
              onClick={handleCustomRange}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                selectedPreset === 'custom'
                  ? 'bg-brand text-accent-fg'
                  : 'bg-raised text-content-body hover:bg-sunken'
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
                  value={customRange.from}
                  onChange={(e) => {
                    e.preventDefault();
                    if (e.target.value) {
                      applyCustomRange(e.target.value, customRange.to);
                    }
                  }}
                  className="px-3 py-2 border border-surface-border rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-content-secondary">Bis:</label>
                <input
                  type="date"
                  value={customRange.to}
                  onChange={(e) => {
                    e.preventDefault();
                    if (e.target.value) {
                      applyCustomRange(customRange.from, e.target.value);
                    }
                  }}
                  className="px-3 py-2 border border-surface-border rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <PaidWithoutDateNotice invoices={paidWithoutDate} />

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-danger-subtle border border-danger-subtle rounded-lg text-danger">
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
                <div className="bg-surface rounded-lg shadow p-6">
                  <div className="text-sm font-medium text-content-secondary mb-2">Total Einnahmen</div>
                  <div className="text-3xl font-bold text-success-dark">{formatCHF(bookkeepingData.totalEinnahmen)}</div>
                  <div className="text-sm text-content-tertiary mt-1">{bookkeepingData.einnahmen.reduce((s, e) => s + e.count, 0)} Buchungen</div>
                </div>
                <div className="bg-surface rounded-lg shadow p-6">
                  <div className="text-sm font-medium text-content-secondary mb-2">Total Ausgaben</div>
                  <div className="text-3xl font-bold text-danger-dark">{formatCHF(bookkeepingData.totalAusgaben)}</div>
                  <div className="text-sm text-content-tertiary mt-1">{bookkeepingData.ausgaben.reduce((s, a) => s + a.count, 0)} Buchungen</div>
                </div>
                <div className="bg-surface rounded-lg shadow p-6 border-2 border-surface-border">
                  <div className="text-sm font-medium text-content-secondary mb-2">Gewinn / Verlust</div>
                  <div className={`text-3xl font-bold ${bookkeepingData.gewinnVerlust >= 0 ? 'text-success-dark' : 'text-danger-dark'}`}>
                    {formatCHF(bookkeepingData.gewinnVerlust)}
                  </div>
                </div>
              </div>

              {/* Two-Column Layout: Einnahmen / Ausgaben */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Einnahmen Section */}
                <div className="bg-surface rounded-lg shadow overflow-hidden">
                  <div className="bg-success-subtle px-6 py-4 border-b border-success-subtle">
                    <h2 className="text-lg font-semibold text-success flex items-center gap-2">
                      <div className="w-3 h-3 bg-success rounded-full" />
                      Einnahmen
                    </h2>
                  </div>
                  <div className="divide-y divide-line">
                    {bookkeepingData.einnahmen.length === 0 ? (
                      <div className="px-6 py-8 text-center text-content-tertiary">
                        Keine Einnahmen im gewählten Zeitraum
                      </div>
                    ) : (
                      bookkeepingData.einnahmen.map((cat) => (
                        <div key={cat.categoryName} className="px-6 py-4 flex items-center justify-between hover:bg-canvas">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: cat.categoryColor }}
                            />
                            <div>
                              <div className="font-medium text-content-heading flex items-center gap-2">
                                {cat.categoryName}
                                {cat.isTaxRelevant && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-warning-subtle text-warning">
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
                    <div className="bg-success-subtle px-6 py-4 border-t border-success-subtle flex justify-between items-center">
                      <span className="font-medium text-success">Total Einnahmen</span>
                      <span className="font-bold text-success text-lg">{formatCHF(bookkeepingData.totalEinnahmen)}</span>
                    </div>
                  )}
                </div>

                {/* Ausgaben Section */}
                <div className="bg-surface rounded-lg shadow overflow-hidden">
                  <div className="bg-danger-subtle px-6 py-4 border-b border-danger-subtle">
                    <h2 className="text-lg font-semibold text-danger flex items-center gap-2">
                      <div className="w-3 h-3 bg-danger rounded-full" />
                      Ausgaben
                    </h2>
                  </div>
                  <div className="divide-y divide-line">
                    {bookkeepingData.ausgaben.length === 0 ? (
                      <div className="px-6 py-8 text-center text-content-tertiary">
                        Keine Ausgaben im gewählten Zeitraum
                      </div>
                    ) : (
                      bookkeepingData.ausgaben.map((cat) => (
                        <div key={cat.categoryName} className="px-6 py-4 flex items-center justify-between hover:bg-canvas">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: cat.categoryColor }}
                            />
                            <div>
                              <div className="font-medium text-content-heading flex items-center gap-2">
                                {cat.categoryName}
                                {cat.isTaxRelevant && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-warning-subtle text-warning">
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
                    <div className="bg-danger-subtle px-6 py-4 border-t border-danger-subtle flex justify-between items-center">
                      <span className="font-medium text-danger">Total Ausgaben</span>
                      <span className="font-bold text-danger text-lg">{formatCHF(bookkeepingData.totalAusgaben)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Result Banner */}
              <div className={`rounded-lg shadow p-6 ${bookkeepingData.gewinnVerlust >= 0 ? 'bg-success-subtle border border-success-subtle' : 'bg-danger-subtle border border-danger-subtle'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={`text-lg font-semibold ${bookkeepingData.gewinnVerlust >= 0 ? 'text-success' : 'text-danger'}`}>
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
        <div className="bg-surface rounded-lg shadow p-6">
          <div className="text-sm font-medium text-content-secondary mb-2">Gesamteinnahmen</div>
          <div className="text-3xl font-bold text-success-dark">{formatCHF(kpi.income)}</div>
        </div>

        {/* Total Expenses */}
        <div className="bg-surface rounded-lg shadow p-6">
          <div className="text-sm font-medium text-content-secondary mb-2">Gesamtausgaben</div>
          <div className="text-3xl font-bold text-danger-dark">{formatCHF(kpi.expense)}</div>
        </div>

        {/* Net Profit */}
        <div className="bg-surface rounded-lg shadow p-6">
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
      <div className="bg-surface rounded-lg shadow p-6 mb-8">
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
        <div className="bg-surface rounded-lg shadow p-6">
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
        <div className="bg-surface rounded-lg shadow p-6">
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
        <div className="bg-surface rounded-lg shadow p-6 lg:col-span-2">
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
