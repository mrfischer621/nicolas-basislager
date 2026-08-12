-- Migration: Add additional fields to invoices for title, intro, footer, and discounts
-- Phase 3.3 of roadmap

-- Add new columns to invoices table
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS introduction_text text,
  ADD COLUMN IF NOT EXISTS footer_text text,
  ADD COLUMN IF NOT EXISTS total_discount_percent numeric(5,2) DEFAULT 0;

-- Add discount column to invoice_items table
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN invoices.title IS 'Optional title/subject for the invoice';
COMMENT ON COLUMN invoices.introduction_text IS 'Custom intro text (overrides company default)';
COMMENT ON COLUMN invoices.footer_text IS 'Custom footer/remarks (overrides company default)';
COMMENT ON COLUMN invoices.total_discount_percent IS 'Discount percentage applied to total';
COMMENT ON COLUMN invoice_items.discount_percent IS 'Discount percentage for this line item';
