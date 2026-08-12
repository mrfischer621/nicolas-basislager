-- =====================================================================
-- MULTI-COMPANY SUPPORT - STEP 1: Junction Table
-- =====================================================================
-- Migration: 20260128_multi_company_step1_junction_table.sql
-- Purpose: Create user_companies junction table for many-to-many relationship
-- Date: 2026-01-28
--
-- OVERVIEW:
-- This is STEP 1 of 4 in the multi-company migration.
-- Creates the user_companies table WITHOUT modifying profiles table yet.
--
-- CHANGES:
-- - Creates user_companies junction table
-- - Adds RLS policies for tenant isolation
-- - Adds role-based access control (admin/member/viewer)
--
-- NEXT STEPS:
-- - Step 2: Migrate existing data from profiles.company_id
-- - Step 3: Modify profiles table (remove company_id, add last_active_company_id)
-- - Step 4: Update get_user_company_id() function
-- =====================================================================


-- =====================================================================
-- SECTION 1: CREATE USER_COMPANIES JUNCTION TABLE
-- =====================================================================

-- Junction table for many-to-many relationship between users and companies
CREATE TABLE IF NOT EXISTS public.user_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign Keys
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

    -- Role for this user in this specific company
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Ensure a user can only be assigned to a company once
    CONSTRAINT user_companies_unique UNIQUE (user_id, company_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_companies_user_id
    ON public.user_companies(user_id);

CREATE INDEX IF NOT EXISTS idx_user_companies_company_id
    ON public.user_companies(company_id);

-- Create composite index for role-based queries
CREATE INDEX IF NOT EXISTS idx_user_companies_user_company_role
    ON public.user_companies(user_id, company_id, role);

-- Add table documentation
COMMENT ON TABLE public.user_companies IS
'Junction table linking users to companies with roles. Enables multi-company access per user.';

COMMENT ON COLUMN public.user_companies.role IS
'User role in this company: admin (can manage users/settings), member (standard access), viewer (read-only)';


-- =====================================================================
-- SECTION 2: ENABLE ROW LEVEL SECURITY
-- =====================================================================

ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;


-- =====================================================================
-- SECTION 3: RLS POLICIES FOR USER_COMPANIES
-- =====================================================================

-- ---------------------------------------------------------------------
-- Policy: Users can view their own company assignments
-- ---------------------------------------------------------------------
-- Users can see which companies they belong to
CREATE POLICY "Users can view their own company assignments"
    ON public.user_companies
    FOR SELECT
    USING (user_id = auth.uid());


-- ---------------------------------------------------------------------
-- Policy: Company admins can view all user assignments in their company
-- ---------------------------------------------------------------------
-- Admins can see all users in companies where they are admin
CREATE POLICY "Company admins can view company users"
    ON public.user_companies
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id
            FROM public.user_companies
            WHERE user_id = auth.uid()
                AND role = 'admin'
        )
    );


-- ---------------------------------------------------------------------
-- Policy: Company admins can add users to their companies
-- ---------------------------------------------------------------------
-- Admins can invite new users to companies they manage
CREATE POLICY "Company admins can add users"
    ON public.user_companies
    FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id
            FROM public.user_companies
            WHERE user_id = auth.uid()
                AND role = 'admin'
        )
    );


-- ---------------------------------------------------------------------
-- Policy: Company admins can update user roles in their companies
-- ---------------------------------------------------------------------
-- Admins can change roles of other users (but not their own role)
CREATE POLICY "Company admins can update user roles"
    ON public.user_companies
    FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id
            FROM public.user_companies
            WHERE user_id = auth.uid()
                AND role = 'admin'
        )
        AND user_id != auth.uid()  -- Cannot change own role
    );


-- ---------------------------------------------------------------------
-- Policy: Company admins can remove users from their companies
-- ---------------------------------------------------------------------
-- Admins can remove users (but not themselves)
CREATE POLICY "Company admins can remove users"
    ON public.user_companies
    FOR DELETE
    USING (
        company_id IN (
            SELECT company_id
            FROM public.user_companies
            WHERE user_id = auth.uid()
                AND role = 'admin'
        )
        AND user_id != auth.uid()  -- Cannot remove themselves
    );


-- =====================================================================
-- SECTION 4: TRIGGER FOR UPDATED_AT
-- =====================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_companies_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER trigger_update_user_companies_updated_at
    BEFORE UPDATE ON public.user_companies
    FOR EACH ROW
    EXECUTE FUNCTION update_user_companies_updated_at();

COMMENT ON FUNCTION update_user_companies_updated_at() IS
'Automatically updates the updated_at timestamp when user_companies row is modified';


-- =====================================================================
-- SECTION 5: SECURITY TRIGGER (Prevent Self-Role Changes)
-- =====================================================================

-- Prevent users from changing their own role via UPDATE
-- Admins can change OTHER users' roles, but not their own
CREATE OR REPLACE FUNCTION prevent_self_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- If trying to change own role
    IF NEW.user_id = auth.uid() AND OLD.role IS DISTINCT FROM NEW.role THEN
        RAISE EXCEPTION 'Cannot modify your own role. Ask another admin to change it.'
            USING ERRCODE = '42501';  -- insufficient_privilege
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_no_self_role_change
    BEFORE UPDATE ON public.user_companies
    FOR EACH ROW
    EXECUTE FUNCTION prevent_self_role_escalation();

COMMENT ON FUNCTION prevent_self_role_escalation() IS
'Prevents users from escalating their own role. Only other admins can change a user''s role.';


-- =====================================================================
-- SECTION 6: VERIFICATION QUERIES
-- =====================================================================

/*
-- Verify table was created with correct structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'user_companies'
ORDER BY ordinal_position;

-- Verify RLS is enabled
SELECT
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename = 'user_companies';

-- Expected: rowsecurity = true

-- Verify all policies exist
SELECT
    policyname,
    cmd,
    permissive
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename = 'user_companies'
ORDER BY cmd, policyname;

-- Expected: 6 policies (2 SELECT, 1 INSERT, 1 UPDATE, 1 DELETE, plus inherited)

-- Verify indexes exist
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename = 'user_companies'
ORDER BY indexname;

-- Expected: 4 indexes (1 PK + 3 custom)
*/


-- =====================================================================
-- SECTION 7: POST-MIGRATION NOTES
-- =====================================================================

-- IMPORTANT: This migration does NOT yet populate data!
--
-- Next steps:
-- 1. Run Step 2 migration to copy data from profiles.company_id
-- 2. Verify data migration was successful
-- 3. Run Step 3 to modify profiles table
-- 4. Run Step 4 to update get_user_company_id() function
-- 5. Update frontend code to use new multi-company structure
--
-- At this point:
-- - user_companies table exists but is EMPTY
-- - profiles table still has company_id column
-- - get_user_company_id() still uses profiles.company_id
-- - Application continues to work as before


-- =====================================================================
-- END OF STEP 1 MIGRATION
-- =====================================================================
