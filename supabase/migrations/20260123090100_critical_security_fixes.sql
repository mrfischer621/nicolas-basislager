-- =====================================================================
-- CRITICAL SECURITY FIXES: Search Path Injection & Privilege Escalation
-- =====================================================================
-- Migration: 20260123_critical_security_fixes.sql
-- Purpose: Fix two HIGH-RISK security vulnerabilities
-- Date: 2026-01-23
--
-- VULNERABILITIES FIXED:
-- 1. Search Path Injection in get_user_company_id() [HIGH RISK]
-- 2. Privilege Escalation via profiles.company_id/role modification [HIGH RISK]
--
-- CRITICAL: Apply this migration BEFORE going to production!
-- =====================================================================


-- =====================================================================
-- FIX #1: SEARCH PATH INJECTION IN get_user_company_id()
-- =====================================================================
--
-- VULNERABILITY:
-- The function uses SECURITY DEFINER without SET search_path, allowing
-- an attacker to override the schema search path and inject a malicious
-- profiles table, potentially accessing any company's data.
--
-- ATTACK SCENARIO:
-- CREATE SCHEMA attacker;
-- CREATE TABLE attacker.profiles (id UUID, company_id UUID);
-- INSERT INTO attacker.profiles VALUES (auth.uid(), 'VICTIM_COMPANY_ID');
-- SET search_path TO attacker, public;
-- -- Now get_user_company_id() returns the attacker's chosen company!
--
-- FIX:
-- Add "SET search_path = public" to lock the function to the public schema
-- =====================================================================

-- Recreate function with secure search_path
-- Note: Using CREATE OR REPLACE to avoid dropping dependent policies
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public  -- 🔒 CRITICAL: Prevents schema injection attacks
AS $$
  SELECT company_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated;

-- Add security documentation
COMMENT ON FUNCTION public.get_user_company_id() IS
'Returns the company_id for the currently authenticated user. Used in RLS policies for tenant isolation.
SECURITY: Uses SET search_path = public to prevent search path injection attacks.';


-- =====================================================================
-- FIX #2: PRIVILEGE ESCALATION IN PROFILES TABLE
-- =====================================================================
--
-- VULNERABILITY:
-- The current RLS policy allows users to UPDATE their entire profile,
-- including company_id and role. This allows privilege escalation:
-- - Change company_id → access another company's data
-- - Change role to 'owner' → gain admin privileges
--
-- ATTACK SCENARIO:
-- await supabase
--   .from('profiles')
--   .update({ company_id: 'VICTIM_COMPANY_UUID', role: 'owner' })
--   .eq('id', myUserId);
-- -- Now attacker has full access to victim's company data!
--
-- FIX:
-- 1. Drop permissive UPDATE policy
-- 2. Create trigger to prevent modification of company_id and role
-- 3. Create new UPDATE policy that only allows safe fields
-- =====================================================================

-- ---------------------------------------------------------------------
-- Step 1: Create trigger function to enforce immutable fields
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prevent modification of company_id
  IF OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'Cannot modify company_id. Contact administrator to change companies.'
      USING ERRCODE = '42501';  -- insufficient_privilege error code
  END IF;

  -- Prevent modification of role
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    RAISE EXCEPTION 'Cannot modify role. Contact administrator to change user permissions.'
      USING ERRCODE = '42501';  -- insufficient_privilege error code
  END IF;

  -- Allow update of other fields
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION prevent_profile_privilege_escalation() IS
'Trigger function to prevent privilege escalation by blocking modifications to company_id and role fields.
These fields can only be modified by administrators via service role key.';


-- ---------------------------------------------------------------------
-- Step 2: Create trigger on profiles table
-- ---------------------------------------------------------------------

DROP TRIGGER IF EXISTS enforce_immutable_profile_fields ON public.profiles;

CREATE TRIGGER enforce_immutable_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_profile_privilege_escalation();

COMMENT ON TRIGGER enforce_immutable_profile_fields ON public.profiles IS
'Prevents users from modifying their company_id or role to escalate privileges or access other company data.';


-- ---------------------------------------------------------------------
-- Step 3: Update RLS policies to be more restrictive
-- ---------------------------------------------------------------------

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Own Profile Access" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create separate policies for SELECT and UPDATE

-- SELECT Policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

-- UPDATE Policy: Users can update their own profile
-- Note: The trigger will prevent company_id/role changes
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- INSERT Policy: Allow profile creation during registration
-- (company_id and role are set during signup, not by user input)
CREATE POLICY "Users can create own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

-- Note: No DELETE policy - profiles should not be deletable by users
-- (CASCADE deletion from auth.users handles cleanup)


-- =====================================================================
-- VERIFICATION QUERIES
-- =====================================================================
-- Run these to verify the fixes are working correctly
-- =====================================================================

/*
-- Verify get_user_company_id() has secure search_path
SELECT
  proname as function_name,
  prosecdef as is_security_definer,
  proconfig as settings
FROM pg_proc
WHERE proname = 'get_user_company_id'
  AND pronamespace = 'public'::regnamespace;

-- Expected: settings should contain "search_path=public"


-- Verify trigger exists on profiles table
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'profiles'
  AND trigger_name = 'enforce_immutable_profile_fields';

-- Expected: 1 row with BEFORE UPDATE trigger


-- Verify RLS policies on profiles table
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'profiles'
ORDER BY cmd, policyname;

-- Expected: 3 policies (SELECT, INSERT, UPDATE)
-- No policy for DELETE
*/


-- =====================================================================
-- TESTING INSTRUCTIONS
-- =====================================================================
--
-- IMPORTANT: Test these fixes with a real user account before deploying!
--
-- TEST 1: Search Path Injection Prevention
-- -----------------------------------------
-- 1. Log in as a test user
-- 2. Run: SELECT get_user_company_id();
-- 3. Note the returned company_id
-- 4. Try to create a malicious schema:
--    CREATE SCHEMA test_attack;
--    CREATE TABLE test_attack.profiles (id UUID, company_id UUID);
--    INSERT INTO test_attack.profiles
--      VALUES (auth.uid(), '00000000-0000-0000-0000-000000000000');
--    SET search_path TO test_attack, public;
-- 5. Run again: SELECT get_user_company_id();
-- 6. Expected: Should return the SAME company_id (attack failed)
--
-- TEST 2: Privilege Escalation Prevention
-- ----------------------------------------
-- 1. Log in as a test user (member role)
-- 2. Note your current company_id and role
-- 3. Attempt to escalate privileges:
--    UPDATE profiles
--    SET company_id = '00000000-0000-0000-0000-000000000000'
--    WHERE id = auth.uid();
-- 4. Expected: ERROR "Cannot modify company_id"
-- 5. Attempt to change role:
--    UPDATE profiles
--    SET role = 'owner'
--    WHERE id = auth.uid();
-- 6. Expected: ERROR "Cannot modify role"
-- 7. Verify safe updates still work:
--    UPDATE profiles
--    SET full_name = 'New Name'
--    WHERE id = auth.uid();
-- 8. Expected: Success (full_name can be updated)
--
-- TEST 3: Frontend Testing
-- ------------------------
-- 1. Log into your app as a regular user
-- 2. Try to update profile via Settings page
-- 3. Verify you can change name/email but NOT company
-- 4. Check browser console for any errors
-- 5. Verify data is saved correctly
--
-- =====================================================================
-- END OF MIGRATION
-- =====================================================================
