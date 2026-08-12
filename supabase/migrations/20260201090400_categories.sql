-- Migration: Create categories table for Milchbüechli (Single-Entry Bookkeeping)
-- Phase 3.1 - Buchungskategorien

-- Create enum for category type
DO $$ BEGIN
    CREATE TYPE category_type AS ENUM ('income', 'expense');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type category_type NOT NULL,
  icon text DEFAULT NULL, -- Lucide icon name (e.g., 'shopping-cart', 'briefcase')
  color text DEFAULT '#6B7280', -- Hex color for UI display
  is_tax_relevant boolean DEFAULT true, -- Steuerrelevant
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, name, type)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_categories_company ON categories(company_id);
CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(company_id, type);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(company_id, is_active);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- RLS Policy using table-based approach (no session variables)
CREATE POLICY "Tenant Isolation" ON categories
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    )
  );

-- Insert default categories for existing companies
-- Expense Categories (Swiss SME Standard)
INSERT INTO categories (company_id, name, type, icon, color, is_tax_relevant, sort_order)
SELECT c.id, cat.name, cat.type::category_type, cat.icon, cat.color, cat.is_tax_relevant, cat.sort_order
FROM companies c
CROSS JOIN (
  VALUES
    -- Expense Categories
    ('Warenaufwand', 'expense', 'package', '#EF4444', true, 1),
    ('Personalaufwand', 'expense', 'users', '#F97316', true, 2),
    ('Raumaufwand', 'expense', 'home', '#F59E0B', true, 3),
    ('Informatik & Telekom', 'expense', 'monitor', '#84CC16', true, 4),
    ('Werbung & Marketing', 'expense', 'megaphone', '#22C55E', true, 5),
    ('Fahrzeugkosten', 'expense', 'car', '#14B8A6', true, 6),
    ('Versicherungen', 'expense', 'shield', '#06B6D4', true, 7),
    ('Büromaterial', 'expense', 'paperclip', '#3B82F6', true, 8),
    ('Reisekosten', 'expense', 'plane', '#6366F1', true, 9),
    ('Abschreibungen', 'expense', 'trending-down', '#8B5CF6', true, 10),
    ('Bankspesen', 'expense', 'landmark', '#A855F7', true, 11),
    ('Sonstige Ausgaben', 'expense', 'more-horizontal', '#6B7280', true, 99),
    -- Income Categories
    ('Dienstleistungsumsatz', 'income', 'briefcase', '#10B981', true, 1),
    ('Warenverkauf', 'income', 'shopping-cart', '#059669', true, 2),
    ('Nebenerlöse', 'income', 'coins', '#047857', true, 3),
    ('Zinserträge', 'income', 'percent', '#065F46', false, 4)
) AS cat(name, type, icon, color, is_tax_relevant, sort_order)
ON CONFLICT (company_id, name, type) DO NOTHING;

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS categories_updated_at ON categories;
CREATE TRIGGER categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_categories_updated_at();

-- Add comment
COMMENT ON TABLE categories IS 'Income and expense categories for Milchbüechli (single-entry bookkeeping)';
COMMENT ON COLUMN categories.type IS 'income = Einnahmen, expense = Ausgaben';
COMMENT ON COLUMN categories.is_tax_relevant IS 'Whether this category is relevant for tax declaration';
