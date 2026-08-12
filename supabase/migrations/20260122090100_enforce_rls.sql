-- =====================================================================
-- SECURITY PHASE 3: THE LOCKDOWN - RLS ENFORCEMENT
-- =====================================================================
-- This migration enforces strict Row Level Security (RLS) on ALL tables.
-- After running this migration, users can ONLY access data from their
-- own company, ensuring complete tenant isolation.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. HELPER FUNCTION: Get Current User's Company ID
-- ---------------------------------------------------------------------
-- This function retrieves the company_id for the currently authenticated
-- user by looking up their profile. This is used extensively in RLS
-- policies for performance and consistency.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT company_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated;

COMMENT ON FUNCTION public.get_user_company_id() IS
'Returns the company_id for the currently authenticated user. Used in RLS policies for tenant isolation.';


-- ---------------------------------------------------------------------
-- 2. ENABLE RLS ON ALL TABLES
-- ---------------------------------------------------------------------
-- Force enable RLS on every table in the system. This ensures that
-- no table can be accessed without going through our security policies.
-- ---------------------------------------------------------------------

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.year_end_closings ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------
-- 3. DROP ALL EXISTING POLICIES (CLEAN SLATE)
-- ---------------------------------------------------------------------
-- Remove any existing policies to ensure we start fresh with a
-- consistent security model.
-- ---------------------------------------------------------------------

-- Drop policies if they exist (using DO block to handle non-existent policies gracefully)
DO $$
DECLARE
  pol RECORD;
BEGIN
  -- Drop all policies on all tables
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;


-- ---------------------------------------------------------------------
-- 4. CREATE RLS POLICIES
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- A) STANDARD POLICIES (Tables with company_id column)
-- ---------------------------------------------------------------------
-- These policies ensure users can only access data belonging to their
-- company. Both SELECT (USING) and INSERT/UPDATE (WITH CHECK) are
-- restricted to the user's company.
-- ---------------------------------------------------------------------

-- CUSTOMERS: Tenant Isolation
CREATE POLICY "Tenant Isolation" ON public.customers
  FOR ALL
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- PROJECTS: Tenant Isolation
CREATE POLICY "Tenant Isolation" ON public.projects
  FOR ALL
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- TIME_ENTRIES: Tenant Isolation
CREATE POLICY "Tenant Isolation" ON public.time_entries
  FOR ALL
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- INVOICES: Tenant Isolation
CREATE POLICY "Tenant Isolation" ON public.invoices
  FOR ALL
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- TRANSACTIONS: Tenant Isolation
CREATE POLICY "Tenant Isolation" ON public.transactions
  FOR ALL
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- EXPENSES: Tenant Isolation
CREATE POLICY "Tenant Isolation" ON public.expenses
  FOR ALL
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- PRODUCTS: Tenant Isolation
CREATE POLICY "Tenant Isolation" ON public.products
  FOR ALL
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- YEAR_END_CLOSINGS: Tenant Isolation
CREATE POLICY "Tenant Isolation" ON public.year_end_closings
  FOR ALL
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());


-- ---------------------------------------------------------------------
-- B) SPECIAL POLICY: COMPANIES TABLE
-- ---------------------------------------------------------------------
-- Users can only view/update their own company, but must be able to
-- INSERT a new company during the registration process.
-- ---------------------------------------------------------------------

-- Companies: Select and Update (Own Company Only)
CREATE POLICY "Own Company Access" ON public.companies
  FOR SELECT
  USING (id = get_user_company_id());

CREATE POLICY "Own Company Update" ON public.companies
  FOR UPDATE
  USING (id = get_user_company_id())
  WITH CHECK (id = get_user_company_id());

-- Companies: Insert (Allow during registration)
CREATE POLICY "Company Creation" ON public.companies
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Companies: Delete (Own Company Only)
CREATE POLICY "Own Company Delete" ON public.companies
  FOR DELETE
  USING (id = get_user_company_id());


-- ---------------------------------------------------------------------
-- C) SPECIAL POLICY: PROFILES TABLE
-- ---------------------------------------------------------------------
-- Users can only access and modify their own profile record.
-- Profiles are automatically created by a trigger on user signup.
-- ---------------------------------------------------------------------

-- Profiles: Users can only access their own profile
CREATE POLICY "Own Profile Access" ON public.profiles
  FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- ---------------------------------------------------------------------
-- D) SPECIAL POLICY: INVOICE_ITEMS TABLE
-- ---------------------------------------------------------------------
-- Invoice items don't have a company_id column, so we need to join
-- through the invoices table to enforce tenant isolation.
-- ---------------------------------------------------------------------

-- Invoice Items: Access only if the parent invoice belongs to user's company
CREATE POLICY "Tenant Isolation via Invoice" ON public.invoice_items
  FOR ALL
  USING (
    invoice_id IN (
      SELECT id FROM public.invoices
      WHERE company_id = get_user_company_id()
    )
  )
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM public.invoices
      WHERE company_id = get_user_company_id()
    )
  );


-- ---------------------------------------------------------------------
-- 5. VERIFICATION QUERIES (OPTIONAL - FOR TESTING)
-- ---------------------------------------------------------------------
-- Uncomment these queries to verify RLS is working correctly after
-- migration. These should be run AFTER logging in as a test user.
-- ---------------------------------------------------------------------

/*
-- Verify RLS is enabled on all tables
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verify all policies are created
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Test the helper function (must be logged in)
SELECT get_user_company_id();
*/


-- =====================================================================
-- MIGRATION COMPLETE
-- =====================================================================
-- All tables are now protected by Row Level Security.
-- Users can ONLY access data belonging to their company.
--
-- IMPORTANT: After running this migration, test thoroughly:
-- 1. Register a new user and verify they can create a company
-- 2. Log in and verify you can only see your own company's data
-- 3. Try to access another company's data (should return empty results)
-- =====================================================================
