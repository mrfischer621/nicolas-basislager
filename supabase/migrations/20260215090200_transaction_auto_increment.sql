-- Migration: Auto-Increment Transaction Numbers per Company
-- Roadmap v5 Phase 3.4: Replace random string generation with proper sequence
-- Date: 2026-02-15

-- Function to generate next transaction number for a company
-- Format: E001, E002, ... for Einnahmen (income)
--         A001, A002, ... for Ausgaben (expenses)
CREATE OR REPLACE FUNCTION generate_transaction_number(
  p_company_id UUID,
  p_type TEXT
) RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_max_number INTEGER;
  v_next_number TEXT;
BEGIN
  -- Determine prefix based on type
  v_prefix := CASE
    WHEN p_type = 'einnahme' THEN 'E'
    WHEN p_type = 'ausgabe' THEN 'A'
    ELSE 'T' -- Fallback
  END;

  -- Find the highest number for this company and type
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(transaction_number FROM '[0-9]+$') AS INTEGER
      )
    ),
    0
  )
  INTO v_max_number
  FROM transactions
  WHERE
    company_id = p_company_id
    AND transaction_number ~ ('^' || v_prefix || '[0-9]+$');

  -- Generate next number with padding (e.g., E001, E002, ...)
  v_next_number := v_prefix || LPAD((v_max_number + 1)::TEXT, 3, '0');

  RETURN v_next_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to auto-generate transaction_number if not provided
CREATE OR REPLACE FUNCTION auto_generate_transaction_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if transaction_number is NULL or empty
  IF NEW.transaction_number IS NULL OR NEW.transaction_number = '' THEN
    NEW.transaction_number := generate_transaction_number(NEW.company_id, NEW.type);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on transactions table
DROP TRIGGER IF EXISTS trigger_auto_transaction_number ON transactions;

CREATE TRIGGER trigger_auto_transaction_number
  BEFORE INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_transaction_number();

-- Comment for documentation
COMMENT ON FUNCTION generate_transaction_number(UUID, TEXT) IS
  'Generates auto-incrementing transaction numbers per company and type (E001, A001, etc.)';

COMMENT ON FUNCTION auto_generate_transaction_number() IS
  'Trigger function that auto-generates transaction_number on INSERT if not provided';
