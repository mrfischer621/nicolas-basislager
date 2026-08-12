-- =====================================================
-- SECURITY OVERHAUL: Multi-Tenant RLS Implementation
-- =====================================================
-- Migration: 20260122_security_overhaul.sql
-- Purpose: Implement strict Row Level Security for multi-tenant CRM
-- Date: 2026-01-22
--
-- WARNING: This migration enforces strict RLS. Ensure you have:
-- 1. Created user accounts in Supabase Auth
-- 2. Populated the profiles table with user-to-company mappings
-- 3. Tested policies before deploying to production
--
-- CRITICAL: After running this migration, the Service Role key will
-- bypass RLS. Ensure your application uses the ANON key for all
-- client-side operations.
-- =====================================================

-- =====================================================
-- SECTION 1: PROFILES TABLE (User-to-Company Mapping)
-- =====================================================

-- Create profiles table to link auth.users to companies
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Ensure email is unique
    CONSTRAINT profiles_email_unique UNIQUE (email)
);

-- Create index for fast company lookups
CREATE INDEX IF NOT EXISTS idx_profiles_company_id
    ON public.profiles(company_id);

-- Create index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email
    ON public.profiles(email);

-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view their own profile"
    ON public.profiles
    FOR SELECT
    USING (id = auth.uid());

-- Policy: Users can update their own profile (except company_id and role)
CREATE POLICY "Users can update their own profile"
    ON public.profiles
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Trigger: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_profiles_updated_at();

-- Comments for documentation
COMMENT ON TABLE public.profiles IS
    'Links authenticated users (auth.users) to companies for multi-tenant access control';
COMMENT ON COLUMN public.profiles.role IS
    'User role: owner (full access), admin (management), member (basic access)';

-- =====================================================
-- SECTION 2: HELPER FUNCTION (Get Current User Company)
-- =====================================================

-- Function to get the company_id for the current authenticated user
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT company_id
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated;

-- Comment for documentation
COMMENT ON FUNCTION public.get_user_company_id() IS
    'Returns the company_id for the currently authenticated user. Used in RLS policies.';

-- =====================================================
-- SECTION 3: COMPANIES TABLE RLS
-- =====================================================

-- Enable RLS on companies table
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Users can view their company" ON public.companies;
DROP POLICY IF EXISTS "Users can update their company" ON public.companies;

-- Policy: Users can view their own company
CREATE POLICY "Users can view their company"
    ON public.companies
    FOR SELECT
    USING (id = public.get_user_company_id());

-- Policy: Users can update their own company
CREATE POLICY "Users can update their company"
    ON public.companies
    FOR UPDATE
    USING (id = public.get_user_company_id());

-- Note: No INSERT or DELETE policies on companies
-- Company creation should be handled via application logic or admin panel

-- =====================================================
-- SECTION 4: CUSTOMERS TABLE RLS
-- =====================================================

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (clean slate)
DROP POLICY IF EXISTS "Users can view their company's customers" ON public.customers;
DROP POLICY IF EXISTS "Users can insert customers for their company" ON public.customers;
DROP POLICY IF EXISTS "Users can update their company's customers" ON public.customers;
DROP POLICY IF EXISTS "Users can delete their company's customers" ON public.customers;

-- SELECT Policy
CREATE POLICY "Users can view their company's customers"
    ON public.customers
    FOR SELECT
    USING (company_id = public.get_user_company_id());

-- INSERT Policy
CREATE POLICY "Users can insert customers for their company"
    ON public.customers
    FOR INSERT
    WITH CHECK (company_id = public.get_user_company_id());

-- UPDATE Policy
CREATE POLICY "Users can update their company's customers"
    ON public.customers
    FOR UPDATE
    USING (company_id = public.get_user_company_id());

-- DELETE Policy
CREATE POLICY "Users can delete their company's customers"
    ON public.customers
    FOR DELETE
    USING (company_id = public.get_user_company_id());

-- =====================================================
-- SECTION 5: PROJECTS TABLE RLS
-- =====================================================

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their company's projects" ON public.projects;
DROP POLICY IF EXISTS "Users can insert projects for their company" ON public.projects;
DROP POLICY IF EXISTS "Users can update their company's projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete their company's projects" ON public.projects;

-- SELECT Policy
CREATE POLICY "Users can view their company's projects"
    ON public.projects
    FOR SELECT
    USING (company_id = public.get_user_company_id());

-- INSERT Policy
CREATE POLICY "Users can insert projects for their company"
    ON public.projects
    FOR INSERT
    WITH CHECK (company_id = public.get_user_company_id());

-- UPDATE Policy
CREATE POLICY "Users can update their company's projects"
    ON public.projects
    FOR UPDATE
    USING (company_id = public.get_user_company_id());

-- DELETE Policy
CREATE POLICY "Users can delete their company's projects"
    ON public.projects
    FOR DELETE
    USING (company_id = public.get_user_company_id());

-- =====================================================
-- SECTION 6: TIME_ENTRIES TABLE RLS
-- =====================================================

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their company's time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Users can insert time entries for their company" ON public.time_entries;
DROP POLICY IF EXISTS "Users can update their company's time entries" ON public.time_entries;
DROP POLICY IF EXISTS "Users can delete their company's time entries" ON public.time_entries;

-- SELECT Policy
CREATE POLICY "Users can view their company's time entries"
    ON public.time_entries
    FOR SELECT
    USING (company_id = public.get_user_company_id());

-- INSERT Policy
CREATE POLICY "Users can insert time entries for their company"
    ON public.time_entries
    FOR INSERT
    WITH CHECK (company_id = public.get_user_company_id());

-- UPDATE Policy
CREATE POLICY "Users can update their company's time entries"
    ON public.time_entries
    FOR UPDATE
    USING (company_id = public.get_user_company_id());

-- DELETE Policy
CREATE POLICY "Users can delete their company's time entries"
    ON public.time_entries
    FOR DELETE
    USING (company_id = public.get_user_company_id());

-- =====================================================
-- SECTION 7: INVOICES TABLE RLS
-- =====================================================

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their company's invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert invoices for their company" ON public.invoices;
DROP POLICY IF EXISTS "Users can update their company's invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete their company's invoices" ON public.invoices;

-- SELECT Policy
CREATE POLICY "Users can view their company's invoices"
    ON public.invoices
    FOR SELECT
    USING (company_id = public.get_user_company_id());

-- INSERT Policy
CREATE POLICY "Users can insert invoices for their company"
    ON public.invoices
    FOR INSERT
    WITH CHECK (company_id = public.get_user_company_id());

-- UPDATE Policy
CREATE POLICY "Users can update their company's invoices"
    ON public.invoices
    FOR UPDATE
    USING (company_id = public.get_user_company_id());

-- DELETE Policy
CREATE POLICY "Users can delete their company's invoices"
    ON public.invoices
    FOR DELETE
    USING (company_id = public.get_user_company_id());

-- =====================================================
-- SECTION 8: INVOICE_ITEMS TABLE RLS (Special Case)
-- =====================================================
-- Note: invoice_items has NO company_id column
-- Must use JOIN-based policy through invoices table

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their company's invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can insert invoice items for their company" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can update their company's invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can delete their company's invoice items" ON public.invoice_items;

-- SELECT Policy (via JOIN to invoices)
CREATE POLICY "Users can view their company's invoice items"
    ON public.invoice_items
    FOR SELECT
    USING (
        invoice_id IN (
            SELECT id
            FROM public.invoices
            WHERE company_id = public.get_user_company_id()
        )
    );

-- INSERT Policy (via JOIN to invoices)
CREATE POLICY "Users can insert invoice items for their company"
    ON public.invoice_items
    FOR INSERT
    WITH CHECK (
        invoice_id IN (
            SELECT id
            FROM public.invoices
            WHERE company_id = public.get_user_company_id()
        )
    );

-- UPDATE Policy (via JOIN to invoices)
CREATE POLICY "Users can update their company's invoice items"
    ON public.invoice_items
    FOR UPDATE
    USING (
        invoice_id IN (
            SELECT id
            FROM public.invoices
            WHERE company_id = public.get_user_company_id()
        )
    );

-- DELETE Policy (via JOIN to invoices)
CREATE POLICY "Users can delete their company's invoice items"
    ON public.invoice_items
    FOR DELETE
    USING (
        invoice_id IN (
            SELECT id
            FROM public.invoices
            WHERE company_id = public.get_user_company_id()
        )
    );

-- =====================================================
-- SECTION 9: TRANSACTIONS TABLE RLS
-- =====================================================

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their company's transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert transactions for their company" ON public.transactions;
DROP POLICY IF EXISTS "Users can update their company's transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete their company's transactions" ON public.transactions;

-- SELECT Policy
CREATE POLICY "Users can view their company's transactions"
    ON public.transactions
    FOR SELECT
    USING (company_id = public.get_user_company_id());

-- INSERT Policy
CREATE POLICY "Users can insert transactions for their company"
    ON public.transactions
    FOR INSERT
    WITH CHECK (company_id = public.get_user_company_id());

-- UPDATE Policy
CREATE POLICY "Users can update their company's transactions"
    ON public.transactions
    FOR UPDATE
    USING (company_id = public.get_user_company_id());

-- DELETE Policy
CREATE POLICY "Users can delete their company's transactions"
    ON public.transactions
    FOR DELETE
    USING (company_id = public.get_user_company_id());

-- =====================================================
-- SECTION 10: EXPENSES TABLE RLS
-- =====================================================

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their company's expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can insert expenses for their company" ON public.expenses;
DROP POLICY IF EXISTS "Users can update their company's expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete their company's expenses" ON public.expenses;

-- SELECT Policy
CREATE POLICY "Users can view their company's expenses"
    ON public.expenses
    FOR SELECT
    USING (company_id = public.get_user_company_id());

-- INSERT Policy
CREATE POLICY "Users can insert expenses for their company"
    ON public.expenses
    FOR INSERT
    WITH CHECK (company_id = public.get_user_company_id());

-- UPDATE Policy
CREATE POLICY "Users can update their company's expenses"
    ON public.expenses
    FOR UPDATE
    USING (company_id = public.get_user_company_id());

-- DELETE Policy
CREATE POLICY "Users can delete their company's expenses"
    ON public.expenses
    FOR DELETE
    USING (company_id = public.get_user_company_id());

-- =====================================================
-- SECTION 11: PRODUCTS TABLE RLS
-- =====================================================

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their company's products" ON public.products;
DROP POLICY IF EXISTS "Users can insert products for their company" ON public.products;
DROP POLICY IF EXISTS "Users can update their company's products" ON public.products;
DROP POLICY IF EXISTS "Users can delete their company's products" ON public.products;

-- SELECT Policy
CREATE POLICY "Users can view their company's products"
    ON public.products
    FOR SELECT
    USING (company_id = public.get_user_company_id());

-- INSERT Policy
CREATE POLICY "Users can insert products for their company"
    ON public.products
    FOR INSERT
    WITH CHECK (company_id = public.get_user_company_id());

-- UPDATE Policy
CREATE POLICY "Users can update their company's products"
    ON public.products
    FOR UPDATE
    USING (company_id = public.get_user_company_id());

-- DELETE Policy
CREATE POLICY "Users can delete their company's products"
    ON public.products
    FOR DELETE
    USING (company_id = public.get_user_company_id());

-- =====================================================
-- SECTION 12: YEAR_END_CLOSINGS TABLE RLS (Fix Broken Policies)
-- =====================================================

ALTER TABLE public.year_end_closings ENABLE ROW LEVEL SECURITY;

-- Drop existing BROKEN policies
DROP POLICY IF EXISTS "Users can view their company's year-end closings" ON public.year_end_closings;
DROP POLICY IF EXISTS "Users can insert year-end closings for their company" ON public.year_end_closings;
DROP POLICY IF EXISTS "Users can update their company's year-end closings" ON public.year_end_closings;
DROP POLICY IF EXISTS "Users can delete their company's year-end closings" ON public.year_end_closings;

-- SELECT Policy (CORRECTED)
CREATE POLICY "Users can view their company's year-end closings"
    ON public.year_end_closings
    FOR SELECT
    USING (company_id = public.get_user_company_id());

-- INSERT Policy (CORRECTED)
CREATE POLICY "Users can insert year-end closings for their company"
    ON public.year_end_closings
    FOR INSERT
    WITH CHECK (company_id = public.get_user_company_id());

-- UPDATE Policy (CORRECTED)
CREATE POLICY "Users can update their company's year-end closings"
    ON public.year_end_closings
    FOR UPDATE
    USING (company_id = public.get_user_company_id());

-- DELETE Policy (CORRECTED)
CREATE POLICY "Users can delete their company's year-end closings"
    ON public.year_end_closings
    FOR DELETE
    USING (company_id = public.get_user_company_id());

-- =====================================================
-- SECTION 13: VERIFICATION QUERIES
-- =====================================================
-- Run these queries AFTER migration to verify RLS is working

-- Check that RLS is enabled on all tables
-- Expected: All tables should show rowsecurity = true
-- SELECT
--     schemaname,
--     tablename,
--     rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;

-- Check all policies are created
-- Expected: 4 policies per table (SELECT, INSERT, UPDATE, DELETE)
-- SELECT
--     schemaname,
--     tablename,
--     policyname,
--     permissive,
--     cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- Verify get_user_company_id function exists
-- Expected: Should return 1 row
-- SELECT
--     routine_name,
--     routine_type,
--     security_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--     AND routine_name = 'get_user_company_id';

-- Test the helper function (must be run as authenticated user)
-- Expected: Should return your company_id UUID
-- SELECT public.get_user_company_id();

-- =====================================================
-- SECTION 14: POST-MIGRATION INSTRUCTIONS
-- =====================================================

-- CRITICAL: After running this migration, you MUST:
--
-- 1. CREATE TEST USERS in Supabase Auth:
--    - Go to Authentication > Users in Supabase Dashboard
--    - Click "Add User" and create test accounts
--
-- 2. POPULATE PROFILES TABLE:
--    Run this query for EACH user you created:
--
--    INSERT INTO public.profiles (id, company_id, email, full_name, role)
--    VALUES (
--        'USER_UUID_FROM_AUTH_USERS',  -- Get this from auth.users table
--        'COMPANY_UUID_FROM_COMPANIES',  -- Get this from companies table
--        'user@example.com',
--        'User Full Name',
--        'owner'  -- or 'admin' or 'member'
--    );
--
-- 3. TEST RLS POLICIES:
--    - Log in as a test user in your app
--    - Verify you can ONLY see data for your assigned company
--    - Try accessing another company's data (should fail)
--
-- 4. UPDATE FRONTEND CODE:
--    - Remove "RLS disabled" warnings from CompanyContext.tsx
--    - Remove localStorage-based company selection
--    - Get company from: SELECT * FROM profiles WHERE id = auth.uid()
--    - Update all queries to rely on RLS (remove .eq('company_id', ...))
--
-- 5. ENVIRONMENT VARIABLES:
--    - Ensure frontend uses VITE_SUPABASE_ANON_KEY (not service role key)
--    - Service role key bypasses RLS - NEVER expose to frontend!

-- =====================================================
-- SECTION 15: ROLLBACK INSTRUCTIONS
-- =====================================================
-- If you need to rollback this migration:
--
-- WARNING: This will remove ALL RLS protection!
--
-- -- Disable RLS on all tables
-- ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.time_entries DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.invoice_items DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.year_end_closings DISABLE ROW LEVEL SECURITY;
--
-- -- Drop all policies
-- DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
-- DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
-- DROP POLICY IF EXISTS "Users can view their company" ON public.companies;
-- DROP POLICY IF EXISTS "Users can update their company" ON public.companies;
-- -- ... (repeat for all tables)
--
-- -- Drop helper function
-- DROP FUNCTION IF EXISTS public.get_user_company_id();
--
-- -- Drop profiles table
-- DROP TABLE IF EXISTS public.profiles;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
