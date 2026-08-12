-- Migration: Add expense_accounts for chart of accounts (Kontenplan)
-- Phase 3.8 - Buchungen Upgrade

-- Create expense_accounts table (flat structure)
CREATE TABLE IF NOT EXISTS expense_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, name)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_expense_accounts_company ON expense_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_expense_accounts_active ON expense_accounts(company_id, is_active);

-- Enable RLS
ALTER TABLE expense_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policy using table-based approach (no session variables)
CREATE POLICY "Tenant Isolation" ON expense_accounts
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

-- Insert default expense accounts for existing companies
INSERT INTO expense_accounts (company_id, name, sort_order)
SELECT c.id, accounts.name, accounts.sort_order
FROM companies c
CROSS JOIN (
  VALUES
    ('Materialaufwand', 1),
    ('Personalkosten', 2),
    ('Miete', 3),
    ('Marketing', 4),
    ('Bueromaterial', 5),
    ('Reisekosten', 6),
    ('Versicherungen', 7),
    ('Abschreibungen', 8),
    ('Sonstige', 99)
) AS accounts(name, sort_order)
ON CONFLICT (company_id, name) DO NOTHING;

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_expense_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER expense_accounts_updated_at
  BEFORE UPDATE ON expense_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_expense_accounts_updated_at();

-- Add comment
COMMENT ON TABLE expense_accounts IS 'Chart of accounts for expense categories (Kontenplan)';
