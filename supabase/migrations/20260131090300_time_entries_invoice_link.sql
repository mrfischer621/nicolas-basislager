-- Migration: Add invoice_id and billable columns to time_entries
-- Phase 3.4: Zeiterfassungs-Import in Rechnungen
-- Date: 2026-01-31

-- Add invoice_id column to link time entries to invoices
ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL;

-- Add billable column to mark entries as billable/non-billable
-- Default is true (verrechenbar)
ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS billable boolean NOT NULL DEFAULT true;

-- Create index for faster lookups of open (not invoiced) time entries
CREATE INDEX IF NOT EXISTS idx_time_entries_invoice_id
  ON time_entries(invoice_id)
  WHERE invoice_id IS NULL;

-- Create index for billable filter
CREATE INDEX IF NOT EXISTS idx_time_entries_billable
  ON time_entries(billable)
  WHERE billable = true;

-- Combined index for the typical query pattern: billable=true AND invoice_id IS NULL
CREATE INDEX IF NOT EXISTS idx_time_entries_open_billable
  ON time_entries(company_id, billable, invoice_id)
  WHERE billable = true AND invoice_id IS NULL;

-- Comment on columns
COMMENT ON COLUMN time_entries.invoice_id IS 'Reference to the invoice that includes this time entry (NULL if not yet invoiced)';
COMMENT ON COLUMN time_entries.billable IS 'Whether this time entry is billable to the customer (true = verrechenbar)';
