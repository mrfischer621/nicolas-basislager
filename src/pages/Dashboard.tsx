import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Invoice, Customer } from '../lib/supabase';
import { AlertCircle, TrendingUp, TrendingDown, Wallet, Calendar } from 'lucide-react';
import FinancialChart from '../components/FinancialChart';
import { useCompany } from '../context/CompanyContext';
import { useAnalytics } from '../hooks/useAnalytics';
import { presetRange, yearRange, type DayRange, type Granularity } from '../utils/financeAggregation';
import { formatChfDisplay } from '../utils/money';
import PaidWithoutDateNotice from '../components/PaidWithoutDateNotice';
import { PageHeader, Card, KPICard, Button } from '../components/ui';

type TimeFilter = 7 | 30 | 90;

const formatDay = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;
type ViewMode = 'days' | 'year';

interface InvoiceWithCustomer extends Invoice {
  customer?: Customer;
}

interface ChartData {
  period: string;
  revenue: number;
  expenses: number;
}

export default function Dashboard() {
  const { selectedCompany } = useCompany();
  const [viewMode, setViewMode] = useState<ViewMode>('days');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(90);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Generate year options (last 3 years + current year)
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 2, currentYear - 1, currentYear];

  // Zeitraum und Aufloesung: 7/30 Tage pro Tag, 90 Tage pro Woche, Jahr pro Monat
  const range = useMemo<DayRange>(() => {
    if (viewMode === 'year') return yearRange(selectedYear);
    const preset = timeFilter === 7 ? 'last_7_days' : timeFilter === 30 ? 'last_30_days' : 'last_90_days';
    return presetRange(preset);
  }, [viewMode, selectedYear, timeFilter]);
  const granularity: Granularity = viewMode === 'year' ? 'month' : timeFilter === 90 ? 'week' : 'day';

  // Dieselbe Aggregation wie Auswertung, Buchungsliste und Jahresabschluss
  const { loading, kpi, timeline, entries, paidWithoutDate } = useAnalytics(range, granularity);
  const revenue = kpi.income;
  const expenses = kpi.expense;
  const chartData: ChartData[] = timeline.map((p) => ({
    period: p.date,
    revenue: p.income,
    expenses: p.expense,
  }));

  // Offene Rechnungen (status = 'versendet')
  const openInvoicesQuery = useQuery({
    queryKey: ['open-invoices', selectedCompany?.id ?? ''],
    enabled: !!selectedCompany,
    queryFn: async (): Promise<InvoiceWithCustomer[]> => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, customers(*)')
        .eq('company_id', selectedCompany!.id)
        .eq('status', 'versendet')
        .order('due_date', { ascending: true });
      if (error) throw error;
      return (data as InvoiceWithCustomer[]) ?? [];
    },
  });
  const openInvoices = openInvoicesQuery.data ?? [];
  const openLoading = openInvoicesQuery.isLoading;

  // Early return if no company selected
  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-text-secondary">Firma wird geladen...</p>
      </div>
    );
  }

  const formatCurrency = (amount: number): string => formatChfDisplay(amount);

  const isOverdue = (dueDate: string | null): boolean => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const profit = kpi.profit;

  // Time filter options
  const timeFilters: { value: TimeFilter; label: string }[] = [
    { value: 7, label: '7 Tage' },
    { value: 30, label: '30 Tage' },
    { value: 90, label: '90 Tage' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header with Time Filter */}
      <PageHeader
        title="Dashboard"
        description={viewMode === 'year' ? `Finanzübersicht ${selectedYear}` : `Finanzübersicht der letzten ${timeFilter} Tage`}
        actions={
          <div className="flex items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setViewMode('days')}
                className={`px-3 py-1.5 text-sm font-medium transition ${
                  viewMode === 'days'
                    ? 'bg-brand text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Tage
              </button>
              <button
                onClick={() => setViewMode('year')}
                className={`px-3 py-1.5 text-sm font-medium transition ${
                  viewMode === 'year'
                    ? 'bg-brand text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Jahr
              </button>
            </div>

            {/* Year Dropdown (only shown in year mode) */}
            {viewMode === 'year' && (
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-gray-500" />
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Time Filter (only shown in days mode) */}
            {viewMode === 'days' && (
              <div className="flex gap-2">
                {timeFilters.map((filter) => (
                  <Button
                    key={filter.value}
                    variant={timeFilter === filter.value ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setTimeFilter(filter.value)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        }
      />

      <PaidWithoutDateNotice invoices={paidWithoutDate} />

      {/* KPI Cards - Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          label="Einnahmen"
          value={loading ? '...' : formatCurrency(revenue)}
          trend="up"
          icon={<TrendingUp size={20} />}
          loading={loading}
        />

        <KPICard
          label="Ausgaben"
          value={loading ? '...' : formatCurrency(expenses)}
          trend="down"
          icon={<TrendingDown size={20} />}
          loading={loading}
        />

        <KPICard
          label="Profit"
          value={loading ? '...' : formatCurrency(profit)}
          trend={profit >= 0 ? 'up' : 'down'}
          icon={<Wallet size={20} />}
          loading={loading}
        />
      </div>

      {/* Financial Chart */}
      <Card padding="md" hover>
        <Card.Header
          title="Einnahmen vs. Ausgaben"
          subtitle={viewMode === 'year' ? `Jahr ${selectedYear}` : `Letzte ${timeFilter} Tage`}
        />
        <Card.Content>
          {loading ? (
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-text-secondary">Laden...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex h-[300px] flex-col items-center justify-center gap-1 text-center">
              <p className="font-medium text-text-primary">Keine Buchungen im Zeitraum</p>
              <p className="text-sm text-text-secondary">
                Zwischen {formatDay(range.from)} und {formatDay(range.to)} gibt es weder Einnahmen noch Ausgaben.
              </p>
            </div>
          ) : (
            <FinancialChart data={chartData} height={300} />
          )}
        </Card.Content>
      </Card>

      {/* Open Invoices Table */}
      <Card padding="md">
        <Card.Header
          title="Offene Rechnungen"
          subtitle={openInvoices.length > 0 ? `${openInvoices.length} ausstehend` : undefined}
        />
        <Card.Content>
          {openLoading ? (
            <p className="text-text-secondary">Laden...</p>
          ) : openInvoices.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-text-secondary">Keine offenen Rechnungen</p>
            </div>
          ) : (
            <div className="table-container -mx-6">
              <table className="table">
                <thead>
                  <tr>
                    <th className="pl-6">Rechnungsnummer</th>
                    <th>Kunde</th>
                    <th>Betrag</th>
                    <th className="pr-6">Fälligkeitsdatum</th>
                  </tr>
                </thead>
                <tbody>
                  {openInvoices.map((invoice) => {
                    const overdue = isOverdue(invoice.due_date);
                    return (
                      <tr
                        key={invoice.id}
                        className={overdue ? 'bg-danger-light/50' : ''}
                      >
                        <td className="pl-6">
                          <div className="flex items-center gap-2">
                            {overdue && (
                              <AlertCircle className="w-4 h-4 text-danger" />
                            )}
                            <span className={overdue ? 'font-semibold text-danger-dark' : ''}>
                              {invoice.invoice_number}
                            </span>
                          </div>
                        </td>
                        <td>
                          {invoice.customer?.name || 'Unbekannt'}
                        </td>
                        <td className="font-medium">
                          {formatCurrency(invoice.total)}
                        </td>
                        <td className={`pr-6 ${overdue ? 'font-semibold text-danger' : ''}`}>
                          {invoice.due_date
                            ? new Date(invoice.due_date).toLocaleDateString('de-CH')
                            : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
