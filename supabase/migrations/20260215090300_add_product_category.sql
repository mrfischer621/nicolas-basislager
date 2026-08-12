-- Migration: Add category field to products table
-- Task 4.2: Product Categories (Roadmap Phase 4)
-- Created: 2026-02-15

-- Add category column to products table
ALTER TABLE products
ADD COLUMN category TEXT;

-- Add index for faster category filtering/grouping
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category) WHERE category IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN products.category IS 'Product category for grouping and filtering (e.g., "Dienstleistung", "Produkt", "Material")';
