-- ============================================================================
-- DISCOUNT SYSTEM - Database Migration
-- Date: 2026-02-01
-- Description: Adds discount_type and discount_value to invoices and quotes
-- Roadmap V5 Task 3.2: Rabatt-System
-- ============================================================================

-- ============================================================================
-- INVOICES TABLE - Add discount fields
-- ============================================================================

-- Add discount columns to invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed')),
  ADD COLUMN IF NOT EXISTS discount_value numeric(10, 2) DEFAULT 0 CHECK (discount_value >= 0);

-- Add comments for documentation
COMMENT ON COLUMN invoices.discount_type IS 'Discount type: percent (%) or fixed (CHF)';
COMMENT ON COLUMN invoices.discount_value IS 'Discount value (percentage or fixed amount in CHF)';

-- Note: Keep total_discount_percent for backward compatibility during migration
-- Frontend will migrate old data to new system on edit

-- ============================================================================
-- QUOTES TABLE - Add discount fields
-- ============================================================================

-- Add discount columns to quotes
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed')),
  ADD COLUMN IF NOT EXISTS discount_value numeric(10, 2) DEFAULT 0 CHECK (discount_value >= 0);

-- Add comments for documentation
COMMENT ON COLUMN quotes.discount_type IS 'Discount type: percent (%) or fixed (CHF)';
COMMENT ON COLUMN quotes.discount_value IS 'Discount value (percentage or fixed amount in CHF)';

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
--
-- The old `total_discount_percent` field on invoices will be kept for backward
-- compatibility. Frontend code will handle migration of existing data:
--   - If total_discount_percent > 0 AND discount_value = 0:
--       → Copy value to discount_value and set discount_type = 'percent'
--   - Otherwise use discount_type/discount_value directly
--
-- Line item discounts (invoice_items.discount_percent) remain unchanged
-- as they are always percentage-based.
-- ============================================================================
