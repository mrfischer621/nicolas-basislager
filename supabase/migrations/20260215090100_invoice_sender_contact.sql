-- Migration: Add Invoice Sender Contact Name
-- Roadmap v5 Phase 3.3: Support for "c/o" or "Inhaber" name in Invoice Sender Address
-- Date: 2026-02-15

-- Add sender_contact_name field to companies table
-- This field allows specifying a contact person or owner name that appears on invoices
-- Example: "c/o Hans Muster" or just "Hans Muster" above the company name

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS sender_contact_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN companies.sender_contact_name IS
  'Optional contact/owner name to display on invoices (e.g., "c/o Hans Muster" or "Inhaber: Hans Muster"). If set, appears above company name on PDF invoices.';

-- No default value needed - NULL means only company name is shown (current behavior)
