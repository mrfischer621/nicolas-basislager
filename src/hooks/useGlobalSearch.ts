import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';
import { orSearch } from '../components/list';
import { formatChfDisplay } from '../utils/money';
import { formatDate } from '../utils/format';

export interface SearchResult {
  id: string;
  group: string;
  title: string;
  subtitle?: string;
  route: string;
}

const MIN_QUERY_LENGTH = 2;

/**
 * Suche der Befehlspalette: Firmen, Personen, Leads und Deals, Offerten,
 * Rechnungen, Projekte, Buchungen und Leistungen, je hoechstens 5 Treffer.
 * Status erscheinen als Wort, nicht als Rohwert.
 */
export function useGlobalSearch(query: string) {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? '';
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const result = useQuery({
    queryKey: ['search', companyId, debounced],
    enabled: !!companyId && debounced.length >= MIN_QUERY_LENGTH,
    staleTime: 30_000,
    queryFn: async (): Promise<SearchResult[]> => {
      const q = debounced;
      const [customers, contacts, opps, quotes, invoices, projects, transactions, products] = await Promise.all([
        supabase.from('customers').select('id, name, city').eq('company_id', companyId).or(orSearch(['name', 'city', 'email'], q)).limit(5),
        supabase.from('customer_contacts').select('id, name, role, customer_id, customer:customers!inner(name, company_id)').eq('customer.company_id', companyId).or(orSearch(['name', 'email'], q)).limit(5),
        supabase.from('opportunities').select('id, title, kind, prospect_info').eq('company_id', companyId).or(orSearch(['title', 'prospect_info->>company', 'prospect_info->>name'], q)).limit(5),
        supabase.from('quotes').select('id, quote_number, total').eq('company_id', companyId).ilike('quote_number', `%${q}%`).limit(5),
        supabase.from('invoices').select('id, invoice_number, total, title').eq('company_id', companyId).or(orSearch(['invoice_number', 'title'], q)).limit(5),
        supabase.from('projects').select('id, name').eq('company_id', companyId).ilike('name', `%${q}%`).limit(5),
        supabase.from('transactions').select('id, description, counterparty, amount, date').eq('company_id', companyId).or(orSearch(['description', 'counterparty', 'transaction_number'], q)).limit(5),
        supabase.from('products').select('id, name, price').eq('company_id', companyId).ilike('name', `%${q}%`).limit(5),
      ]);
      const out: SearchResult[] = [];
      for (const c of customers.data ?? []) out.push({ id: `c-${c.id}`, group: 'Firmen', title: c.name, subtitle: c.city ?? undefined, route: `/kontakte/firmen/${c.id}` });
      for (const p of (contacts.data ?? []) as unknown as { id: string; name: string; role: string | null; customer_id: string; customer: { name: string } }[])
        out.push({ id: `p-${p.id}`, group: 'Personen', title: p.name, subtitle: [p.role, p.customer?.name].filter(Boolean).join(', '), route: `/kontakte/firmen/${p.customer_id}` });
      for (const o of (opps.data ?? []) as { id: string; title: string; kind: string; prospect_info: { company?: string; name?: string } | null }[])
        out.push({ id: `o-${o.id}`, group: o.kind === 'lead' ? 'Leads' : 'Deals', title: o.prospect_info?.company ?? o.prospect_info?.name ?? o.title, subtitle: o.title, route: o.kind === 'lead' ? `/leads?ansicht=alle&q=${encodeURIComponent(q)}` : '/pipeline?darstellung=tabelle' });
      for (const x of quotes.data ?? []) out.push({ id: `q-${x.id}`, group: 'Offerten', title: x.quote_number, subtitle: formatChfDisplay(Number(x.total)), route: `/offerten/${x.id}` });
      for (const i of invoices.data ?? []) out.push({ id: `i-${i.id}`, group: 'Rechnungen', title: i.invoice_number, subtitle: [formatChfDisplay(Number(i.total)), i.title].filter(Boolean).join(', '), route: `/rechnungen/${i.id}` });
      for (const p of projects.data ?? []) out.push({ id: `pr-${p.id}`, group: 'Projekte', title: p.name, route: `/projekte/${p.id}` });
      for (const t of transactions.data ?? [])
        out.push({ id: `t-${t.id}`, group: 'Buchungen', title: t.counterparty ?? t.description ?? 'Buchung', subtitle: `${formatDate(t.date)}, ${formatChfDisplay(Number(t.amount))}`, route: `/buchungen?id=${t.id}&zeitraum=alle` });
      for (const p of products.data ?? []) out.push({ id: `l-${p.id}`, group: 'Leistungen', title: p.name, subtitle: formatChfDisplay(Number(p.price)), route: `/einstellungen/leistungen?id=${p.id}` });
      return out;
    },
  });

  return { results: debounced.length >= MIN_QUERY_LENGTH ? result.data ?? [] : [], isLoading: result.isFetching };
}
