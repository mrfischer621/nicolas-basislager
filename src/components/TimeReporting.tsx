import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { TimeEntry, Project, Customer } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';
import { Clock, FileText, TrendingUp, DollarSign, Filter } from 'lucide-react';
import { useThemeColors } from '../hooks/useThemeColors';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

interface TimeReportingProps {
  entries: TimeEntry[];
  projects: Project[];
}

export default function TimeReporting({ entries, projects }: TimeReportingProps) {
  const themeColors = useThemeColors();
  const { selectedCompany } = useCompany();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter state
  const [dateFrom, setDateFrom] = useState(() => {
    const date = startOfMonth(new Date());
    return format(date, 'yyyy-MM-dd');
  });
  const [dateTo, setDateTo] = useState(() => {
    const date = endOfMonth(new Date());
    return format(date, 'yyyy-MM-dd');
  });
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  // Fetch customers
  useEffect(() => {
    const fetchCustomers = async () => {
      if (!selectedCompany) return;

      try {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('company_id', selectedCompany.id)
          .order('name');

        if (error) throw error;
        setCustomers(data || []);
      } catch (err) {
        console.error('Error fetching customers:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomers();
  }, [selectedCompany]);

  // Filter entries based on selected filters
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      // Date filter
      if (dateFrom && entry.date < dateFrom) return false;
      if (dateTo && entry.date > dateTo) return false;

      // Project filter
      if (selectedProjectId && entry.project_id !== selectedProjectId) return false;

      // Customer filter (via project)
      if (selectedCustomerId) {
        const project = projects.find(p => p.id === entry.project_id);
        if (project?.customer_id !== selectedCustomerId) return false;
      }

      return true;
    });
  }, [entries, dateFrom, dateTo, selectedProjectId, selectedCustomerId, projects]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalEntries = filteredEntries.length;
    const totalHours = filteredEntries.reduce((sum, e) => sum + e.hours, 0);
    const billableHours = filteredEntries.filter(e => e.billable).reduce((sum, e) => sum + e.hours, 0);
    const nonBillableHours = totalHours - billableHours;
    const billablePercent = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;

    // Calculate total revenue from billable entries
    const totalRevenue = filteredEntries
      .filter(e => e.billable)
      .reduce((sum, e) => sum + (e.hours * e.rate), 0);

    // Effective hourly rate (revenue per billable hour)
    const effectiveRate = billableHours > 0 ? totalRevenue / billableHours : 0;

    // Average rate
    const avgRate = totalHours > 0
      ? filteredEntries.reduce((sum, e) => sum + (e.hours * e.rate), 0) / totalHours
      : 0;

    return {
      totalEntries,
      totalHours,
      billableHours,
      nonBillableHours,
      billablePercent,
      totalRevenue,
      effectiveRate,
      avgRate,
    };
  }, [filteredEntries]);

  // Chart data
  const chartData = [
    { category: 'Verrechenbar', hours: kpis.billableHours, color: themeColors.cta },
    { category: 'Nicht verrechenbar', hours: kpis.nonBillableHours, color: themeColors.fg },
  ];

  // Project breakdown
  const projectBreakdown = useMemo(() => {
    const breakdown: Record<string, { name: string; hours: number; revenue: number }> = {};

    filteredEntries.forEach(entry => {
      const project = projects.find(p => p.id === entry.project_id);
      const projectName = project?.name || 'Unbekannt';

      if (!breakdown[entry.project_id]) {
        breakdown[entry.project_id] = { name: projectName, hours: 0, revenue: 0 };
      }

      breakdown[entry.project_id].hours += entry.hours;
      if (entry.billable) {
        breakdown[entry.project_id].revenue += entry.hours * entry.rate;
      }
    });

    return Object.values(breakdown).sort((a, b) => b.hours - a.hours);
  }, [filteredEntries, projects]);

  // Quick date filters
  const setQuickDateRange = (days: number | 'month' | 'year') => {
    const today = new Date();
    if (days === 'month') {
      setDateFrom(format(startOfMonth(today), 'yyyy-MM-dd'));
      setDateTo(format(endOfMonth(today), 'yyyy-MM-dd'));
    } else if (days === 'year') {
      setDateFrom(format(new Date(today.getFullYear(), 0, 1), 'yyyy-MM-dd'));
      setDateTo(format(new Date(today.getFullYear(), 11, 31), 'yyyy-MM-dd'));
    } else {
      setDateFrom(format(subDays(today, days), 'yyyy-MM-dd'));
      setDateTo(format(today, 'yyyy-MM-dd'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-fg-muted">Lädt Reporting-Daten...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={18} className="text-fg-muted" />
          <h3 className="font-medium text-fg">Filter</h3>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          {/* Quick Date Buttons */}
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Schnellauswahl</label>
            <div className="flex gap-1">
              <button
                onClick={() => setQuickDateRange(7)}
                className="px-2 py-1 text-xs bg-raised hover:bg-sunken rounded transition"
              >
                7 Tage
              </button>
              <button
                onClick={() => setQuickDateRange(30)}
                className="px-2 py-1 text-xs bg-raised hover:bg-sunken rounded transition"
              >
                30 Tage
              </button>
              <button
                onClick={() => setQuickDateRange('month')}
                className="px-2 py-1 text-xs bg-raised hover:bg-sunken rounded transition"
              >
                Monat
              </button>
              <button
                onClick={() => setQuickDateRange('year')}
                className="px-2 py-1 text-xs bg-raised hover:bg-sunken rounded transition"
              >
                Jahr
              </button>
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Von</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1.5 border border-line rounded-lg text-sm focus:border-brand focus:ring-1 focus:ring-brand/20 "
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Bis</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1.5 border border-line rounded-lg text-sm focus:border-brand focus:ring-1 focus:ring-brand/20 "
            />
          </div>

          {/* Customer Filter */}
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Firma</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="px-3 py-1.5 border border-line rounded-lg text-sm focus:border-brand focus:ring-1 focus:ring-brand/20 min-w-[140px]"
            >
              <option value="">Alle Firmen</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
          </div>

          {/* Project Filter */}
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Projekt</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="px-3 py-1.5 border border-line rounded-lg text-sm focus:border-brand focus:ring-1 focus:ring-brand/20 min-w-[140px]"
            >
              <option value="">Alle Projekte</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>

          {/* Reset Button */}
          <button
            onClick={() => {
              setSelectedProjectId('');
              setSelectedCustomerId('');
              setQuickDateRange('month');
            }}
            className="px-3 py-1.5 text-sm text-fg-muted hover:text-fg hover:bg-raised rounded-lg transition"
          >
            Zurücksetzen
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-subtle rounded-lg">
              <FileText size={20} className="text-accent" />
            </div>
            <div>
              <p className="text-sm text-fg-muted">Leistungen</p>
              <p className="text-2xl font-bold text-fg">{kpis.totalEntries}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-subtle rounded-lg">
              <Clock size={20} className="text-accent" />
            </div>
            <div>
              <p className="text-sm text-fg-muted">Total Stunden</p>
              <p className="text-2xl font-bold text-fg">{kpis.totalHours.toFixed(1)}h</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${kpis.billablePercent >= 70 ? 'bg-success-subtle' : 'bg-warning-subtle'}`}>
              <TrendingUp size={20} className={kpis.billablePercent >= 70 ? 'text-success' : 'text-warning'} />
            </div>
            <div>
              <p className="text-sm text-fg-muted">Verrechenbar</p>
              <p className="text-2xl font-bold text-fg">{kpis.billablePercent.toFixed(0)}%</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-subtle rounded-lg">
              <DollarSign size={20} className="text-success" />
            </div>
            <div>
              <p className="text-sm text-fg-muted">Eff. Stundensatz</p>
              <p className="text-2xl font-bold text-fg">CHF {kpis.effectiveRate.toFixed(0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Summary */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-fg-muted">Gesamtumsatz (verrechenbare Stunden)</p>
            <p className="text-3xl font-bold text-brand">CHF {kpis.totalRevenue.toLocaleString('de-CH', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-fg-muted">Verrechenbare Stunden</p>
            <p className="text-xl font-semibold text-fg">{kpis.billableHours.toFixed(1)}h</p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart: Billable vs Non-Billable */}
        <div className="card p-4">
          <h3 className="font-medium text-fg mb-4">Stunden nach Verrechenbarkeit</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid horizontal={false} stroke={themeColors.line} />
                <XAxis type="number" tickFormatter={(v) => `${v}h`} tick={{ fill: themeColors['fg-muted'], fontSize: 12 }} />
                <YAxis type="category" dataKey="category" width={120} tick={{ fill: themeColors.fg, fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(1)} Stunden`, '']}
                  contentStyle={{ borderRadius: 'var(--bw-radius-lg)', border: `1px solid ${themeColors.line}`, background: themeColors.surface, color: themeColors.fg }}
                  cursor={{ fill: themeColors['accent-subtle'] }}
                />
                <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Project Breakdown */}
        <div className="card p-4">
          <h3 className="font-medium text-fg mb-4">Stunden nach Projekt</h3>
          {projectBreakdown.length === 0 ? (
            <p className="text-fg-muted text-center py-8">Keine Daten für den gewählten Zeitraum</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {projectBreakdown.map((project, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-fg truncate">{project.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div
                        className="h-2 bg-brand rounded-full"
                        style={{ width: `${(project.hours / kpis.totalHours) * 100}%`, minWidth: '4px' }}
                      />
                      <span className="text-xs text-fg-muted">
                        {((project.hours / kpis.totalHours) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm font-semibold text-fg">{project.hours.toFixed(1)}h</p>
                    <p className="text-xs text-fg-muted">CHF {project.revenue.toFixed(0)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
