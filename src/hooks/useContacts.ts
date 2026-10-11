import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Customer, CustomerContact } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';
import { orSearch, pageRange, type ListState } from '../components/list';

export type PersonRow = CustomerContact & { customer: { id: string; name: string; company_id: string; is_active: boolean } };

/** Firmen nach URL-Zustand (Tab, Suche), seitenweise aus der Datenbank. */
export function useCompanyList(state: ListState) {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? '';
  return useQuery({
    queryKey: ['customers', companyId, 'list', state],
    enabled: !!companyId,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<{ rows: Customer[]; total: number }> => {
      const [from, to] = pageRange(Number(state.seite ?? 1));
      let q = supabase.from('customers').select('*', { count: 'exact' }).eq('company_id', companyId);
      if (state.status === 'archiviert') q = q.eq('is_active', false);
      else if (state.status !== 'alle') q = q.eq('is_active', true);
      if (state.q?.trim()) q = q.or(orSearch(['name', 'city', 'email', 'contact_person'], state.q));
      const { data, error, count } = await q.order('name').range(from, to);
      if (error) throw error;
      return { rows: data ?? [], total: count ?? 0 };
    },
  });
}

/** Personen aller Firmen des Unternehmens, seitenweise aus der Datenbank. */
export function usePersonList(state: ListState) {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? '';
  return useQuery({
    queryKey: ['customer_contacts', companyId, 'list', state],
    enabled: !!companyId,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<{ rows: PersonRow[]; total: number }> => {
      const [from, to] = pageRange(Number(state.seite ?? 1));
      let q = supabase.from('customer_contacts').select('*, customer:customers!inner(id, name, company_id, is_active)', { count: 'exact' }).eq('customer.company_id', companyId);
      if (state.q?.trim()) q = q.or(orSearch(['name', 'email', 'role', 'phone'], state.q));
      const { data, error, count } = await q.order('name').range(from, to);
      if (error) throw error;
      return { rows: (data ?? []) as PersonRow[], total: count ?? 0 };
    },
  });
}

export function useCustomerContacts(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer_contacts', 'of', customerId],
    enabled: !!customerId,
    queryFn: async (): Promise<CustomerContact[]> => {
      const { data, error } = await supabase.from('customer_contacts').select('*').eq('customer_id', customerId!).order('is_primary', { ascending: false }).order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInvalidateContacts() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: ['customers'] }), qc.invalidateQueries({ queryKey: ['customer_contacts'] })]);
}

/** Person speichern; als Hauptperson setzt sie die bisherige zurueck. */
export async function savePerson(person: Partial<CustomerContact> & { customer_id: string; name: string }, id?: string) {
  if (person.is_primary) {
    await supabase.from('customer_contacts').update({ is_primary: false }).eq('customer_id', person.customer_id);
  }
  const row = { customer_id: person.customer_id, name: person.name, role: person.role ?? null, email: person.email ?? null, phone: person.phone ?? null, is_primary: !!person.is_primary };
  const { error } = id ? await supabase.from('customer_contacts').update(row).eq('id', id) : await supabase.from('customer_contacts').insert(row);
  if (error) throw error;
}
