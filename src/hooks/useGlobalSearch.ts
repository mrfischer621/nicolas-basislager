import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';

export interface SearchResult {
  id: string;
  type: 'customer' | 'project' | 'product' | 'invoice' | 'transaction';
  title: string;
  subtitle?: string;
  route: string;
}

export interface GroupedResults {
  customers: SearchResult[];
  projects: SearchResult[];
  products: SearchResult[];
  invoices: SearchResult[];
  transactions: SearchResult[];
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export function useGlobalSearch(query: string) {
  const { selectedCompany } = useCompany();
  const [results, setResults] = useState<GroupedResults>({
    customers: [],
    projects: [],
    products: [],
    invoices: [],
    transactions: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Reset if query is too short
    if (!query || query.length < MIN_QUERY_LENGTH || !selectedCompany?.id) {
      setResults({
        customers: [],
        projects: [],
        products: [],
        invoices: [],
        transactions: [],
      });
      setIsLoading(false);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const companyId = selectedCompany.id;
        const searchTerm = `%${query}%`;

        // Run parallel queries for all entity types
        const [
          customersResult,
          projectsResult,
          productsResult,
          invoicesResult,
          transactionsResult,
        ] = await Promise.all([
          // Customers: search name, contact_person
          supabase
            .from('customers')
            .select('id, name, contact_person, email')
            .eq('company_id', companyId)
            .or(`name.ilike.${searchTerm},contact_person.ilike.${searchTerm}`)
            .limit(5),

          // Projects: search name
          supabase
            .from('projects')
            .select('id, name, status')
            .eq('company_id', companyId)
            .ilike('name', searchTerm)
            .limit(5),

          // Products: search name
          supabase
            .from('products')
            .select('id, name, price')
            .eq('company_id', companyId)
            .ilike('name', searchTerm)
            .limit(5),

          // Invoices: search invoice_number
          supabase
            .from('invoices')
            .select('id, invoice_number, total, status')
            .eq('company_id', companyId)
            .ilike('invoice_number', searchTerm)
            .limit(5),

          // Transactions: search description
          supabase
            .from('transactions')
            .select('id, description, amount, type, date')
            .eq('company_id', companyId)
            .ilike('description', searchTerm)
            .limit(5),
        ]);

        // Map results to unified format
        const grouped: GroupedResults = {
          customers: (customersResult.data || []).map((c) => ({
            id: c.id as string,
            type: 'customer' as const,
            title: c.name as string,
            subtitle: (c.contact_person || c.email || undefined) as string | undefined,
            route: `/kontakte/firmen/${c.id}`,
          })),
          projects: (projectsResult.data || []).map((p) => ({
            id: p.id as string,
            type: 'project' as const,
            title: p.name as string,
            subtitle: p.status as string,
            route: `/projekte?id=${p.id}`,
          })),
          products: (productsResult.data || []).map((p) => ({
            id: p.id as string,
            type: 'product' as const,
            title: p.name as string,
            subtitle: `CHF ${Number(p.price).toFixed(2)}`,
            route: `/einstellungen/leistungen?id=${p.id}`,
          })),
          invoices: (invoicesResult.data || []).map((i) => ({
            id: i.id as string,
            type: 'invoice' as const,
            title: i.invoice_number as string,
            subtitle: `CHF ${Number(i.total).toFixed(2)} - ${i.status}`,
            route: `/rechnungen?id=${i.id}`,
          })),
          transactions: (transactionsResult.data || []).map((t) => ({
            id: t.id as string,
            type: 'transaction' as const,
            title: (t.description || 'Buchung') as string,
            subtitle: `${t.type === 'einnahme' ? '+' : '-'}CHF ${Number(t.amount).toFixed(2)}`,
            route: `/buchungen?id=${t.id}`,
          })),
        };

        setResults(grouped);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setError('Suche fehlgeschlagen');
        console.error('Search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [query, selectedCompany?.id]);

  const totalResults =
    results.customers.length +
    results.projects.length +
    results.products.length +
    results.invoices.length +
    results.transactions.length;

  const hasResults = totalResults > 0;

  return {
    results,
    isLoading,
    error,
    hasResults,
    totalResults,
  };
}
