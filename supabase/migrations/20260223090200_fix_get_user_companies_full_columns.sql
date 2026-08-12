-- ============================================================================
-- Migration: Fix get_user_companies() — return all company columns
-- Date: 2026-02-23
-- Problem: The function was defined in January with a hardcoded column list.
--   Columns added since then (phone, email, website, country, vat_enabled,
--   default_vat_rate, sender_contact_name, product_categories, text templates,
--   alternativ_name, rechnungsname, qr_creditor_name) were never included,
--   so they always came back NULL after refreshCompanies().
-- Solution: Replace the function with a version that returns all columns.
-- Note: product_categories is JSONB (not TEXT[]) — matches the actual column type.
-- ============================================================================

-- Step 1: Ensure contact columns exist (idempotent)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS phone   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS website TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT NULL;

-- Step 2: Replace the function
DROP FUNCTION IF EXISTS public.get_user_companies();

CREATE OR REPLACE FUNCTION public.get_user_companies()
RETURNS TABLE (
    -- Junction / meta
    company_id          UUID,
    company_name        TEXT,
    role                TEXT,
    is_active           BOOLEAN,
    -- Identity
    alternativ_name     TEXT,
    rechnungsname       TEXT,
    logo_url            TEXT,
    sender_contact_name TEXT,
    -- Address
    street              TEXT,
    house_number        TEXT,
    zip_code            TEXT,
    city                TEXT,
    country             TEXT,
    -- Banking
    iban                TEXT,
    qr_iban             TEXT,
    qr_creditor_name    TEXT,
    bank_name           TEXT,
    -- Tax / VAT
    uid_number          TEXT,
    vat_number          TEXT,
    vat_registered      BOOLEAN,
    vat_enabled         BOOLEAN,
    default_vat_rate    NUMERIC,
    -- Contact (shown in PDF footer)
    phone               TEXT,
    email               TEXT,
    website             TEXT,
    -- Product categories (stored as JSONB)
    product_categories  JSONB,
    -- Text templates
    invoice_intro_text  TEXT,
    invoice_footer_text TEXT,
    quote_intro_text    TEXT,
    quote_footer_text   TEXT,
    -- Timestamps
    created_at          TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    active_company_id UUID;
BEGIN
    active_company_id := public.get_user_company_id();

    RETURN QUERY
    SELECT
        c.id                  AS company_id,
        c.name                AS company_name,
        uc.role::TEXT,
        (c.id = active_company_id) AS is_active,
        c.alternativ_name,
        c.rechnungsname,
        c.logo_url,
        c.sender_contact_name,
        c.street,
        c.house_number,
        c.zip_code,
        c.city,
        c.country,
        c.iban,
        c.qr_iban,
        c.qr_creditor_name,
        c.bank_name,
        c.uid_number,
        c.vat_number,
        c.vat_registered,
        c.vat_enabled,
        c.default_vat_rate,
        c.phone,
        c.email,
        c.website,
        COALESCE(c.product_categories, '[]'::jsonb),
        c.invoice_intro_text,
        c.invoice_footer_text,
        c.quote_intro_text,
        c.quote_footer_text,
        c.created_at
    FROM public.user_companies uc
    JOIN public.companies c ON uc.company_id = c.id
    WHERE uc.user_id = auth.uid()
    ORDER BY (c.id = active_company_id) DESC, c.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_companies() TO authenticated;

COMMENT ON FUNCTION public.get_user_companies() IS
'Returns all companies the current user has access to with ALL company columns.
Updated 2026-02-23 to include phone, email, website, country and all columns
added since the original January definition.';
