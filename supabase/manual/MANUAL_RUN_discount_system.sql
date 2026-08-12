-- ============================================================================
-- DISCOUNT SYSTEM - Safe Manual Migration
-- WICHTIG: Führen Sie dieses SQL im Supabase Dashboard aus
-- ============================================================================

-- Add discount columns to invoices (if not exists)
DO $$
BEGIN
    -- Add discount_type column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'discount_type'
    ) THEN
        ALTER TABLE invoices
        ADD COLUMN discount_type text DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed'));

        RAISE NOTICE 'Column invoices.discount_type created';
    ELSE
        RAISE NOTICE 'Column invoices.discount_type already exists';
    END IF;

    -- Add discount_value column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'discount_value'
    ) THEN
        ALTER TABLE invoices
        ADD COLUMN discount_value numeric(10, 2) DEFAULT 0 CHECK (discount_value >= 0);

        RAISE NOTICE 'Column invoices.discount_value created';
    ELSE
        RAISE NOTICE 'Column invoices.discount_value already exists';
    END IF;

    -- Add comments
    COMMENT ON COLUMN invoices.discount_type IS 'Discount type: percent (%) or fixed (CHF)';
    COMMENT ON COLUMN invoices.discount_value IS 'Discount value (percentage or fixed amount in CHF)';
END $$;

-- Add discount columns to quotes (if not exists)
DO $$
BEGIN
    -- Add discount_type column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'quotes' AND column_name = 'discount_type'
    ) THEN
        ALTER TABLE quotes
        ADD COLUMN discount_type text DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed'));

        RAISE NOTICE 'Column quotes.discount_type created';
    ELSE
        RAISE NOTICE 'Column quotes.discount_type already exists';
    END IF;

    -- Add discount_value column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'quotes' AND column_name = 'discount_value'
    ) THEN
        ALTER TABLE quotes
        ADD COLUMN discount_value numeric(10, 2) DEFAULT 0 CHECK (discount_value >= 0);

        RAISE NOTICE 'Column quotes.discount_value created';
    ELSE
        RAISE NOTICE 'Column quotes.discount_value already exists';
    END IF;

    -- Add comments
    COMMENT ON COLUMN quotes.discount_type IS 'Discount type: percent (%) or fixed (CHF)';
    COMMENT ON COLUMN quotes.discount_value IS 'Discount value (percentage or fixed amount in CHF)';
END $$;

-- Verify migration
SELECT
    'invoices' as table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'invoices'
  AND column_name IN ('discount_type', 'discount_value')
UNION ALL
SELECT
    'quotes' as table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'quotes'
  AND column_name IN ('discount_type', 'discount_value')
ORDER BY table_name, column_name;
