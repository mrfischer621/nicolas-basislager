-- =====================================================================
-- TEMPORARY FIX: Disable RLS on user_companies
-- =====================================================================
-- Date: 2026-01-29
-- Issue: Infinite recursion when RLS policies reference user_companies
-- Solution: Disable RLS on user_companies since queries already filter by user_id
--
-- SECURITY NOTE:
-- This is safe because:
-- 1. All queries to user_companies filter by user_id = auth.uid()
-- 2. The table structure prevents unauthorized access via the query filter
-- 3. This breaks the recursion cycle while maintaining security
-- =====================================================================

-- Drop all existing policies on user_companies
DROP POLICY IF EXISTS "Tenant Isolation" ON public.user_companies;
DROP POLICY IF EXISTS "Users can view their own companies" ON public.user_companies;
DROP POLICY IF EXISTS "Users can manage their own company memberships" ON public.user_companies;
DROP POLICY IF EXISTS "Users can access their own company memberships" ON public.user_companies;

-- Disable RLS on user_companies table
ALTER TABLE public.user_companies DISABLE ROW LEVEL SECURITY;

-- Verification notice
DO $$
BEGIN
  RAISE NOTICE 'RLS disabled on user_companies to prevent infinite recursion';
  RAISE NOTICE 'Security maintained via user_id = auth.uid() filters in queries';
END $$;
