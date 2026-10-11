import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { YearEndClosing, YearEndClosingData, YearEndClosingLog } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';
import { useFinanceEntries } from './useFinance';
import { useCategories } from './queries';
import { filterRange, yearRange, type FinanceInvoiceInput } from '../utils/financeAggregation';
import { buildYearEndReport, type YearEndReport } from '../utils/yearEndReport';

/**
 * Jahresabschluss eines Jahres fuer die aktive Firma.
 *
 * Einnahmen/Ausgaben kommen aus der zentralen Aggregation (useFinance), nicht
 * mehr aus der leeren Tabelle `expenses` (dort fehlten die Ausgaben ganz).
 * Sperren und Entsperren setzen Hash und Protokoll in der Datenbank
 * (Migration 20261011120400); Entsperren nur mit Grund.
 */
export function useYearEnd(year: number) {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? '';
  const queryClient = useQueryClient();

  const finance = useFinanceEntries();
  const categories = useCategories();

  const invoices = useQuery({
    queryKey: ['invoices-all', companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<FinanceInvoiceInput[]> => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, status, total, issue_date, paid_at, customer_id, project_id, customers(name)')
        .eq('company_id', companyId);
      if (error) throw error;
      return (data ?? []) as unknown as FinanceInvoiceInput[];
    },
  });

  const closing = useQuery({
    queryKey: ['year-end', companyId, year],
    enabled: !!companyId,
    queryFn: async (): Promise<YearEndClosing | null> => {
      const { data, error } = await supabase
        .from('year_end_closings')
        .select('*')
        .eq('company_id', companyId)
        .eq('year', year)
        .maybeSingle();
      if (error) throw error;
      return data as YearEndClosing | null;
    },
  });

  const log = useQuery({
    queryKey: ['year-end-log', companyId, year],
    enabled: !!companyId,
    queryFn: async (): Promise<YearEndClosingLog[]> => {
      const { data, error } = await supabase
        .from('year_end_closing_log')
        .select('*')
        .eq('company_id', companyId)
        .eq('year', year)
        .order('created_at', { ascending: false });
      // Vor der Migration gibt es die Tabelle noch nicht: Protokoll leer anzeigen
      if (error) return [];
      return (data ?? []) as YearEndClosingLog[];
    },
  });

  /** Bericht fuer beliebige (auch ungespeicherte) Abschlussdaten berechnen. */
  const buildReport = (data: YearEndClosingData | null | undefined): YearEndReport =>
    buildYearEndReport({
      year,
      entries: filterRange(finance.data?.entries ?? [], yearRange(year)),
      categories: categories.data ?? [],
      invoices: invoices.data ?? [],
      paidWithoutDate: finance.data?.paidWithoutDate ?? [],
      data,
    });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['year-end', companyId, year] }),
      queryClient.invalidateQueries({ queryKey: ['year-end-log', companyId, year] }),
    ]);
  };

  const saveClosing = async (data: YearEndClosingData) => {
    if (!companyId) throw new Error('Keine Firma ausgewählt');
    const finalProfit = buildReport(data).taxableResult;
    const current = closing.data;
    const { error } = current
      ? await supabase.from('year_end_closings').update({ data, final_profit: finalProfit }).eq('id', current.id)
      : await supabase
          .from('year_end_closings')
          .insert({ company_id: companyId, year, status: 'draft', data, final_profit: finalProfit });
    if (error) throw error;
    await refresh();
  };

  /** Sperren: Hash und Protokolleintrag setzt der Datenbank-Trigger. */
  const lockClosing = async (data: YearEndClosingData) => {
    await saveClosing(data);
    const { data: fresh, error: readError } = await supabase
      .from('year_end_closings')
      .select('id')
      .eq('company_id', companyId)
      .eq('year', year)
      .single();
    if (readError) throw readError;
    const { error } = await supabase
      .from('year_end_closings')
      .update({ status: 'locked', locked_at: new Date().toISOString() })
      .eq('id', fresh.id);
    if (error) throw error;
    await refresh();
  };

  /** Entsperren nur mit Grund; protokolliert mit Hash vor dem Entsperren. */
  const unlockClosing = async (reason: string) => {
    if (!closing.data) throw new Error('Kein Jahresabschluss vorhanden');
    const { error } = await supabase.rpc('unlock_year_end_closing', {
      p_closing_id: closing.data.id,
      p_reason: reason,
    });
    if (error) throw error;
    await refresh();
  };

  const loading =
    finance.isLoading || categories.isLoading || invoices.isLoading || closing.isLoading;
  const error =
    finance.error || categories.error || invoices.error || closing.error
      ? 'Fehler beim Laden der Jahresabschluss-Daten'
      : null;

  return {
    loading,
    error,
    closing: closing.data ?? null,
    log: log.data ?? [],
    entriesOfYear: filterRange(finance.data?.entries ?? [], yearRange(year)),
    buildReport,
    saveClosing,
    lockClosing,
    unlockClosing,
  };
}
