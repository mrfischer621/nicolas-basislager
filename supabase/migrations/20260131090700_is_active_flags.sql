-- Migration: Add is_active flags for soft-delete/archiving functionality
-- Phase 5.1: Globale Filter (Alle/Aktiv/Archiviert)

-- Add is_active to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Add is_active to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Create indexes for filtering performance
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active);
CREATE INDEX IF NOT EXISTS idx_projects_is_active ON projects(is_active);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

-- Composite indexes for company + active status queries
CREATE INDEX IF NOT EXISTS idx_customers_company_active ON customers(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_projects_company_active ON projects(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_company_active ON products(company_id, is_active);

COMMENT ON COLUMN customers.is_active IS 'Soft-delete flag: false = archived, can be restored';
COMMENT ON COLUMN projects.is_active IS 'Soft-delete flag: false = archived, can be restored';
