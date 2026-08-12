import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Customer, Project, Product, Category } from '../lib/supabase';
import { useCompany } from '../context/CompanyContext';

/**
 * Gemeinsame Abfragen fuer Stammdaten.
 *
 * Vorher holte sich jede Seite dieselben Daten selbst: .from('customers')
 * stand an 19 Stellen, .from('projects') an 12, .from('products') an 8 -
 * jeweils mit eigenem Lade- und Fehlerzustand und ohne Cache. Dieselbe
 * Kundenliste wurde bei jedem Seitenwechsel neu geladen.
 *
 * Nebeneffekt, der ein echtes Problem loest: Die Firmen-ID steckt im
 * Query-Key. Wechselt die Firma, gehoert eine noch laufende Antwort zu einem
 * anderen Key und kann die neuen Daten nicht mehr ueberschreiben. Die
 * Race Condition beim Firmenwechsel ist damit strukturell ausgeschlossen,
 * statt an jeder Aufrufstelle einzeln per AbortController behandelt zu werden.
 */

export const queryKeys = {
  customers: (companyId: string) => ['customers', companyId] as const,
  projects: (companyId: string) => ['projects', companyId] as const,
  products: (companyId: string) => ['products', companyId] as const,
  categories: (companyId: string) => ['categories', companyId] as const,
};

/** Kunden der aktiven Firma. `activeOnly` blendet archivierte aus. */
export function useCustomers(options: { activeOnly?: boolean } = {}) {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  return useQuery({
    queryKey: [...queryKeys.customers(companyId ?? ''), options.activeOnly ?? false],
    enabled: !!companyId,
    queryFn: async (): Promise<Customer[]> => {
      let query = supabase
        .from('customers')
        .select('*')
        .eq('company_id', companyId!)
        .order('name', { ascending: true });

      if (options.activeOnly) query = query.eq('is_active', true);

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Projekte der aktiven Firma, inklusive Kundenname aus dem Join. */
export function useProjects(options: { activeOnly?: boolean } = {}) {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  return useQuery({
    queryKey: [...queryKeys.projects(companyId ?? ''), options.activeOnly ?? false],
    enabled: !!companyId,
    queryFn: async (): Promise<Project[]> => {
      let query = supabase
        .from('projects')
        .select('*, customers(name)')
        .eq('company_id', companyId!)
        .order('name', { ascending: true });

      if (options.activeOnly) query = query.eq('is_active', true);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });
}

/** Produkte der aktiven Firma. */
export function useProducts(options: { activeOnly?: boolean } = {}) {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  return useQuery({
    queryKey: [...queryKeys.products(companyId ?? ''), options.activeOnly ?? false],
    enabled: !!companyId,
    queryFn: async (): Promise<Product[]> => {
      let query = supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId!)
        .order('name', { ascending: true });

      if (options.activeOnly) query = query.eq('is_active', true);

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Buchungskategorien der aktiven Firma. */
export function useCategories() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  return useQuery({
    queryKey: queryKeys.categories(companyId ?? ''),
    enabled: !!companyId,
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('company_id', companyId!)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Laedt zwischengespeicherte Stammdaten neu - nach dem Anlegen, Aendern oder
 * Loeschen eines Datensatzes aufrufen.
 */
export function useInvalidateData() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? '';

  return {
    customers: () => queryClient.invalidateQueries({ queryKey: queryKeys.customers(companyId) }),
    projects: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects(companyId) }),
    products: () => queryClient.invalidateQueries({ queryKey: queryKeys.products(companyId) }),
    categories: () => queryClient.invalidateQueries({ queryKey: queryKeys.categories(companyId) }),
    /** Alles neu laden - z.B. nach einem Firmenwechsel */
    all: () => queryClient.invalidateQueries(),
  };
}
