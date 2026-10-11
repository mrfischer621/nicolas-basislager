import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Download, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import FinancialChart from '../components/FinancialChart';
import HBarChart from '../components/HBarChart';
import { Card, EmptyState, KPICard, PageHeader, SegmentedControl } from '../components/ui';
import { formatChfDisplay } from '../utils/money';
import { useAnalytics } from '../hooks/useAnalytics';
import { useCategories } from '../hooks/queries';
import { supabase } from '../lib/supabase';
import { presetRange, byCategory as groupByCategory, NO_CATEGORY, type DayRange, type RangePreset } from '../utils/financeAggregation';
import PaidWithoutDateNotice from '../components/PaidWithoutDateNotice';

// Type for financial bookkeeping data
interface CategorySummary {
  categoryName: string;
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

const formatCHF = (value: number) => formatChfDisplay(value);
const dmy = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;

const PRESETS = [
  { value: 'current_month', label: 'Aktueller Monat' },
  { value: 'last_month', label: 'Letzter Monat' },
  { value: 'current_year', label: 'Dieses Jahr' },
  { value: 'last_year', label: 'Letztes Jahr' },
  { value: 'last_30_days', label: '30 Tage' },
  { value: 'last_90_days', label: '90 Tage' },
  { value: 'custom', label: 'Eigener Zeitraum' },
];


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
  const categoryExpenses = byCategory.filter((c) => c.type === 'ausgabe').slice(0, 10);
  const customerIncome = byCustomer.filter((c) => c.type === 'einnahme').slice(0, 10);

  const bookkeepingData = useMemo<FinancialBookkeepingData>(() => {
    const categoryByName = new Map(categories.map((c) => [c.name, c]));
    const toSummary = (type: 'einnahme' | 'ausgabe') =>
      groupByCategory(entries)
        .filter((g) => g.type === type)
        .map((g) => {
          const details = categoryByName.get(g.key);
          return {
            categoryName: g.key,
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
        <div className="text-fg-muted">Auswertung wird geladen …</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auswertungen"
        description={`Zeitraum ${dmy(dateRange.from)} bis ${dmy(dateRange.to)}`}
        actions={
          <>
            <SegmentedControl
              label="Ansicht"
              options={[
                { value: 'bookkeeping' as ViewMode, label: 'Buchungen' },
                { value: 'charts' as ViewMode, label: 'Charts' },
              ]}
              value={viewMode}
              onChange={setViewMode}
            />
            <button type="button" onClick={handleExportCSV} className="btn-secondary">
              <Download className="h-4 w-4" aria-hidden="true" />
              CSV für Treuhänder
            </button>
          </>
        }
      />

      {/* Zeitraum */}
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Zeitraum" className="toggle-group">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={selectedPreset === p.value}
              onClick={() => (p.value === 'custom' ? handleCustomRange() : handlePresetChange(p.value))}
              className={`rounded-md px-3 py-1.5 font-display text-sm font-bold transition-colors ${
                selectedPreset === p.value ? 'toggle-on' : 'toggle-off'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {showCustomPicker && customRange && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-fg-muted">
              Von
              <input
                type="date"
                value={customRange.from}
                onChange={(e) => e.target.value && applyCustomRange(e.target.value, customRange.to)}
                className="input w-auto"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-fg-muted">
              Bis
              <input
                type="date"
                value={customRange.to}
                onChange={(e) => e.target.value && applyCustomRange(customRange.from, e.target.value)}
                className="input w-auto"
              />
            </label>
          </div>
        )}
      </div>

      <PaidWithoutDateNotice invoices={paidWithoutDate} />

      {/* Error Message */}
      {error && (
        <div role="alert" className="rounded-lg border border-danger bg-danger-subtle p-4 text-danger-on-subtle">
          <strong>Fehler:</strong> {error}
        </div>
      )}

      {/* Financial Bookkeeping View */}
      {viewMode === 'bookkeeping' && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KPICard
              label="Einnahmen"
              value={formatCHF(bookkeepingData.totalEinnahmen)}
              hint={`${bookkeepingData.einnahmen.reduce((s, e) => s + e.count, 0)} Buchungen`}
              tone="positive"
              icon={<TrendingUp size={18} />}
              loading={bookkeepingLoading}
            />
            <KPICard
              label="Ausgaben"
              value={formatCHF(bookkeepingData.totalAusgaben)}
              hint={`${bookkeepingData.ausgaben.reduce((s, a) => s + a.count, 0)} Buchungen`}
              tone="negative"
              icon={<TrendingDown size={18} />}
              loading={bookkeepingLoading}
            />
            <KPICard
              label="Ergebnis"
              value={formatCHF(bookkeepingData.gewinnVerlust)}
              hint={bookkeepingData.gewinnVerlust >= 0 ? 'Gewinn' : 'Verlust'}
              tone={bookkeepingData.gewinnVerlust >= 0 ? 'positive' : 'negative'}
              icon={bookkeepingData.gewinnVerlust >= 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
              loading={bookkeepingLoading}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {(
              [
                ['Einnahmen', bookkeepingData.einnahmen, bookkeepingData.totalEinnahmen],
                ['Ausgaben', bookkeepingData.ausgaben, bookkeepingData.totalAusgaben],
              ] as const
            ).map(([title, rows, total]) => (
              <Card key={title} padding="none" className="overflow-hidden">
                <h2 className="border-b border-line px-5 py-4 text-lg font-bold text-fg md:px-7">{title}</h2>
                {rows.length === 0 ? (
                  <EmptyState title={`Keine ${title} im Zeitraum`} />
                ) : (
                  <table className="table">
                    <thead className="sr-only">
                      <tr>
                        <th>Kategorie</th>
                        <th>Betrag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((cat) => (
                        <tr key={cat.categoryName}>
                          <td className="pl-5 md:pl-7">
                            <span className="font-medium">{cat.categoryName}</span>
                            <span className="ml-2 text-xs text-fg-muted">
                              {cat.count} {cat.count === 1 ? 'Buchung' : 'Buchungen'}
                              {!cat.isTaxRelevant && ' · nicht steuerrelevant'}
                            </span>
                          </td>
                          <td className="pr-5 text-right tabular-nums md:pr-7">{formatCHF(cat.total)}</td>
                        </tr>
                      ))}
                      <tr className="font-semibold">
                        <td className="pl-5 md:pl-7">Total {title}</td>
                        <td className="pr-5 text-right tabular-nums md:pr-7">{formatCHF(total)}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Charts View */}
      {viewMode === 'charts' && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KPICard label="Einnahmen" value={formatCHF(kpi.income)} hint="Im gewählten Zeitraum" tone="positive" icon={<TrendingUp size={18} />} />
            <KPICard label="Ausgaben" value={formatCHF(kpi.expense)} hint="Im gewählten Zeitraum" tone="negative" icon={<TrendingDown size={18} />} />
            <KPICard
              label="Ergebnis"
              value={formatCHF(kpi.profit)}
              hint={kpi.profit >= 0 ? 'Gewinn' : 'Verlust'}
              tone={kpi.profit >= 0 ? 'positive' : 'negative'}
              icon={kpi.profit >= 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
            />
          </div>

          <Card padding="md">
            <Card.Header title="Zeitverlauf" subtitle="Einnahmen und Ausgaben pro Periode" />
            {timeline.every((p) => p.income === 0 && p.expense === 0) ? (
              <EmptyState title="Keine Buchungen im Zeitraum" text="Wähle einen anderen Zeitraum." />
            ) : (
              <FinancialChart
                data={timeline.map((p) => ({ period: p.date, revenue: p.income, expenses: p.expense }))}
                height={360}
              />
            )}
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card padding="md">
              <Card.Header title="Ausgaben nach Kategorie" />
              {categoryExpenses.length > 0 ? (
                <HBarChart data={categoryExpenses} labelKey="category" color="negative" label="Ausgaben nach Kategorie in CHF" />
              ) : (
                <EmptyState title="Keine Ausgaben im Zeitraum" />
              )}
            </Card>
            <Card padding="md">
              <Card.Header title="Einnahmen nach Kunde" />
              {customerIncome.length > 0 ? (
                <HBarChart data={customerIncome} labelKey="name" color="positive" label="Einnahmen nach Kunde in CHF" />
              ) : (
                <EmptyState title="Keine Einnahmen mit Kunde im Zeitraum" />
              )}
            </Card>
            <Card padding="md" className="lg:col-span-2">
              <Card.Header title="Nach Tags" />
              {byTags.length > 0 ? (
                <HBarChart data={byTags.slice(0, 10)} labelKey="tag" label="Beträge nach Tags in CHF" />
              ) : (
                <EmptyState title="Keine Tags im Zeitraum" />
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
