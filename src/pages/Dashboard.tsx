import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Invoice, Customer } from '../lib/supabase';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import FinancialChart from '../components/FinancialChart';
import { useCompany } from '../context/CompanyContext';
import { useAnalytics } from '../hooks/useAnalytics';
import { presetRange, yearRange, type DayRange, type Granularity } from '../utils/financeAggregation';
import { formatChfDisplay } from '../utils/money';
import PaidWithoutDateNotice from '../components/PaidWithoutDateNotice';
import { PageHeader, Card, KPICard, Badge, EmptyState, Skeleton, SkeletonRows, SegmentedControl } from '../components/ui';

type TimeFilter = 7 | 30 | 90;

const formatDay = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;
type ViewMode = 'days' | 'year';

interface InvoiceWithCustomer extends Invoice {
  customers?: Customer | null;
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
        title={<span className="bw-marker">Dashboard</span>}
        description={viewMode === 'year' ? `Finanzübersicht ${selectedYear}` : `Finanzübersicht der letzten ${timeFilter} Tage`}
        actions={
          <>
            <SegmentedControl
              label="Ansicht"
              options={[
                { value: 'days' as ViewMode, label: 'Tage' },
                { value: 'year' as ViewMode, label: 'Jahr' },
              ]}
              value={viewMode}
              onChange={setViewMode}
            />
            {viewMode === 'year' ? (
              <>
                <label htmlFor="dashboard-year" className="sr-only">
                  Jahr
                </label>
                <select
                  id="dashboard-year"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="input w-auto py-1.5"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <SegmentedControl
                label="Zeitraum"
                options={timeFilters}
                value={timeFilter}
                onChange={setTimeFilter}
              />
            )}
          </>
        }
      />

      <PaidWithoutDateNotice invoices={paidWithoutDate} />

      {/* KPI Cards - Bento Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KPICard
          label="Einnahmen"
          value={formatCurrency(revenue)}
          hint="Bezahlte Rechnungen und Einnahmen"
          icon={<TrendingUp size={18} />}
          loading={loading}
        />

        <KPICard
          label="Ausgaben"
          value={formatCurrency(expenses)}
          hint="Gebuchte Ausgaben"
          icon={<TrendingDown size={18} />}
          loading={loading}
        />

        <KPICard
          label="Ergebnis"
          value={formatCurrency(profit)}
          hint={profit >= 0 ? 'Gewinn im Zeitraum' : 'Verlust im Zeitraum'}
          icon={<Wallet size={18} />}
          loading={loading}
        />
      </div>

      {/* Financial Chart */}
      <Card padding="md">
        <Card.Header
          title="Einnahmen und Ausgaben"
          subtitle={viewMode === 'year' ? `Jahr ${selectedYear}` : `Letzte ${timeFilter} Tage`}
        />
        <Card.Content>
          {loading ? (
            <Skeleton className="h-[300px] w-full" label="Chart wird geladen" />
          ) : entries.length === 0 ? (
            <EmptyState
              title="Keine Buchungen im Zeitraum"
              text={`Zwischen ${formatDay(range.from)} und ${formatDay(range.to)} gibt es weder Einnahmen noch Ausgaben.`}
            />
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
            <SkeletonRows rows={3} />
          ) : openInvoices.length === 0 ? (
            <EmptyState title="Keine offenen Rechnungen" text="Alle versendeten Rechnungen sind bezahlt." />
          ) : (
            <div className="table-container -mx-5 md:-mx-7">
              <table className="table">
                <thead>
                  <tr>
                    <th className="pl-5 md:pl-7">Rechnung</th>
                    <th>Kunde</th>
                    <th className="text-right">Betrag</th>
                    <th className="pr-5 md:pr-7">Fällig</th>
                  </tr>
                </thead>
                <tbody>
                  {openInvoices.map((invoice) => {
                    const overdue = isOverdue(invoice.due_date);
                    return (
                      <tr key={invoice.id}>
                        <td className="pl-5 font-medium md:pl-7">{invoice.invoice_number}</td>
                        <td>{invoice.customers?.name || 'Unbekannt'}</td>
                        <td className="text-right tabular-nums">{formatCurrency(invoice.total)}</td>
                        <td className="pr-5 md:pr-7">
                          <span className="inline-flex flex-wrap items-center gap-2">
                            {invoice.due_date ? formatDay(invoice.due_date.slice(0, 10)) : '-'}
                            {overdue && <Badge tone="danger">Überfällig</Badge>}
                          </span>
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
