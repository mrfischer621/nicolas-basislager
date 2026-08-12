-- Migration: Add alternativ_name and rechnungsname to companies table
-- These fields allow companies to use different display names for different contexts

-- Add alternativ_name (alternative company name / "Doing Business As")
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS alternativ_name TEXT NULL;

-- Add rechnungsname (display name for invoices and quotes)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS rechnungsname TEXT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.companies.alternativ_name IS 'Alternative company name (e.g., trade name or "Doing Business As")';
COMMENT ON COLUMN public.companies.rechnungsname IS 'Display name used on invoices and quotes (if different from official company name)';

-- No RLS changes needed - existing company policies automatically apply to new columns
