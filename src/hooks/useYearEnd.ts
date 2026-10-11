import { useState, useEffect } from 'react';
import { useFinanceEntries } from './useFinance';
import { filterRange, summarize, yearRange } from '../utils/financeAggregation';
import { supabase } from '../lib/supabase';
import type { YearEndClosing, YearEndClosingData } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';

export interface YearEndCalculation {
  // Base financials (from paid invoices and expenses)
  rawIncome: number;
  rawExpense: number;
  rawProfit: number;

  // Adjustments
  totalDepreciations: number;
  totalPrivateShares: number;
  socialSecurityProvision: number;

  // Final taxable income
  taxableProfit: number;
}

export interface UseYearEndReturn {
  loading: boolean;
  error: string | null;
  closing: YearEndClosing | null;
  calculation: YearEndCalculation;
  saveClosing: (data: YearEndClosingData) => Promise<void>;
  lockClosing: () => Promise<void>;
  unlockClosing: () => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Custom hook for Year-End Closing (Jahresabschluss) management
 * Handles fetching, calculating, and saving tax adjustments for a specific year
 *
 * @param year - The fiscal year (e.g., 2025)
 * @returns Year-End closing data, calculations, and CRUD functions
 */
export function useYearEnd(year: number): UseYearEndReturn {
  const { selectedCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState<YearEndClosing | null>(null);
  const [calculation, setCalculation] = useState<YearEndCalculation>({
    rawIncome: 0,
    rawExpense: 0,
    rawProfit: 0,
    totalDepreciations: 0,
    totalPrivateShares: 0,
    socialSecurityProvision: 0,
    taxableProfit: 0,
  });

  // Einnahmen/Ausgaben aus der zentralen Aggregation (nicht mehr aus der
  // leeren Tabelle `expenses`, die Ausgaben fehlten deshalb ganz)
  const finance = useFinanceEntries();

  useEffect(() => {
    if (selectedCompany && year && finance.data) {
      fetchAndCalculate();
    }
  }, [selectedCompany, year, finance.data]);

  /**
   * Fetches financial data for the year and existing closing record
   */
  const fetchAndCalculate = async () => {
    if (!selectedCompany) return;

    try {
      setLoading(true);
      setError(null);

      const closingResult = await supabase
        .from('year_end_closings')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .eq('year', year)
        .maybeSingle();

      if (closingResult.error) throw closingResult.error;

      const totals = summarize(filterRange(finance.data?.entries ?? [], yearRange(year)));
      const rawIncome = totals.income;
      const rawExpense = totals.expense;
      const rawProfit = totals.profit;

      // Extract adjustment data from closing record
      const closingData = closingResult.data;
      const adjustmentData: YearEndClosingData = closingData?.data || {
        assets: [],
        private_shares: [],
        social_security_provision: 0,
      };

      // Calculate adjustment totals
      const totalDepreciations = adjustmentData.assets.reduce(
        (sum, asset) => sum + (asset.amount || 0),
        0
      );
      const totalPrivateShares = adjustmentData.private_shares.reduce(
        (sum, share) => sum + (share.amount || 0),
        0
      );
      const socialSecurityProvision = adjustmentData.social_security_provision || 0;

      // Calculate taxable profit
      // Formula: Raw Profit - Depreciations + Private Shares - Provisions
      const taxableProfit =
        rawProfit - totalDepreciations + totalPrivateShares - socialSecurityProvision;

      setClosing(closingData);
      setCalculation({
        rawIncome,
        rawExpense,
        rawProfit,
        totalDepreciations,
        totalPrivateShares,
        socialSecurityProvision,
        taxableProfit,
      });
    } catch (err) {
      console.error('Error in useYearEnd:', err);
      setError('Fehler beim Laden der Jahresabschluss-Daten');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Saves or updates the year-end closing record
   */
  const saveClosing = async (data: YearEndClosingData) => {
    if (!selectedCompany) {
      setError('Keine Firma ausgewählt');
      return;
    }

    try {
      setError(null);

      // Recalculate final_profit before saving
      const totalDepreciations = data.assets.reduce(
        (sum, asset) => sum + (asset.amount || 0),
        0
      );
      const totalPrivateShares = data.private_shares.reduce(
        (sum, share) => sum + (share.amount || 0),
        0
      );
      const socialSecurityProvision = data.social_security_provision || 0;
      const finalProfit =
        calculation.rawProfit -
        totalDepreciations +
        totalPrivateShares -
        socialSecurityProvision;

      if (closing) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('year_end_closings')
          .update({
            data,
            final_profit: finalProfit,
          })
          .eq('id', closing.id);

        if (updateError) throw updateError;
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('year_end_closings')
          .insert({
            company_id: selectedCompany.id,
            year,
            status: 'draft',
            data,
            final_profit: finalProfit,
          });

        if (insertError) throw insertError;
      }

      // Refetch to get updated data
      await fetchAndCalculate();
    } catch (err) {
      console.error('Error saving year-end closing:', err);
      setError('Fehler beim Speichern des Jahresabschlusses');
      throw err;
    }
  };

  /**
   * Locks the year-end closing (makes it immutable)
   */
  const lockClosing = async () => {
    if (!closing) {
      setError('Kein Jahresabschluss vorhanden');
      return;
    }

    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('year_end_closings')
        .update({
          status: 'locked',
          locked_at: new Date().toISOString(),
        })
        .eq('id', closing.id);

      if (updateError) throw updateError;

      await fetchAndCalculate();
    } catch (err) {
      console.error('Error locking year-end closing:', err);
      setError('Fehler beim Sperren des Jahresabschlusses');
      throw err;
    }
  };

  /**
   * Unlocks the year-end closing (makes it editable again)
   */
  const unlockClosing = async () => {
    if (!closing) {
      setError('Kein Jahresabschluss vorhanden');
      return;
    }

    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('year_end_closings')
        .update({
          status: 'draft',
          locked_at: null,
        })
        .eq('id', closing.id);

      if (updateError) throw updateError;

      await fetchAndCalculate();
    } catch (err) {
      console.error('Error unlocking year-end closing:', err);
      setError('Fehler beim Entsperren des Jahresabschlusses');
      throw err;
    }
  };

  return {
    loading: loading || finance.isLoading,
    error,
    closing,
    calculation,
    saveClosing,
    lockClosing,
    unlockClosing,
    refetch: fetchAndCalculate,
  };
}
