-- Migration: Add text template columns to companies table
-- Phase 3.6: Textvorlagen & Templates

-- Add template columns for invoices and quotes
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS invoice_intro_text TEXT,
ADD COLUMN IF NOT EXISTS invoice_footer_text TEXT,
ADD COLUMN IF NOT EXISTS quote_intro_text TEXT,
ADD COLUMN IF NOT EXISTS quote_footer_text TEXT;

-- Add comments for documentation
COMMENT ON COLUMN companies.invoice_intro_text IS 'Custom intro text displayed above invoice items';
COMMENT ON COLUMN companies.invoice_footer_text IS 'Custom footer text displayed below invoice items';
COMMENT ON COLUMN companies.quote_intro_text IS 'Custom intro text displayed above quote items';
COMMENT ON COLUMN companies.quote_footer_text IS 'Custom footer text displayed below quote items';
