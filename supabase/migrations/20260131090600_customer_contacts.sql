-- Migration: Customer Contacts Module
-- Phase 5.2: Kundenübersicht - Kontakte-Submodul

-- Create customer_contacts table
CREATE TABLE IF NOT EXISTS customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text, -- z.B. "Geschäftsführer", "Buchhaltung"
  email text,
  phone text,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer_id ON customer_contacts(customer_id);

-- RLS: Tenant Isolation via Parent (customers table)
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Isolation via Customer" ON customer_contacts
  FOR ALL
  USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    customer_id IN (
      SELECT id FROM customers
      WHERE company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
      )
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_customer_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customer_contacts_updated_at
  BEFORE UPDATE ON customer_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_contacts_updated_at();

-- Comments
COMMENT ON TABLE customer_contacts IS 'Contact persons for customers';
COMMENT ON COLUMN customer_contacts.is_primary IS 'Primary contact for this customer';
COMMENT ON COLUMN customer_contacts.role IS 'Role/position of the contact (e.g., CEO, Accounting)';
