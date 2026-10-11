import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { CompanySettings, RevenueTarget } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';

/**
 * Einstellungen fuer Cockpit und Masken (Tabelle company_settings).
 * Fehlt die Zeile noch, gelten die Standardwerte der Datenbank; gespeichert
 * wird per upsert erst, wenn du etwas aenderst.
 */
export const DEFAULT_SETTINGS: Omit<CompanySettings, 'company_id' | 'updated_at'> = {
  weekly_hours_target: null,
  ahv_rate: 10,
  tax_rate: null,
  min_reserve: null,
  vat_threshold: 100000,
  concentration_warn: 50,
  concentration_alert: 70,
  default_hourly_rate: null,
  payment_terms_days: 30,
};

/** Bisheriger fester Wert im Code; gilt, solange kein Standardsatz gesetzt ist. */
export const FALLBACK_HOURLY_RATE = 160;

export const settingsKeys = {
  settings: (companyId: string) => ['company_settings', companyId] as const,
  targets: (companyId: string) => ['company_revenue_targets', companyId] as const,
};

export function useCompanySettings() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? '';
  return useQuery({
    queryKey: settingsKeys.settings(companyId),
    enabled: !!companyId,
    queryFn: async (): Promise<CompanySettings> => {
      const { data, error } = await supabase.from('company_settings').select('*').eq('company_id', companyId).maybeSingle();
      if (error) throw error;
      return { ...DEFAULT_SETTINGS, company_id: companyId, updated_at: '', ...(data ?? {}) } as CompanySettings;
    },
  });
}

export function useSaveCompanySettings() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? '';
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Omit<CompanySettings, 'company_id' | 'updated_at'>>) => {
      const { error } = await supabase.from('company_settings').upsert({ company_id: companyId, ...patch }, { onConflict: 'company_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.settings(companyId) }),
  });
}

export function useRevenueTargets() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? '';
  return useQuery({
    queryKey: settingsKeys.targets(companyId),
    enabled: !!companyId,
    queryFn: async (): Promise<RevenueTarget[]> => {
      const { data, error } = await supabase
        .from('company_revenue_targets')
        .select('company_id, year, revenue_target')
        .eq('company_id', companyId)
        .order('year', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, revenue_target: Number(r.revenue_target) }));
    },
  });
}

export function useSaveRevenueTarget() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? '';
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ year, revenue_target }: { year: number; revenue_target: number | null }) => {
      const query =
        revenue_target === null
          ? supabase.from('company_revenue_targets').delete().eq('company_id', companyId).eq('year', year)
          : supabase.from('company_revenue_targets').upsert({ company_id: companyId, year, revenue_target }, { onConflict: 'company_id,year' });
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.targets(companyId) }),
  });
}

/** Standardsatz fuer die Satz-Hierarchie (Projekt -> Kunde -> Standard). */
export function defaultRate(settings: CompanySettings | undefined): number {
  return settings?.default_hourly_rate ?? FALLBACK_HOURLY_RATE;
}
