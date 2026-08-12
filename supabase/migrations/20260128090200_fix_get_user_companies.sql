-- =====================================================================
-- FIX: get_user_companies - Return full company data
-- =====================================================================
-- Migration: 20260128_fix_get_user_companies.sql
-- Problem: RLS blocks SELECT on companies table when fetching multiple companies
-- Solution: Return full company data from get_user_companies RPC (bypasses RLS)
-- =====================================================================

-- Drop old function
DROP FUNCTION IF EXISTS public.get_user_companies();

-- Create new function that returns full company data
CREATE OR REPLACE FUNCTION public.get_user_companies()
RETURNS TABLE (
    company_id UUID,
    company_name TEXT,
    role TEXT,
    is_active BOOLEAN,
    -- Full company data (all columns from companies table)
    logo_url TEXT,
    street TEXT,
    house_number TEXT,
    zip_code TEXT,
    city TEXT,
    iban TEXT,
    qr_iban TEXT,
    bank_name TEXT,
    uid_number TEXT,
    vat_number TEXT,
    vat_registered BOOLEAN,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    active_company_id UUID;
BEGIN
    -- Get current active company
    active_company_id := public.get_user_company_id();

    RETURN QUERY
    SELECT
        c.id AS company_id,
        c.name AS company_name,
        uc.role,
        (c.id = active_company_id) AS is_active,
        -- Include all company fields
        c.logo_url,
        c.street,
        c.house_number,
        c.zip_code,
        c.city,
        c.iban,
        c.qr_iban,
        c.bank_name,
        c.uid_number,
        c.vat_number,
        c.vat_registered,
        c.created_at
    FROM public.user_companies uc
    JOIN public.companies c ON uc.company_id = c.id
    WHERE uc.user_id = auth.uid()
    ORDER BY (c.id = active_company_id) DESC, c.name ASC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_user_companies() TO authenticated;

-- Documentation
COMMENT ON FUNCTION public.get_user_companies() IS
'Returns all companies the current user has access to with full company data.
This bypasses RLS restrictions by using SECURITY DEFINER.
Usage: SELECT * FROM get_user_companies();';

-- Verification
DO $$
BEGIN
    RAISE NOTICE '===== SUCCESS =====';
    RAISE NOTICE '✅ get_user_companies() updated to return full company data';
    RAISE NOTICE '✅ This bypasses RLS restrictions';
    RAISE NOTICE '';
    RAISE NOTICE 'Frontend will now see all companies you have access to!';
END $$;
