-- =====================================================================
-- MULTI-COMPANY SUPPORT - STEP 4: Update get_user_company_id()
-- =====================================================================
-- Migration: 20260128_multi_company_step4_update_function.sql
-- Purpose: Update get_user_company_id() to use session-based company selection
-- Date: 2026-01-28
--
-- OVERVIEW:
-- This is STEP 4 of 4 in the multi-company migration.
-- Updates the get_user_company_id() function to work with multi-company structure.
--
-- CHANGES:
-- - Recreates get_user_company_id() to use session variable
-- - Session variable 'app.current_company_id' holds active company
-- - Falls back to last_active_company_id if session not set
-- - Validates user has access to selected company (security)
--
-- PREREQUISITES:
-- - Step 1: user_companies table exists
-- - Step 2: Data migrated to user_companies
-- - Step 3: profiles.company_id removed, last_active_company_id added
--
-- HOW IT WORKS:
-- 1. Frontend sets session variable when user selects company:
--    await supabase.rpc('set_active_company', { company_id: 'uuid' })
--
-- 2. get_user_company_id() reads from session variable
--
-- 3. RLS policies remain unchanged (still call get_user_company_id())
--
-- NEXT STEPS:
-- - Update frontend CompanyContext to set session variable
-- - Test multi-company switching
-- =====================================================================


-- =====================================================================
-- SECTION 1: CREATE HELPER FUNCTION TO SET ACTIVE COMPANY
-- =====================================================================

-- Function to set the current active company in the session
-- This is called by the frontend when user switches companies
CREATE OR REPLACE FUNCTION public.set_active_company(company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify user has access to this company
    IF NOT EXISTS (
        SELECT 1
        FROM public.user_companies
        WHERE user_id = auth.uid()
            AND user_companies.company_id = set_active_company.company_id
    ) THEN
        RAISE EXCEPTION 'Access denied: User does not belong to company %', company_id
            USING ERRCODE = '42501';  -- insufficient_privilege
    END IF;

    -- Set session variable
    PERFORM set_config('app.current_company_id', company_id::TEXT, false);

    -- Update last_active_company_id in profiles for persistence
    UPDATE public.profiles
    SET last_active_company_id = set_active_company.company_id
    WHERE id = auth.uid();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.set_active_company(UUID) TO authenticated;

-- Add documentation
COMMENT ON FUNCTION public.set_active_company(UUID) IS
'Sets the active company for the current session. Validates user has access. Updates last_active_company_id for persistence.
Usage: SELECT set_active_company(''company-uuid'');';

RAISE NOTICE 'Created set_active_company() function';


-- =====================================================================
-- SECTION 2: UPDATE get_user_company_id() FUNCTION
-- =====================================================================

-- Recreate function to use session variable with fallback
-- This maintains backwards compatibility while enabling multi-company
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    company_id_value UUID;
    session_company_id TEXT;
    user_has_access BOOLEAN;
BEGIN
    -- Try to get company from session variable first
    BEGIN
        session_company_id := current_setting('app.current_company_id', true);
    EXCEPTION
        WHEN OTHERS THEN
            session_company_id := NULL;
    END;

    -- If session variable is set, validate and use it
    IF session_company_id IS NOT NULL AND session_company_id != '' THEN
        company_id_value := session_company_id::UUID;

        -- Security: Verify user has access to this company
        SELECT EXISTS (
            SELECT 1
            FROM public.user_companies
            WHERE user_id = auth.uid()
                AND user_companies.company_id = company_id_value
        ) INTO user_has_access;

        IF user_has_access THEN
            RETURN company_id_value;
        END IF;

        -- If no access, fall through to default behavior
        RAISE WARNING 'User % attempted to access unauthorized company %',
            auth.uid(), company_id_value;
    END IF;

    -- Fallback: Use last_active_company_id from profile
    SELECT last_active_company_id INTO company_id_value
    FROM public.profiles
    WHERE id = auth.uid();

    -- If last_active is set and user has access, use it
    IF company_id_value IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.user_companies
            WHERE user_id = auth.uid()
                AND user_companies.company_id = company_id_value
        ) INTO user_has_access;

        IF user_has_access THEN
            RETURN company_id_value;
        END IF;
    END IF;

    -- Final fallback: Use first available company
    SELECT uc.company_id INTO company_id_value
    FROM public.user_companies uc
    WHERE uc.user_id = auth.uid()
    ORDER BY uc.created_at ASC
    LIMIT 1;

    RETURN company_id_value;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated;

-- Update documentation
COMMENT ON FUNCTION public.get_user_company_id() IS
'Returns the active company_id for the current user. Priority:
1. Session variable (app.current_company_id) - set via set_active_company()
2. last_active_company_id from profiles
3. First company in user_companies (fallback)
Used in RLS policies for multi-tenant isolation. Validates user has access to returned company.';

RAISE NOTICE 'Updated get_user_company_id() function';


-- =====================================================================
-- SECTION 3: CREATE HELPER FUNCTION TO GET ALL USER COMPANIES
-- =====================================================================

-- Function to get all companies a user has access to
-- Useful for frontend company switcher dropdown
CREATE OR REPLACE FUNCTION public.get_user_companies()
RETURNS TABLE (
    company_id UUID,
    company_name TEXT,
    role TEXT,
    is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    active_company_id UUID;
BEGIN
    -- Get current active company
    active_company_id := public.get_user_company_id();

    RETURN QUERY
    SELECT
        c.id AS company_id,
        c.name AS company_name,
        uc.role,
        (c.id = active_company_id) AS is_active
    FROM public.user_companies uc
    JOIN public.companies c ON uc.company_id = c.id
    WHERE uc.user_id = auth.uid()
    ORDER BY (c.id = active_company_id) DESC, c.name ASC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_companies() TO authenticated;

-- Add documentation
COMMENT ON FUNCTION public.get_user_companies() IS
'Returns all companies the current user has access to, with their role and active status.
Usage: SELECT * FROM get_user_companies();';

RAISE NOTICE 'Created get_user_companies() function';


-- =====================================================================
-- SECTION 4: POST-MIGRATION VERIFICATION
-- =====================================================================

-- Verify get_user_company_id function exists and has correct structure
DO $$
DECLARE
    func_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO func_count
    FROM pg_proc
    WHERE proname = 'get_user_company_id'
        AND pronamespace = 'public'::regnamespace;

    IF func_count = 0 THEN
        RAISE EXCEPTION 'get_user_company_id() function not found!';
    END IF;

    RAISE NOTICE 'Verification passed: get_user_company_id() exists';
END $$;


-- Verify set_active_company function exists
DO $$
DECLARE
    func_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO func_count
    FROM pg_proc
    WHERE proname = 'set_active_company'
        AND pronamespace = 'public'::regnamespace;

    IF func_count = 0 THEN
        RAISE EXCEPTION 'set_active_company() function not found!';
    END IF;

    RAISE NOTICE 'Verification passed: set_active_company() exists';
END $$;


-- Verify get_user_companies function exists
DO $$
DECLARE
    func_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO func_count
    FROM pg_proc
    WHERE proname = 'get_user_companies'
        AND pronamespace = 'public'::regnamespace;

    IF func_count = 0 THEN
        RAISE EXCEPTION 'get_user_companies() function not found!';
    END IF;

    RAISE NOTICE 'Verification passed: get_user_companies() exists';
END $$;


-- =====================================================================
-- SECTION 5: TESTING QUERIES
-- =====================================================================

/*
-- Test get_user_company_id() (run as authenticated user)
-- Should return your last_active_company_id or first company
SELECT get_user_company_id();


-- Test get_user_companies() (run as authenticated user)
-- Should show all your companies with roles
SELECT * FROM get_user_companies();


-- Test set_active_company() (run as authenticated user)
-- Replace 'your-company-uuid' with actual company ID
SELECT set_active_company('your-company-uuid');


-- Verify session variable is set
SELECT current_setting('app.current_company_id', true);


-- Test that get_user_company_id() now returns the new company
SELECT get_user_company_id();


-- Test RLS policies still work
-- Should only return data for active company
SELECT * FROM customers LIMIT 10;


-- Test switching to invalid company (should fail)
SELECT set_active_company('00000000-0000-0000-0000-000000000000');
-- Expected: ERROR "Access denied: User does not belong to company"
*/


-- =====================================================================
-- SECTION 6: FRONTEND INTEGRATION GUIDE
-- =====================================================================

/*
FRONTEND IMPLEMENTATION (CompanyContext.tsx):

1. Fetch user's companies on login:
   const { data: companies } = await supabase.rpc('get_user_companies');

2. Set active company when user switches:
   const switchCompany = async (companyId: string) => {
     await supabase.rpc('set_active_company', { company_id: companyId });
     window.location.reload();  // Reload to refresh all data
   };

3. Get current active company:
   const { data: activeCompanyId } = await supabase.rpc('get_user_company_id');

4. Update Profile type (remove company_id and role):
   interface Profile {
     id: string;
     email: string;
     full_name: string;
     last_active_company_id: string;  // New
     created_at: string;
     updated_at: string;
   }

5. Update Company interface to include role:
   interface UserCompany {
     company_id: string;
     company_name: string;
     role: 'admin' | 'member' | 'viewer';
     is_active: boolean;
   }

IMPORTANT:
- Call set_active_company() BEFORE any data fetching
- Session variable persists for the connection duration
- Reload page after switch to reset all subscriptions
- last_active_company_id is automatically updated
*/


-- =====================================================================
-- SECTION 7: SECURITY NOTES
-- =====================================================================

-- SECURITY FEATURES:
-- 1. set_active_company() validates user belongs to company
-- 2. get_user_company_id() double-checks user has access
-- 3. Session variable is connection-specific (cannot be spoofed)
-- 4. All functions use SECURITY DEFINER with search_path = public
-- 5. RLS policies remain unchanged (same tenant isolation)
--
-- ATTACK SCENARIOS PREVENTED:
-- - User cannot set company_id to arbitrary value (validated in set_active_company)
-- - User cannot access another company's data (RLS policies still enforce isolation)
-- - Session variable cannot be set directly (must use set_active_company)
-- - Fallback ensures user always has valid company (first available)


-- =====================================================================
-- SECTION 8: ROLLBACK INSTRUCTIONS
-- =====================================================================

-- To rollback to single-company model:
--
-- 1. Restore old get_user_company_id():
--    CREATE OR REPLACE FUNCTION public.get_user_company_id()
--    RETURNS UUID
--    LANGUAGE SQL
--    SECURITY DEFINER
--    STABLE
--    SET search_path = public
--    AS $$
--      SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
--    $$;
--
-- 2. Drop new functions:
--    DROP FUNCTION IF EXISTS public.set_active_company(UUID);
--    DROP FUNCTION IF EXISTS public.get_user_companies();
--
-- 3. Restore profiles.company_id (see Step 3 rollback instructions)
--
-- WARNING: This will revert to single-company mode!


-- =====================================================================
-- SECTION 9: POST-MIGRATION CHECKLIST
-- =====================================================================

-- After running all 4 steps:
-- [ ] All 4 migration files executed successfully
-- [ ] Verification queries pass (see above)
-- [ ] Test get_user_company_id() returns valid company
-- [ ] Test set_active_company() with valid company
-- [ ] Test set_active_company() with invalid company (should fail)
-- [ ] Test RLS policies (can only see data from active company)
-- [ ] Update frontend CompanyContext.tsx
-- [ ] Update Profile TypeScript interface
-- [ ] Add company switcher UI component
-- [ ] Test company switching in browser
-- [ ] Test with multiple users across multiple companies
-- [ ] Verify last_active_company_id updates correctly
-- [ ] Deploy to production (all 4 steps together!)


-- =====================================================================
-- END OF STEP 4 MIGRATION - MULTI-COMPANY COMPLETE!
-- =====================================================================
