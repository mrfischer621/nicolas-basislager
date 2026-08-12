-- =====================================================================
-- MULTI-COMPANY SUPPORT - STEP 2: Data Migration
-- =====================================================================
-- Migration: 20260128_multi_company_step2_data_migration.sql
-- Purpose: Migrate existing user-company mappings from profiles to user_companies
-- Date: 2026-01-28
--
-- OVERVIEW:
-- This is STEP 2 of 4 in the multi-company migration.
-- Copies all existing user-company relationships into the junction table.
--
-- CHANGES:
-- - Migrates all profiles.company_id to user_companies
-- - Sets all existing users as 'admin' role (they own their current company)
-- - Verifies data integrity after migration
--
-- PREREQUISITES:
-- - Step 1 migration must be completed (user_companies table exists)
-- - profiles table still has company_id column
--
-- NEXT STEPS:
-- - Step 3: Modify profiles table
-- - Step 4: Update get_user_company_id() function
-- =====================================================================


-- =====================================================================
-- SECTION 1: PRE-MIGRATION VERIFICATION
-- =====================================================================

-- Verify user_companies table exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'user_companies'
    ) THEN
        RAISE EXCEPTION 'user_companies table does not exist. Run Step 1 migration first.';
    END IF;
END $$;

-- Verify profiles table still has company_id column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'company_id'
    ) THEN
        RAISE EXCEPTION 'profiles.company_id column not found. Migration may have already been applied.';
    END IF;
END $$;


-- =====================================================================
-- SECTION 2: DATA MIGRATION
-- =====================================================================

-- Migrate all existing user-company relationships
-- All existing users get 'admin' role for their current company
INSERT INTO public.user_companies (user_id, company_id, role, created_at)
SELECT
    id AS user_id,
    company_id,
    'admin' AS role,  -- All existing users become admins of their company
    created_at
FROM public.profiles
WHERE company_id IS NOT NULL  -- Skip any profiles without company assignment
ON CONFLICT (user_id, company_id) DO NOTHING;  -- Skip if already migrated

-- Log migration results
DO $$
DECLARE
    migrated_count INTEGER;
    profiles_count INTEGER;
BEGIN
    -- Count migrated records
    SELECT COUNT(*) INTO migrated_count FROM public.user_companies;

    -- Count total profiles with company_id
    SELECT COUNT(*) INTO profiles_count
    FROM public.profiles
    WHERE company_id IS NOT NULL;

    RAISE NOTICE 'Migration completed: % user-company relationships migrated', migrated_count;
    RAISE NOTICE 'Total profiles with company_id: %', profiles_count;

    -- Verify counts match
    IF migrated_count != profiles_count THEN
        RAISE WARNING 'Count mismatch: user_companies (%) != profiles with company_id (%)',
            migrated_count, profiles_count;
    END IF;
END $$;


-- =====================================================================
-- SECTION 3: POST-MIGRATION VERIFICATION
-- =====================================================================

-- Verify all profiles have corresponding user_companies entry
DO $$
DECLARE
    missing_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO missing_count
    FROM public.profiles p
    WHERE p.company_id IS NOT NULL
        AND NOT EXISTS (
            SELECT 1
            FROM public.user_companies uc
            WHERE uc.user_id = p.id
                AND uc.company_id = p.company_id
        );

    IF missing_count > 0 THEN
        RAISE EXCEPTION 'Migration incomplete: % profiles missing from user_companies', missing_count;
    END IF;

    RAISE NOTICE 'Verification passed: All profiles have user_companies entries';
END $$;


-- Verify no duplicate entries were created
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT user_id, company_id, COUNT(*)
        FROM public.user_companies
        GROUP BY user_id, company_id
        HAVING COUNT(*) > 1
    ) duplicates;

    IF duplicate_count > 0 THEN
        RAISE EXCEPTION 'Data integrity error: % duplicate user-company entries found', duplicate_count;
    END IF;

    RAISE NOTICE 'Verification passed: No duplicate entries';
END $$;


-- Verify all migrated users have 'admin' role
DO $$
DECLARE
    non_admin_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO non_admin_count
    FROM public.user_companies
    WHERE role != 'admin';

    IF non_admin_count > 0 THEN
        RAISE WARNING '% user-company entries have non-admin roles (expected all admin)', non_admin_count;
    END IF;

    RAISE NOTICE 'Role verification: All migrated users have admin role';
END $$;


-- =====================================================================
-- SECTION 4: VERIFICATION QUERIES
-- =====================================================================

/*
-- View migration results
SELECT
    uc.user_id,
    p.email,
    p.full_name,
    c.name AS company_name,
    uc.role,
    uc.created_at
FROM public.user_companies uc
JOIN public.profiles p ON uc.user_id = p.id
JOIN public.companies c ON uc.company_id = c.id
ORDER BY uc.created_at DESC;

-- Compare counts
SELECT
    (SELECT COUNT(*) FROM public.profiles WHERE company_id IS NOT NULL) AS profiles_with_company,
    (SELECT COUNT(*) FROM public.user_companies) AS user_companies_entries,
    (SELECT COUNT(*) FROM public.user_companies WHERE role = 'admin') AS admin_users;

-- Check for profiles without user_companies entry (should be 0)
SELECT
    p.id,
    p.email,
    p.company_id
FROM public.profiles p
WHERE p.company_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM public.user_companies uc
        WHERE uc.user_id = p.id
    );

-- Expected: No rows (all profiles migrated)
*/


-- =====================================================================
-- SECTION 5: ROLLBACK INSTRUCTIONS
-- =====================================================================

-- If you need to rollback this migration (before Step 3):
--
-- DELETE FROM public.user_companies;
--
-- WARNING: This will remove all user-company relationships!
-- Only run this if Step 3 has NOT been applied yet (profiles.company_id still exists)


-- =====================================================================
-- SECTION 6: POST-MIGRATION NOTES
-- =====================================================================

-- IMPORTANT: At this point:
-- - user_companies table is now populated
-- - profiles table STILL has company_id column (unchanged)
-- - get_user_company_id() still uses profiles.company_id
-- - Application continues to work as before
--
-- Next steps:
-- 1. Verify migration was successful (run verification queries above)
-- 2. Test with multiple users to ensure data integrity
-- 3. Run Step 3 to modify profiles table
-- 4. Run Step 4 to update get_user_company_id() function
-- 5. Update frontend code to support company switching
--
-- DO NOT proceed to Step 3 until you have verified this migration!


-- =====================================================================
-- END OF STEP 2 MIGRATION
-- =====================================================================
