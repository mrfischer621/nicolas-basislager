-- Migration: Add QR creditor name field for personalized QR-Bills
-- Use case: Freelancers/Einzelunternehmer who want personal name in QR code
-- Date: 2026-02-15

-- Add qr_creditor_name to companies table
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS qr_creditor_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN companies.qr_creditor_name IS 'Name that appears as creditor in Swiss QR-Bill (e.g., "Nicolas Fischer"). If empty, falls back to company name.';

-- Example: Company name = "Fischer Digital", QR creditor = "Nicolas Fischer"
-- This allows the invoice header to show the company brand while payments go directly to the person.
