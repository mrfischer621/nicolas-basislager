import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { LeadStatus, Opportunity, PipelineStage } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';
import { useCustomers } from './queries';
import type { Customer } from '../lib/supabase';
import { orSearch, pageRange, parseSort, type ListState } from '../components/list';
import { firstDealStage, opportunityCompany, opportunityPerson, type OpportunityRow } from '../utils/pipeline';

export const pipelineKeys = {
  all: ['pipeline'] as const,
  stages: (companyId: string) => ['pipeline', companyId, 'stages'] as const,
  deals: (companyId: string) => ['pipeline', companyId, 'deals'] as const,
  leadCounts: (companyId: string) => ['pipeline', companyId, 'lead-counts'] as const,
  leads: (companyId: string, state: ListState) => ['pipeline', companyId, 'leads', state] as const,
};

export function usePipelineStages() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? '';
  return useQuery({
    queryKey: pipelineKeys.stages(companyId),
    enabled: !!companyId,
    queryFn: async (): Promise<PipelineStage[]> => {
      const { data, error } = await supabase.from('pipeline_stages').select('*').eq('company_id', companyId).order('position');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * opportunities hat keinen Fremdschluessel auf customers; ein eingebetteter
 * Join (customers(name)) schlaegt in PostgREST fehl. Der Firmenname kommt
 * deshalb aus der Firmenliste.
 */
function withCustomerNames(rows: Opportunity[], customers: Customer[]): OpportunityRow[] {
  const names = new Map(customers.map((c) => [c.id, c.name]));
  return rows.map((o) => ({ ...o, customers: o.existing_customer_id && names.has(o.existing_customer_id) ? { name: names.get(o.existing_customer_id)! } : null }));
}

/** Alle Deals (ohne Leads) fuer Board, Tabelle und Cockpit. */
export function useDeals() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? '';
  const { data: customers = [] } = useCustomers();
  const query = useQuery({
    queryKey: pipelineKeys.deals(companyId),
    enabled: !!companyId,
    queryFn: async (): Promise<Opportunity[]> => {
      const { data, error } = await supabase
        .from('opportunities')
        .select('*')
        .eq('company_id', companyId)
        .eq('kind', 'deal')
        .order('next_action_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return { ...query, data: query.data ? withCustomerNames(query.data, customers) : undefined };
}

/** Status aller Leads (schlank) fuer Tab-Zahlen, Navigation und Cockpit. */
export function useLeadStatuses() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? '';
  return useQuery({
    queryKey: pipelineKeys.leadCounts(companyId),
    enabled: !!companyId,
    queryFn: async (): Promise<Pick<Opportunity, 'id' | 'lead_status' | 'created_at' | 'next_action_date'>[]> => {
      const { data, error } = await supabase.from('opportunities').select('id, lead_status, created_at, next_action_date').eq('company_id', companyId).eq('kind', 'lead');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Leads nach URL-Zustand, gefiltert und seitenweise aus der Datenbank. */
export function useLeadList(state: ListState) {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? '';
  const { data: customers = [] } = useCustomers();
  const query = useQuery({
    queryKey: pipelineKeys.leads(companyId, state),
    enabled: !!companyId,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<{ rows: Opportunity[]; total: number }> => {
      const view = state.ansicht ?? 'neu';
      const sort = parseSort(state.sort, 'next_action_date');
      const [from, to] = pageRange(Number(state.seite ?? 1));
      let q = supabase.from('opportunities').select('*', { count: 'exact' }).eq('company_id', companyId).eq('kind', 'lead');
      if (view === 'neu') q = q.or('lead_status.is.null,lead_status.eq.neu');
      else if (view !== 'alle') q = q.eq('lead_status', view);
      if (state.quelle) q = q.eq('source', state.quelle);
      if (state.q?.trim()) q = q.or(orSearch(['title', 'prospect_info->>company', 'prospect_info->>name', 'prospect_info->>contact_person', 'notes'], state.q));
      q = q.order(sort.column, { ascending: sort.ascending, nullsFirst: false }).order('created_at', { ascending: false }).range(from, to);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data ?? [], total: count ?? 0 };
    },
  });
  return { ...query, data: query.data ? { rows: withCustomerNames(query.data.rows, customers), total: query.data.total } : undefined };
}

export function useInvalidatePipeline() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: pipelineKeys.all });
}

// ---------------------------------------------------------------------------
// Schreibende Aktionen
// ---------------------------------------------------------------------------

export async function updateOpportunities(ids: string[], patch: Partial<Opportunity>): Promise<void> {
  const { error } = await supabase.from('opportunities').update(patch).in('id', ids);
  if (error) throw error;
}

export function setLeadStatus(ids: string[], status: LeadStatus): Promise<void> {
  return updateOpportunities(ids, { lead_status: status, ...(status === 'kontaktiert' ? { last_contact_at: new Date().toISOString() } : {}) });
}

/** Lead in die Pipeline uebernehmen: wird ein Deal in der ersten Phase. */
export async function promoteLeads(ids: string[], stages: PipelineStage[]): Promise<void> {
  const target = firstDealStage(stages);
  if (!target) throw new Error('Keine Pipeline-Phase vorhanden. Lege eine in den Einstellungen an.');
  await updateOpportunities(ids, { kind: 'deal', stage_id: target.id });
}

/**
 * Interessent als Firma anlegen: Firma mit dem Firmennamen (nicht dem
 * Personennamen), Hauptperson aus den Interessenten-Angaben, Deal verknuepft.
 */
export async function createCompanyFromOpportunity(o: OpportunityRow, companyId: string): Promise<string> {
  const p = o.prospect_info ?? {};
  const name = (p.company || p.name || o.title).trim();
  const person = opportunityPerson(o);
  const { data: customer, error } = await supabase
    .from('customers')
    .insert({ company_id: companyId, name, contact_person: person, email: p.email ?? null, phone: p.phone ?? null, is_active: true })
    .select('id')
    .single();
  if (error) throw error;
  if (person) {
    await supabase.from('customer_contacts').insert({ customer_id: customer.id, name: person, email: p.email ?? null, phone: p.phone ?? null, is_primary: true });
  }
  const { error: linkError } = await supabase.from('opportunities').update({ existing_customer_id: customer.id, prospect_info: null }).eq('id', o.id);
  if (linkError) throw linkError;
  return customer.id as string;
}

export function companyLabel(o: OpportunityRow): string {
  return opportunityCompany(o);
}
