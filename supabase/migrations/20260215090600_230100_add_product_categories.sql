-- Phase 3.2: Add product_categories column to companies table
-- Stores an array of product category names as JSONB (better JS client compatibility)

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS product_categories JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN companies.product_categories IS 'Array of product category names for dropdown in ProductForm (stored as JSONB)';

-- Add some default categories for existing companies
UPDATE companies
SET product_categories = '["Dienstleistung", "Material", "Beratung", "Software"]'::jsonb
WHERE product_categories IS NULL OR product_categories = '[]'::jsonb;
