import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Company } from '../lib/supabase';

/** Zeile aus der RPC get_user_companies (company_id/company_name plus Firmenfelder) */
type CompanyRpcRow = Omit<Company, 'id' | 'name'> & { company_id: string; company_name: string };
import { useAuth } from './AuthProvider';

interface CompanyContextType {
  companies: Company[]; // ALL companies user has access to
  selectedCompany: Company | null; // Currently active company
  switchCompany: (companyId: string) => Promise<void>;
  refreshCompanies: () => Promise<void>; // Reload companies list
  isLoading: boolean;
  error: string | null;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading: authLoading } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasInitializedRef = useRef(false);
  const isManualSwitchRef = useRef(false);

  // Fetch all companies user has access to
  const fetchUserCompanies = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('[CompanyContext] Fetching user companies...');

      // Call get_user_companies RPC function
      // This now returns full company data, bypassing RLS restrictions
      const { data, error: rpcError } = await supabase.rpc('get_user_companies');

      console.log('[CompanyContext] RPC Response:', { data, error: rpcError });

      if (rpcError) {
        console.error('[CompanyContext] RPC ERROR:', rpcError);
        setError('Fehler beim Laden der Firmen: ' + rpcError.message);
        setCompanies([]);
        return;
      }

      if (!data || data.length === 0) {
        console.warn('[CompanyContext] No companies found - data:', data);
        setCompanies([]);
        setError('Keine Firmen gefunden. Bitte kontaktieren Sie Ihren Administrator.');
        return;
      }

      console.log('[CompanyContext] Found', data.length, 'companies');

      // Transform RPC data to Company objects
      // The RPC now returns full company data, so no separate SELECT needed!
      console.log('[CompanyContext] Mapping company data. First row:', data[0]);

      const companiesData: Company[] = (data as CompanyRpcRow[]).map((row) => ({
        id: row.company_id,
        name: row.company_name,
        alternativ_name: row.alternativ_name || null,
        rechnungsname: row.rechnungsname || null,
        logo_url: row.logo_url || null,
        sender_contact_name: row.sender_contact_name || null,
        // Address
        street: row.street,
        house_number: row.house_number,
        zip_code: row.zip_code,
        city: row.city,
        country: row.country || null,
        // Banking
        iban: row.iban,
        qr_iban: row.qr_iban,
        qr_creditor_name: row.qr_creditor_name || null,
        bank_name: row.bank_name,
        // Tax
        uid_number: row.uid_number,
        vat_number: row.vat_number,
        vat_registered: row.vat_registered || false,
        vat_enabled: row.vat_enabled || false,
        default_vat_rate: row.default_vat_rate || 8.1,
        // Contact (PDF footer)
        phone: row.phone || null,
        email: row.email || null,
        website: row.website || null,
        // Product categories
        product_categories: row.product_categories || [],
        // Text templates
        invoice_intro_text: row.invoice_intro_text || null,
        invoice_footer_text: row.invoice_footer_text || null,
        quote_intro_text: row.quote_intro_text || null,
        quote_footer_text: row.quote_footer_text || null,
        // Timestamps
        created_at: row.created_at,
        updated_at: row.updated_at || undefined,
      }));

      console.log('[CompanyContext] Mapped companies:', companiesData);

      setCompanies(companiesData);

      // Create data array with is_active flag for selectInitialCompany
      // Note: is_active is calculated client-side based on last_active_company_id
      const dataWithActiveFlag = (data as CompanyRpcRow[]).map((row) => ({
        company_id: row.company_id,
        is_active: profile?.last_active_company_id === row.company_id,
      }));

      // Determine which company should be selected
      await selectInitialCompany(companiesData, dataWithActiveFlag);
    } catch (err) {
      console.error('Unexpected error fetching companies:', err);
      setError('Unerwarteter Fehler beim Laden der Firmen');
      setCompanies([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Select initial company based on last_active or first available
  const selectInitialCompany = async (
    availableCompanies: Company[],
    userCompanies: { company_id: string; is_active: boolean }[]
  ) => {
    // CRITICAL FIX: Skip if already initialized (prevents race conditions during manual switches)
    if (hasInitializedRef.current) {
      console.log('[CompanyContext] Already initialized, skipping selectInitialCompany');
      return;
    }

    // CRITICAL FIX: Skip if manual switch is in progress
    if (isManualSwitchRef.current) {
      console.log('[CompanyContext] Manual switch in progress, skipping selectInitialCompany');
      return;
    }

    console.log('[CompanyContext] Selecting initial company...');
    console.log('[CompanyContext] Available companies:', availableCompanies.map(c => ({ id: c.id, name: c.name })));
    console.log('[CompanyContext] User companies (from RPC):', userCompanies);
    console.log('[CompanyContext] Profile last_active_company_id:', profile?.last_active_company_id);

    if (availableCompanies.length === 0) {
      setSelectedCompany(null);
      return;
    }

    let selectedCompanyId: string | null = null;
    let selectionReason = '';

    // PRIORITY 1: Use last_active_company_id from profile (most reliable)
    // This is the user's explicitly saved preference
    if (profile?.last_active_company_id) {
      const lastActiveCompany = availableCompanies.find(
        (c) => c.id === profile.last_active_company_id
      );
      if (lastActiveCompany) {
        selectedCompanyId = lastActiveCompany.id;
        selectionReason = 'from profile.last_active_company_id (user preference)';
      }
    }

    // PRIORITY 2: Use is_active flag from RPC (fallback)
    // Only use this if last_active_company_id is not set
    if (!selectedCompanyId) {
      const activeCompany = userCompanies.find((uc) => uc.is_active);
      if (activeCompany) {
        const company = availableCompanies.find((c) => c.id === activeCompany.company_id);
        if (company) {
          selectedCompanyId = company.id;
          selectionReason = 'from is_active flag (fallback)';
        }
      }
    }

    // PRIORITY 3: Use first available company (final fallback)
    if (!selectedCompanyId) {
      selectedCompanyId = availableCompanies[0].id;
      selectionReason = 'first available company (final fallback)';
    }

    console.log('[CompanyContext] Selected company:', selectedCompanyId, selectionReason);

    // Set session variable ONLY on initial load
    await setActiveCompanySession(selectedCompanyId);

    const selectedCompany = availableCompanies.find((c) => c.id === selectedCompanyId);
    if (selectedCompany) {
      console.log('[CompanyContext] Setting selected company:', selectedCompany.name);
      setSelectedCompany(selectedCompany);
      hasInitializedRef.current = true; // Mark as initialized
    }
  };

  // Set active company in session (calls set_active_company RPC)
  const setActiveCompanySession = async (companyId: string) => {
    try {
      console.log('[CompanyContext] Setting active company:', companyId);
      const { error } = await supabase.rpc('set_active_company', { company_id: companyId });
      if (error) {
        console.error('[CompanyContext] Error setting active company:', error);
      } else {
        console.log('[CompanyContext] Active company set successfully');
      }
    } catch (err) {
      console.error('[CompanyContext] Unexpected error setting active company:', err);
    }
  };

  // Refresh companies list (useful after creating a new company)
  const refreshCompanies = async () => {
    if (!user) return;
    // Reset initialization flag to allow selectInitialCompany to run
    hasInitializedRef.current = false;
    await fetchUserCompanies();
  };

  // Switch to a different company
  const switchCompany = async (companyId: string) => {
    console.log('[CompanyContext] Manual company switch requested:', companyId);

    // CRITICAL FIX: Set manual switch flag to prevent selectInitialCompany from interfering
    isManualSwitchRef.current = true;

    try {
      setIsLoading(true);
      setError(null);

      // Try to find company in local list first
      let targetCompany = companies.find((c) => c.id === companyId);

      // If company not found in local list, try fetching it directly from DB
      if (!targetCompany) {
        console.log('[CompanyContext] Company not in cache, fetching from DB...');
        const { data: companyData, error: fetchError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', companyId)
          .single();

        if (fetchError || !companyData) {
          console.error('Error fetching company:', fetchError);
          throw new Error('Company not found or access denied');
        }

        targetCompany = companyData as Company;

        // CRITICAL FIX: Don't call fetchUserCompanies() here - it triggers selectInitialCompany
        // which can race with our manual switch and overwrite the session
        // Instead, just add the company to the local list
        setCompanies(prev => {
          const exists = prev.some(c => c.id === companyId);
          if (exists) return prev;
          return [...prev, targetCompany!];
        });
      }

      // Call set_active_company RPC (validates access + updates session + updates last_active)
      console.log('[CompanyContext] Setting active company session for:', targetCompany.name);
      const { error: rpcError } = await supabase.rpc('set_active_company', { company_id: companyId });

      if (rpcError) {
        console.error('Error switching company:', rpcError);
        setError('Fehler beim Wechseln der Firma');
        return;
      }

      console.log('[CompanyContext] Active company session set, updating local state');
      // Update local state
      setSelectedCompany(targetCompany);

      // Note: Pages will automatically refresh via useEffect watching selectedCompany
      // No need to reload the entire page anymore
    } catch (err) {
      console.error('Unexpected error switching company:', err);
      setError('Unerwarteter Fehler beim Wechseln der Firma');
    } finally {
      setIsLoading(false);
      // Reset manual switch flag after a small delay to ensure state propagation
      setTimeout(() => {
        isManualSwitchRef.current = false;
      }, 100);
    }
  };

  // Load companies when user/profile changes
  useEffect(() => {
    const loadCompanies = async () => {
      // Wait for auth to finish loading
      if (authLoading) {
        setIsLoading(true);
        return;
      }

      // If no user or profile, clear state
      if (!user || !profile) {
        setCompanies([]);
        setSelectedCompany(null);
        setIsLoading(false);
        setError(null);
        return;
      }

      // Fetch user's companies
      await fetchUserCompanies();
    };

    loadCompanies();
  }, [user, profile, authLoading]);

  return (
    <CompanyContext.Provider
      value={{
        companies,
        selectedCompany,
        switchCompany,
        refreshCompanies,
        isLoading,
        error,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
