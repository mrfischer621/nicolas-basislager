-- Phase 3.2: Update get_user_companies RPC to include product_categories
-- This ensures the CompanyContext loads the new field
-- IMPORTANT: Removes is_active from return (column doesn't exist in user_companies)

-- Drop existing function first (return type changed)
DROP FUNCTION IF EXISTS get_user_companies();

-- Create new version with updated return type
CREATE FUNCTION get_user_companies()
RETURNS TABLE (
  company_id UUID,
  company_name TEXT,
  role TEXT,
  logo_url TEXT,
  street TEXT,
  house_number TEXT,
  zip_code TEXT,
  city TEXT,
  iban TEXT,
  qr_iban TEXT,
  qr_creditor_name TEXT,
  bank_name TEXT,
  uid_number TEXT,
  vat_number TEXT,
  vat_registered BOOLEAN,
  vat_enabled BOOLEAN,
  default_vat_rate NUMERIC,
  alternativ_name TEXT,
  rechnungsname TEXT,
  sender_contact_name TEXT,
  product_categories JSONB,
  invoice_intro_text TEXT,
  invoice_footer_text TEXT,
  quote_intro_text TEXT,
  quote_footer_text TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS company_id,
    c.name AS company_name,
    uc.role::TEXT,
    c.logo_url,
    c.street,
    c.house_number,
    c.zip_code,
    c.city,
    c.iban,
    c.qr_iban,
    c.qr_creditor_name,
    c.bank_name,
    c.uid_number,
    c.vat_number,
    c.vat_registered,
    c.vat_enabled,
    c.default_vat_rate,
    c.alternativ_name,
    c.rechnungsname,
    c.sender_contact_name,
    COALESCE(c.product_categories, '[]'::jsonb) AS product_categories,
    c.invoice_intro_text,
    c.invoice_footer_text,
    c.quote_intro_text,
    c.quote_footer_text,
    c.created_at
  FROM user_companies uc
  INNER JOIN companies c ON c.id = uc.company_id
  WHERE uc.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_companies() IS 'Returns all companies accessible by the current user with full company data including product_categories';
