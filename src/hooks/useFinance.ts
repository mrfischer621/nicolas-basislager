import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';
import {
  buildFinanceEntries,
  type FinanceInvoiceInput,
  type FinanceTransactionInput,
  type FinanceEntriesResult,
} from '../utils/financeAggregation';

/**
 * Einzige Datenquelle fuer Finanzzahlen: alle bezahlten Rechnungen und alle
 * Buchungen der aktiven Firma, zusammengefuehrt mit buildFinanceEntries.
 * Dashboard, Auswertung, Buchungsliste und Jahresabschluss filtern daraus nur
 * noch den Zeitraum - so koennen ihre Summen nicht auseinanderlaufen.
 *
 * Die Datenmengen sind klein (Einzelunternehmen), darum wird ohne
 * Datumsfilter geladen und im Browser gefiltert.
 */

export const financeQueryKey = (companyId: string) => ['finance', companyId] as const;

export function useFinanceEntries() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  return useQuery({
    queryKey: financeQueryKey(companyId ?? ''),
    enabled: !!companyId,
    queryFn: async (): Promise<FinanceEntriesResult> => {
      const [invoicesResult, transactionsResult] = await Promise.all([
        supabase
          .from('invoices')
          .select('id, invoice_number, status, total, issue_date, paid_at, customer_id, project_id, created_at, customers(name)')
          .eq('company_id', companyId!)
          .eq('status', 'bezahlt'),
        supabase.from('transactions').select('*').eq('company_id', companyId!),
      ]);
      if (invoicesResult.error) throw invoicesResult.error;
      if (transactionsResult.error) throw transactionsResult.error;

      return buildFinanceEntries(
        (invoicesResult.data ?? []) as unknown as FinanceInvoiceInput[],
        (transactionsResult.data ?? []) as FinanceTransactionInput[]
      );
    },
  });
}

/** Nach dem Anlegen, Aendern oder Loeschen von Buchungen/Rechnungen aufrufen. */
export function useInvalidateFinance() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['finance'] });
}

/** Abgeschlossene (gesperrte) Geschaeftsjahre der aktiven Firma. */
export function useLockedYears() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  return useQuery({
    queryKey: ['locked-years', companyId ?? ''],
    enabled: !!companyId,
    queryFn: async (): Promise<number[]> => {
      const { data, error } = await supabase
        .from('year_end_closings')
        .select('year')
        .eq('company_id', companyId!)
        .eq('status', 'locked');
      if (error) throw error;
      return (data ?? []).map((r) => r.year as number);
    },
  });
}
