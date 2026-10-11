import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { BankBalance, Deadline, DeadlineRecurrence } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';
import { nextOccurrence } from '../utils/deadlines';

/** Kontostaende und Fristen (Einstellungen und Cockpit). */

export function useBankBalances() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? '';
  return useQuery({
    queryKey: ['bank_balances', companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<BankBalance[]> => {
      const { data, error } = await supabase.from('bank_balances').select('*').eq('company_id', companyId).order('date', { ascending: false }).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((b) => ({ ...b, amount: Number(b.amount) }));
    },
  });
}

export function useDeadlines() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? '';
  return useQuery({
    queryKey: ['deadlines', companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<Deadline[]> => {
      const { data, error } = await supabase.from('deadlines').select('*').eq('company_id', companyId).order('due_date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInvalidateCockpitData() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: ['bank_balances'] }), qc.invalidateQueries({ queryKey: ['deadlines'] })]);
}

export async function addBankBalance(companyId: string, row: { date: string; amount: number; account_label: string; note: string | null }) {
  const { error } = await supabase.from('bank_balances').insert({ company_id: companyId, ...row });
  if (error) throw error;
}

export async function deleteBankBalance(id: string) {
  const { error } = await supabase.from('bank_balances').delete().eq('id', id);
  if (error) throw error;
}

export async function addDeadline(companyId: string, row: { title: string; due_date: string; recurrence: DeadlineRecurrence; note: string | null }) {
  const { error } = await supabase.from('deadlines').insert({ company_id: companyId, ...row });
  if (error) throw error;
}

/** Frist erledigen; bei Wiederholung entsteht die naechste als neue Zeile. */
export async function completeDeadline(d: Deadline): Promise<string | null> {
  const { error } = await supabase.from('deadlines').update({ done_at: new Date().toISOString() }).eq('id', d.id);
  if (error) throw error;
  const next = nextOccurrence(d.due_date, d.recurrence);
  if (next) {
    const { error: insertError } = await supabase
      .from('deadlines')
      .insert({ company_id: d.company_id, title: d.title, due_date: next, recurrence: d.recurrence, note: d.note });
    if (insertError) throw insertError;
  }
  return next;
}

export async function reopenDeadline(id: string) {
  const { error } = await supabase.from('deadlines').update({ done_at: null }).eq('id', id);
  if (error) throw error;
}

export async function deleteDeadline(id: string) {
  const { error } = await supabase.from('deadlines').delete().eq('id', id);
  if (error) throw error;
}
