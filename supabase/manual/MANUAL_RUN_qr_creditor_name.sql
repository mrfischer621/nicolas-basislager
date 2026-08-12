-- ============================================================================
-- QR CREDITOR NAME - Safe Manual Migration
-- WICHTIG: Führen Sie dieses SQL im Supabase Dashboard aus
-- ============================================================================

-- Add qr_creditor_name column to companies (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'companies' AND column_name = 'qr_creditor_name'
    ) THEN
        ALTER TABLE companies
        ADD COLUMN qr_creditor_name TEXT;

        COMMENT ON COLUMN companies.qr_creditor_name IS 'Name that appears as creditor in Swiss QR-Bill (e.g., "Nicolas Fischer"). If empty, falls back to company name.';

        RAISE NOTICE 'Column companies.qr_creditor_name created';
    ELSE
        RAISE NOTICE 'Column companies.qr_creditor_name already exists';
    END IF;
END $$;

-- Verify migration
SELECT
    'companies' as table_name,
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'companies'
  AND column_name = 'qr_creditor_name';
