-- Migration: Add transaction_attachments for receipt uploads
-- Phase 3.8 - Buchungen Upgrade

-- Create transaction_attachments table
CREATE TABLE IF NOT EXISTS transaction_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES transactions(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL, -- application/pdf, image/jpeg, image/png
  file_size int, -- Bytes
  file_url text NOT NULL, -- Supabase Storage URL
  uploaded_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transaction_attachments_transaction ON transaction_attachments(transaction_id);

-- Enable RLS
ALTER TABLE transaction_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policy via parent table (transactions -> company_id)
CREATE POLICY "Tenant Isolation via Transaction" ON transaction_attachments
  FOR ALL
  USING (
    transaction_id IN (
      SELECT t.id FROM transactions t
      WHERE t.company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    transaction_id IN (
      SELECT t.id FROM transactions t
      WHERE t.company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
      )
    )
  );

-- Add comment
COMMENT ON TABLE transaction_attachments IS 'File attachments (receipts/invoices) for transactions';
COMMENT ON COLUMN transaction_attachments.file_type IS 'MIME type: application/pdf, image/jpeg, image/png';
COMMENT ON COLUMN transaction_attachments.file_url IS 'Supabase Storage URL path';

-- NOTE: Supabase Storage bucket must be created manually:
-- Bucket name: "transaction-receipts"
-- Public: false (authenticated access only)
-- Allowed MIME types: application/pdf, image/jpeg, image/png
-- Max file size: 10MB
