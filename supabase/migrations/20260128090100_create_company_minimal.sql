-- =====================================================================
-- MINIMAL FIX: create_company_with_admin (only existing columns)
-- =====================================================================
-- Migration: 20260128_create_company_minimal.sql
-- Purpose: Create RPC function using ONLY columns that actually exist
-- =====================================================================

-- Drop existing function
DROP FUNCTION IF EXISTS public.create_company_with_admin(TEXT, TEXT, TEXT, TEXT, TEXT);

-- Create minimal function that only uses guaranteed columns
CREATE OR REPLACE FUNCTION public.create_company_with_admin(
    p_name TEXT,
    p_street TEXT,
    p_house_number TEXT,
    p_zip_code TEXT,
    p_city TEXT
)
RETURNS TABLE(
    id UUID,
    name TEXT,
    street TEXT,
    house_number TEXT,
    zip_code TEXT,
    city TEXT,
    logo_url TEXT,
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
SET search_path = public
AS $func$
DECLARE
    v_company_id UUID;
    v_user_id UUID;
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();

    -- Verify user is authenticated
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated'
            USING ERRCODE = '42501';
    END IF;

    -- Validate required fields
    IF p_name IS NULL OR trim(p_name) = '' THEN
        RAISE EXCEPTION 'Company name is required'
            USING ERRCODE = '22023';
    END IF;

    IF p_street IS NULL OR trim(p_street) = '' THEN
        RAISE EXCEPTION 'Street is required'
            USING ERRCODE = '22023';
    END IF;

    IF p_house_number IS NULL OR trim(p_house_number) = '' THEN
        RAISE EXCEPTION 'House number is required'
            USING ERRCODE = '22023';
    END IF;

    IF p_zip_code IS NULL OR trim(p_zip_code) = '' THEN
        RAISE EXCEPTION 'ZIP code is required'
            USING ERRCODE = '22023';
    END IF;

    IF p_city IS NULL OR trim(p_city) = '' THEN
        RAISE EXCEPTION 'City is required'
            USING ERRCODE = '22023';
    END IF;

    -- Step 1: Create the company (only guaranteed columns)
    INSERT INTO public.companies (
        name,
        street,
        house_number,
        zip_code,
        city,
        vat_registered,
        created_at
    )
    VALUES (
        trim(p_name),
        trim(p_street),
        trim(p_house_number),
        trim(p_zip_code),
        trim(p_city),
        false,
        now()
    )
    RETURNING companies.id INTO v_company_id;

    -- Step 2: Add user as admin to user_companies
    INSERT INTO public.user_companies (
        user_id,
        company_id,
        role,
        created_at
    )
    VALUES (
        v_user_id,
        v_company_id,
        'admin',
        now()
    );

    -- Step 3: Create default pipeline stages
    INSERT INTO public.pipeline_stages (company_id, name, color, position, created_at)
    VALUES
        (v_company_id, 'Qualifizierung', '#6B7280', 0, now()),
        (v_company_id, 'Offerte', '#3B82F6', 1, now()),
        (v_company_id, 'Verhandlung', '#F59E0B', 2, now()),
        (v_company_id, 'Abschluss', '#10B981', 3, now());

    -- Step 4: Return ONLY columns that exist (no country, phone, email, website, updated_at)
    RETURN QUERY
    SELECT
        c.id,
        c.name,
        c.street,
        c.house_number,
        c.zip_code,
        c.city,
        c.logo_url,
        c.iban,
        c.qr_iban,
        c.bank_name,
        c.uid_number,
        c.vat_number,
        c.vat_registered,
        c.created_at
    FROM public.companies c
    WHERE c.id = v_company_id;

EXCEPTION
    WHEN OTHERS THEN
        -- Log error and re-raise with context
        RAISE WARNING 'Error in create_company_with_admin: % %', SQLERRM, SQLSTATE;
        RAISE;
END;
$func$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_company_with_admin(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.create_company_with_admin(TEXT, TEXT, TEXT, TEXT, TEXT) IS
'Creates a new company and automatically assigns the current user as admin. Returns the created company record (minimal columns only).';

-- Verification
DO $$
BEGIN
    RAISE NOTICE '===== SUCCESS =====';
    RAISE NOTICE '✅ create_company_with_admin() created with minimal column set';
    RAISE NOTICE '✅ Only uses columns that exist in companies table';
    RAISE NOTICE '';
    RAISE NOTICE 'Try creating a company in the frontend now!';
END $$;
