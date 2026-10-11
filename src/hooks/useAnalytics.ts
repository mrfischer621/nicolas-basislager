import { useMemo } from 'react';
import { useFinanceEntries } from './useFinance';
import { useCustomers } from './queries';
import {
  buildTimeline,
  byCategory as groupByCategory,
  byTag,
  defaultGranularity,
  filterRange,
  groupBy,
  summarize,
  type DayRange,
  type FinanceEntry,
  type Granularity,
  type FinanceInvoiceInput,
} from '../utils/financeAggregation';

export type { DayRange } from '../utils/financeAggregation';

export interface KPI {
  income: number;
  expense: number;
  profit: number;
}

export interface TimelineData {
  key: string;
  date: string; // Beschriftung der Periode
  income: number;
  expense: number;
  monthlyProfit: number;
  cumulativeProfit: number;
}

export interface CustomerBreakdown {
  name: string;
  amount: number;
  type: 'einnahme' | 'ausgabe';
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  type: 'einnahme' | 'ausgabe';
}

export interface TagBreakdown {
  tag: string;
  amount: number;
}

export interface AnalyticsResult {
  loading: boolean;
  error: string | null;
  kpi: KPI;
  timeline: TimelineData[];
  byCustomer: CustomerBreakdown[];
  byCategory: CategoryBreakdown[];
  byTags: TagBreakdown[];
  /** Eintraege im Zeitraum (Rechnungen und Buchungen) */
  entries: FinanceEntry[];
  /** Bezahlte Rechnungen ohne Zahlungsdatum (werden nicht gezaehlt) */
  paidWithoutDate: FinanceInvoiceInput[];
}

/**
 * Kennzahlen fuer einen Zeitraum. Duenne Schicht ueber der zentralen
 * Aggregation (utils/financeAggregation.ts); rechnet selbst nichts eigenes.
 */
export function useAnalytics(range: DayRange, granularity?: Granularity): AnalyticsResult {
  const finance = useFinanceEntries();
  const customers = useCustomers();

  return useMemo(() => {
    const all = finance.data?.entries ?? [];
    const entries = filterRange(all, range);
    const totals = summarize(entries);
    const names = new Map((customers.data ?? []).map((c) => [c.id, c.name]));

    return {
      loading: finance.isLoading,
      error: finance.error ? 'Fehler beim Laden der Finanzdaten' : null,
      kpi: { income: totals.income, expense: totals.expense, profit: totals.profit },
      timeline: buildTimeline(entries, range, granularity ?? defaultGranularity(range)).map((p) => ({
        key: p.key,
        date: p.label,
        income: p.income,
        expense: p.expense,
        monthlyProfit: p.profit,
        cumulativeProfit: p.cumulativeProfit,
      })),
      byCustomer: groupBy(entries, (e) => (e.customerId ? names.get(e.customerId) ?? 'Unbekannt' : null)).map(
        (g) => ({ name: g.key, amount: g.amount, type: g.type })
      ),
      byCategory: groupByCategory(entries).map((g) => ({ category: g.key, amount: g.amount, type: g.type })),
      byTags: byTag(entries).map((g) => ({ tag: g.key, amount: g.amount })),
      entries,
      paidWithoutDate: finance.data?.paidWithoutDate ?? [],
    };
  }, [finance.data, finance.isLoading, finance.error, customers.data, range, granularity]);
}
