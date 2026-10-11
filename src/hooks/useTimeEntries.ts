import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Project, TimeEntryWithStatus } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';
import { useProjects } from './queries';
import { ilikePattern, pageRange, parseSort, type ListState } from '../components/list';
import { viewRange, type TimeRow, type TimeView } from '../utils/timeEntries';
import { zurichDay } from '../utils/financeAggregation';

type ProjectWithCustomer = Project & { customers?: { name?: string } | null };

/** Firma und Projektname aus der Projektliste ergaenzen. */
export function enrich(entries: TimeEntryWithStatus[], projects: ProjectWithCustomer[]): TimeRow[] {
  const byId = new Map(projects.map((p) => [p.id, p]));
  return entries.map((e) => {
    const p = byId.get(e.project_id);
    return { ...e, projectName: p?.name ?? 'Unbekanntes Projekt', customerId: p?.customer_id ?? null, customerName: p?.customers?.name ?? 'Unbekannte Firma' };
  });
}

/** Projekt-IDs einer Firma (fuer den Firmenfilter in der Datenbank). */
export function projectIdsOf(customerId: string, projects: Project[]): string[] {
  return projects.filter((p) => p.customer_id === customerId).map((p) => p.id);
}

const SUMMARY_COLUMNS = 'id, project_id, date, hours, rate, billable, invoice_id, manual_status, description, invoice_status, invoice_number';

/** Schlanke Abfrage aller Zeiten fuer Tab-Zahlen, Summen und Cockpit. */
export function useTimeSummary() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? '';
  const { data: projects = [] } = useProjects();
  const query = useQuery({
    queryKey: ['time-entries', companyId, 'summary'],
    enabled: !!companyId,
    queryFn: async (): Promise<TimeEntryWithStatus[]> => {
      const { data, error } = await supabase.from('view_time_entries_with_status').select(SUMMARY_COLUMNS).eq('company_id', companyId);
      if (error) throw error;
      return (data ?? []) as TimeEntryWithStatus[];
    },
  });
  return { ...query, rows: enrich(query.data ?? [], projects as ProjectWithCustomer[]) };
}

/** Liste nach URL-Zustand, gefiltert und seitenweise aus der Datenbank. */
export function useTimeList(state: ListState) {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? '';
  const { data: projects = [], isSuccess: projectsReady } = useProjects();
  const query = useQuery({
    queryKey: ['time-entries', companyId, 'list', state, projects.length],
    enabled: !!companyId && projectsReady,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<{ rows: TimeEntryWithStatus[]; total: number }> => {
      const today = zurichDay(new Date());
      const view = (state.ansicht ?? 'offen') as TimeView;
      const sort = parseSort(state.sort, '-date');
      const [from, to] = pageRange(Number(state.seite ?? 1));
      let q = supabase.from('view_time_entries_with_status').select('*', { count: 'exact' }).eq('company_id', companyId);
      if (view === 'offen') q = q.eq('billable', true).is('invoice_id', null).or('manual_status.is.null,manual_status.eq.offen');
      if (view === 'verrechnet') q = q.or('invoice_id.not.is.null,manual_status.in.(verrechnet,bezahlt)');
      const range = viewRange(view, today);
      if (range.from) q = q.gte('date', range.from).lte('date', today);
      if (state.projekt) q = q.eq('project_id', state.projekt);
      else if (state.firma) {
        const ids = projectIdsOf(state.firma, projects);
        q = q.in('project_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
      }
      if (state.rechnung) q = q.eq('invoice_id', state.rechnung);
      if (state.von) q = q.gte('date', state.von);
      if (state.bis) q = q.lte('date', state.bis);
      if (state.q?.trim()) q = q.ilike('description', ilikePattern(state.q));
      q = q.order(sort.column, { ascending: sort.ascending }).order('created_at', { ascending: false }).range(from, to);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as TimeEntryWithStatus[], total: count ?? 0 };
    },
  });
  return { ...query, rows: enrich(query.data?.rows ?? [], projects as ProjectWithCustomer[]), total: query.data?.total ?? 0 };
}

export function useInvalidateTime() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: ['time-entries'] }), qc.invalidateQueries({ queryKey: ['invoices'] })]);
}
