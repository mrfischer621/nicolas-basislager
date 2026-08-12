-- VAT (MWST) Configuration - Roadmap V5 Phase 3
-- This migration adds per-line VAT calculation support with company-level enablement

-- 1. Add VAT configuration to companies table
ALTER TABLE public.companies
  ADD COLUMN vat_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN default_vat_rate NUMERIC(5,2) NOT NULL DEFAULT 8.1;

-- 2. Add VAT rate to products table (NULL = use company default)
ALTER TABLE public.products
  ADD COLUMN vat_rate NUMERIC(5,2) NULL;

-- 3. Add VAT fields to invoice_items table (snapshot at creation time)
ALTER TABLE public.invoice_items
  ADD COLUMN vat_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN vat_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- 4. Backfill existing invoice_items with parent invoice VAT rates
UPDATE public.invoice_items ii
SET vat_rate = COALESCE(i.vat_rate, 0),
    vat_amount = (ii.total * (COALESCE(i.vat_rate, 0) / 100))
FROM public.invoices i
WHERE ii.invoice_id = i.id;

-- 5. Add CHECK constraints for valid VAT rate ranges (0-100%)
ALTER TABLE public.companies
  ADD CONSTRAINT companies_default_vat_rate_range
    CHECK (default_vat_rate >= 0 AND default_vat_rate <= 100);

ALTER TABLE public.products
  ADD CONSTRAINT products_vat_rate_range
    CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100));

ALTER TABLE public.invoice_items
  ADD CONSTRAINT invoice_items_vat_rate_range
    CHECK (vat_rate >= 0 AND vat_rate <= 100);

-- 6. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_companies_vat_enabled ON public.companies(vat_enabled);
CREATE INDEX IF NOT EXISTS idx_products_vat_rate ON public.products(vat_rate) WHERE vat_rate IS NOT NULL;

-- Migration complete
-- Note: Existing RLS policies automatically apply to new columns
-- Note: All existing invoices maintain their current VAT behavior (backward compatible)
