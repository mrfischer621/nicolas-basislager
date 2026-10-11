import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { defaultRate, useCompanySettings } from '../../hooks/useCompanySettings';

export type RateSource = 'project' | 'customer' | 'default' | 'manual';

export const RATE_SOURCE_LABEL: Record<RateSource, string> = {
  project: 'vom Projekt',
  customer: 'von der Firma',
  default: 'Standardsatz',
  manual: 'von Hand',
};

/**
 * Stundensatz nach der bestehenden Hierarchie (Projekt -> Firma -> Standard),
 * Standard aus den Einstellungen. Ohne Projekt gibt es keinen Satz, statt
 * einer irrefuehrenden Vorbelegung.
 */
export function useResolvedRate(projectId: string) {
  const { data: settings } = useCompanySettings();
  const fallback = defaultRate(settings);
  return useQuery({
    queryKey: ['resolved-rate', projectId, fallback],
    enabled: !!projectId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ rate: number; source: RateSource }> => {
      const { data, error } = await supabase.rpc('resolve_hourly_rate', { p_project_id: projectId, p_default_rate: fallback });
      if (error || !data?.length) return { rate: fallback, source: 'default' };
      return { rate: Number(data[0].rate), source: data[0].source as RateSource };
    },
  });
}
