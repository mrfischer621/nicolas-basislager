-- =====================================================================
-- FIX: Invoice number should be unique per company, not globally
-- =====================================================================
-- Migration: 20260130_fix_invoice_number_constraint.sql
-- Problem: invoices_invoice_number_key is globally unique, preventing
--          different companies from using the same invoice numbers
-- Solution: Change to composite unique constraint (company_id, invoice_number)
-- =====================================================================

-- Drop the old global unique constraint
ALTER TABLE invoices
DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;

-- Create new composite unique constraint (company-scoped)
ALTER TABLE invoices
ADD CONSTRAINT invoices_company_invoice_number_key
UNIQUE (company_id, invoice_number);

-- Add comment for documentation
COMMENT ON CONSTRAINT invoices_company_invoice_number_key ON invoices IS
'Invoice numbers must be unique within each company, but different companies can use the same numbers';

-- Verification
DO $$
BEGIN
    RAISE NOTICE '===== SUCCESS =====';
    RAISE NOTICE '✅ Removed global unique constraint on invoice_number';
    RAISE NOTICE '✅ Added composite unique constraint (company_id, invoice_number)';
    RAISE NOTICE '';
    RAISE NOTICE 'Each company can now have their own invoice numbering sequence!';
END $$;
