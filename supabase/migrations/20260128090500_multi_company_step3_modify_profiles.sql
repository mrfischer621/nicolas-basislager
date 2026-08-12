-- =====================================================================
-- MULTI-COMPANY SUPPORT - STEP 3: Modify Profiles Table
-- =====================================================================
-- Migration: 20260128_multi_company_step3_modify_profiles.sql
-- Purpose: Remove company_id, add last_active_company_id, update triggers
-- Date: 2026-01-28
--
-- OVERVIEW:
-- This is STEP 3 of 4 in the multi-company migration.
-- Modifies the profiles table structure for multi-company support.
--
-- CHANGES:
-- - Adds last_active_company_id column (nullable, references companies)
-- - Sets initial last_active_company_id from current company_id
-- - Removes company_id column (data already migrated to user_companies)
-- - Updates trigger to remove company_id protection (no longer exists)
-- - Updates role protection (role is now in user_companies, not profiles)
--
-- PREREQUISITES:
-- - Step 1: user_companies table exists
-- - Step 2: Data migrated from profiles.company_id to user_companies
-- - Verification: All profiles have corresponding user_companies entries
--
-- WARNING: This is a BREAKING CHANGE!
-- After this migration:
-- - profiles.company_id will NO LONGER EXIST
-- - get_user_company_id() will break until Step 4 is completed
-- - Ensure you can complete all 4 steps without interruption
--
-- NEXT STEPS:
-- - Step 4: Update get_user_company_id() function
-- =====================================================================


-- =====================================================================
-- SECTION 1: PRE-MIGRATION VERIFICATION
-- =====================================================================

-- Verify user_companies table exists and has data
DO $$
DECLARE
    uc_count INTEGER;
BEGIN
    -- Check table exists
    IF NOT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'user_companies'
    ) THEN
        RAISE EXCEPTION 'user_companies table does not exist. Run Step 1 migration first.';
    END IF;

    -- Check table has data
    SELECT COUNT(*) INTO uc_count FROM public.user_companies;
    IF uc_count = 0 THEN
        RAISE EXCEPTION 'user_companies table is empty. Run Step 2 migration first.';
    END IF;

    RAISE NOTICE 'Pre-check passed: user_companies has % entries', uc_count;
END $$;


-- Verify profiles.company_id column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'company_id'
    ) THEN
        RAISE EXCEPTION 'profiles.company_id not found. Step 3 may have already been applied.';
    END IF;

    RAISE NOTICE 'Pre-check passed: profiles.company_id exists';
END $$;


-- =====================================================================
-- SECTION 2: ADD last_active_company_id COLUMN
-- =====================================================================

-- Add new column (nullable, will be populated before company_id is removed)
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS last_active_company_id UUID
    REFERENCES public.companies(id) ON DELETE SET NULL;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_last_active_company
    ON public.profiles(last_active_company_id);

-- Add column documentation
COMMENT ON COLUMN public.profiles.last_active_company_id IS
'The last company the user was working with. Used to restore context on login. NULL if user has no companies.';

RAISE NOTICE 'Added last_active_company_id column';


-- =====================================================================
-- SECTION 3: POPULATE last_active_company_id
-- =====================================================================

-- Set last_active_company_id to current company_id before removing it
-- This preserves user context across the migration
UPDATE public.profiles
SET last_active_company_id = company_id
WHERE company_id IS NOT NULL;

-- Log results
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM public.profiles
    WHERE last_active_company_id IS NOT NULL;

    RAISE NOTICE 'Populated last_active_company_id for % profiles', updated_count;
END $$;


-- =====================================================================
-- SECTION 4: UPDATE SECURITY TRIGGER
-- =====================================================================

-- Drop the old trigger that protected company_id and role
DROP TRIGGER IF EXISTS enforce_immutable_profile_fields ON public.profiles;
DROP FUNCTION IF EXISTS prevent_profile_privilege_escalation();

RAISE NOTICE 'Removed old security trigger (company_id/role protection)';

-- Note: Role is now in user_companies table, not profiles
-- No new trigger needed for profiles table
-- Role protection is handled by user_companies RLS policies and triggers


-- =====================================================================
-- SECTION 5: REMOVE role COLUMN FROM PROFILES
-- =====================================================================

-- Role is now managed in user_companies table
-- Remove it from profiles to avoid confusion
ALTER TABLE public.profiles
    DROP COLUMN IF EXISTS role;

RAISE NOTICE 'Removed role column from profiles (now in user_companies)';


-- =====================================================================
-- SECTION 6: REMOVE company_id COLUMN
-- =====================================================================

-- This is the point of no return!
-- Ensure all data is safely in user_companies before proceeding

-- Final verification before dropping
DO $$
DECLARE
    profiles_with_company INTEGER;
    user_companies_count INTEGER;
BEGIN
    -- Count profiles with company_id
    SELECT COUNT(*) INTO profiles_with_company
    FROM public.profiles
    WHERE company_id IS NOT NULL;

    -- Count user_companies entries
    SELECT COUNT(*) INTO user_companies_count
    FROM public.user_companies;

    -- Verify counts match (or user_companies has more, if multi-company users exist)
    IF user_companies_count < profiles_with_company THEN
        RAISE EXCEPTION 'Data loss risk: user_companies (%) < profiles with company_id (%). Aborting!',
            user_companies_count, profiles_with_company;
    END IF;

    RAISE NOTICE 'Safety check passed: user_companies (%) >= profiles with company (%) ',
        user_companies_count, profiles_with_company;
END $$;

-- Drop the company_id column
ALTER TABLE public.profiles
    DROP COLUMN IF EXISTS company_id;

RAISE NOTICE 'Removed company_id column from profiles';

-- Update table documentation
COMMENT ON TABLE public.profiles IS
'User profiles linked to auth.users. Users can belong to multiple companies via user_companies junction table.';


-- =====================================================================
-- SECTION 7: UPDATE RLS POLICIES (if needed)
-- =====================================================================

-- Profiles RLS policies should still work (they use auth.uid(), not company_id)
-- No changes needed here


-- =====================================================================
-- SECTION 8: POST-MIGRATION VERIFICATION
-- =====================================================================

-- Verify company_id column is gone
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'company_id'
    ) THEN
        RAISE EXCEPTION 'Migration failed: company_id column still exists!';
    END IF;

    RAISE NOTICE 'Verification passed: company_id column removed';
END $$;


-- Verify last_active_company_id column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'last_active_company_id'
    ) THEN
        RAISE EXCEPTION 'Migration failed: last_active_company_id column not found!';
    END IF;

    RAISE NOTICE 'Verification passed: last_active_company_id column exists';
END $$;


-- Verify role column is gone
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'role'
    ) THEN
        RAISE EXCEPTION 'Migration failed: role column still exists!';
    END IF;

    RAISE NOTICE 'Verification passed: role column removed';
END $$;


-- Check profiles structure
DO $$
DECLARE
    profiles_with_last_active INTEGER;
BEGIN
    SELECT COUNT(*) INTO profiles_with_last_active
    FROM public.profiles
    WHERE last_active_company_id IS NOT NULL;

    RAISE NOTICE 'Profiles with last_active_company_id set: %', profiles_with_last_active;
END $$;


-- =====================================================================
-- SECTION 9: VERIFICATION QUERIES
-- =====================================================================

/*
-- View updated profiles structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Expected columns:
-- - id (uuid, not null)
-- - email (text, not null)
-- - full_name (text, nullable)
-- - last_active_company_id (uuid, nullable)
-- - created_at (timestamptz, not null)
-- - updated_at (timestamptz, not null)
-- NO company_id, NO role


-- View user-company relationships
SELECT
    p.id,
    p.email,
    p.full_name,
    p.last_active_company_id,
    c_active.name AS last_active_company_name,
    COUNT(uc.company_id) AS total_companies
FROM public.profiles p
LEFT JOIN public.user_companies uc ON p.id = uc.user_id
LEFT JOIN public.companies c_active ON p.last_active_company_id = c_active.id
GROUP BY p.id, p.email, p.full_name, p.last_active_company_id, c_active.name
ORDER BY p.email;


-- Check for profiles without any company (should be rare/none)
SELECT
    p.id,
    p.email,
    p.last_active_company_id
FROM public.profiles p
WHERE NOT EXISTS (
    SELECT 1
    FROM public.user_companies uc
    WHERE uc.user_id = p.id
);

-- Expected: No rows (all users should have at least one company)
*/


-- =====================================================================
-- SECTION 10: ROLLBACK INSTRUCTIONS
-- =====================================================================

-- WARNING: Rollback is COMPLEX after this step!
--
-- If you need to rollback (restore company_id column):
--
-- 1. Add company_id column back:
--    ALTER TABLE public.profiles
--        ADD COLUMN company_id UUID REFERENCES public.companies(id);
--
-- 2. Restore data from user_companies:
--    UPDATE public.profiles p
--    SET company_id = uc.company_id
--    FROM public.user_companies uc
--    WHERE p.id = uc.user_id
--    LIMIT 1;  -- Use first company if user has multiple
--
-- 3. Restore role column:
--    ALTER TABLE public.profiles ADD COLUMN role TEXT;
--    UPDATE public.profiles p
--    SET role = uc.role
--    FROM public.user_companies uc
--    WHERE p.id = uc.user_id AND p.company_id = uc.company_id;
--
-- 4. Recreate security trigger (see 20260123_critical_security_fixes.sql)
--
-- BETTER APPROACH: Test thoroughly before running Step 3!


-- =====================================================================
-- SECTION 11: POST-MIGRATION NOTES
-- =====================================================================

-- CRITICAL: At this point:
-- - profiles.company_id NO LONGER EXISTS
-- - profiles.role NO LONGER EXISTS
-- - profiles.last_active_company_id is populated
-- - user_companies table has all user-company-role relationships
-- - get_user_company_id() function is BROKEN (still references old company_id)
--
-- NEXT STEPS (MUST BE COMPLETED IMMEDIATELY):
-- 1. Run Step 4 migration to update get_user_company_id()
-- 2. Test database queries with new structure
-- 3. Update frontend code:
--    - CompanyContext: Fetch companies from user_companies
--    - CompanyContext: Store selectedCompany in state
--    - Update last_active_company_id when user switches companies
--    - Remove company_id/role from Profile interface
--
-- DO NOT deploy this migration to production without Step 4!
-- The application WILL BREAK until get_user_company_id() is updated!


-- =====================================================================
-- END OF STEP 3 MIGRATION
-- =====================================================================
