-- ============================================================================
-- Migration: Company contact fields (phone, email, website, country)
-- Date: 2026-02-23
-- Description: Adds contact information columns to the companies table.
--   These fields are displayed in the PDF footer bar on quotes/invoices.
-- ============================================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS phone   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS website TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT NULL;

COMMENT ON COLUMN public.companies.phone   IS 'Company phone number, shown in PDF footer.';
COMMENT ON COLUMN public.companies.email   IS 'Company email address, shown in PDF footer.';
COMMENT ON COLUMN public.companies.website IS 'Company website URL.';
COMMENT ON COLUMN public.companies.country IS 'Company country (ISO code or full name).';
