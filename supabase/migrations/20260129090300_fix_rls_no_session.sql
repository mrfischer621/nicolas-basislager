-- =====================================================================
-- FIX RLS POLICIES: Remove Session Variable Dependency
-- =====================================================================
-- Date: 2026-01-29
-- Issue: Session variables don't persist across HTTP requests in Supabase
-- Solution: RLS policies check user_companies table directly
--
-- CHANGE: Instead of checking if company_id = get_user_company_id() (active company),
-- we check if company_id IN (user's accessible companies)
--
-- This allows users to query ANY company they have access to,
-- with the frontend controlling which company is "active" via explicit filters.
-- =====================================================================

-- CUSTOMERS
DROP POLICY IF EXISTS "Tenant Isolation" ON public.customers;
CREATE POLICY "Tenant Isolation" ON public.customers
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id
      FROM public.user_companies
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM public.user_companies
      WHERE user_id = auth.uid()
    )
  );

-- PROJECTS
DROP POLICY IF EXISTS "Tenant Isolation" ON public.projects;
CREATE POLICY "Tenant Isolation" ON public.projects
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id
      FROM public.user_companies
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM public.user_companies
      WHERE user_id = auth.uid()
    )
  );

-- INVOICES
DROP POLICY IF EXISTS "Tenant Isolation" ON public.invoices;
CREATE POLICY "Tenant Isolation" ON public.invoices
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id
      FROM public.user_companies
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM public.user_companies
      WHERE user_id = auth.uid()
    )
  );

-- TIME_ENTRIES
DROP POLICY IF EXISTS "Tenant Isolation" ON public.time_entries;
CREATE POLICY "Tenant Isolation" ON public.time_entries
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id
      FROM public.user_companies
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM public.user_companies
      WHERE user_id = auth.uid()
    )
  );

-- TRANSACTIONS
DROP POLICY IF EXISTS "Tenant Isolation" ON public.transactions;
CREATE POLICY "Tenant Isolation" ON public.transactions
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id
      FROM public.user_companies
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM public.user_companies
      WHERE user_id = auth.uid()
    )
  );

-- EXPENSES
DROP POLICY IF EXISTS "Tenant Isolation" ON public.expenses;
CREATE POLICY "Tenant Isolation" ON public.expenses
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id
      FROM public.user_companies
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM public.user_companies
      WHERE user_id = auth.uid()
    )
  );

-- PRODUCTS
DROP POLICY IF EXISTS "Tenant Isolation" ON public.products;
CREATE POLICY "Tenant Isolation" ON public.products
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id
      FROM public.user_companies
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM public.user_companies
      WHERE user_id = auth.uid()
    )
  );

-- OPPORTUNITIES (Sales Pipeline)
DROP POLICY IF EXISTS "Tenant Isolation" ON public.opportunities;
CREATE POLICY "Tenant Isolation" ON public.opportunities
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id
      FROM public.user_companies
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM public.user_companies
      WHERE user_id = auth.uid()
    )
  );

-- PIPELINE_STAGES (Sales Pipeline)
DROP POLICY IF EXISTS "Tenant Isolation" ON public.pipeline_stages;
CREATE POLICY "Tenant Isolation" ON public.pipeline_stages
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id
      FROM public.user_companies
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM public.user_companies
      WHERE user_id = auth.uid()
    )
  );

-- YEAR_END_CLOSINGS
DROP POLICY IF EXISTS "Tenant Isolation" ON public.year_end_closings;
CREATE POLICY "Tenant Isolation" ON public.year_end_closings
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id
      FROM public.user_companies
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM public.user_companies
      WHERE user_id = auth.uid()
    )
  );

-- =====================================================================
-- EXPLANATION
-- =====================================================================
--
-- OLD APPROACH (Didn't Work):
-- - RLS policy: company_id = get_user_company_id()
-- - get_user_company_id() reads session variable set by set_active_company()
-- - Problem: Session variables don't persist across HTTP requests
-- - Result: RLS filters for wrong company → 0 rows
--
-- NEW APPROACH (This Migration):
-- - RLS policy: company_id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid())
-- - Checks if user has access to the company directly from user_companies table
-- - No session variables needed
-- - Frontend controls "active company" via explicit .eq('company_id', selectedCompany.id)
-- - RLS just ensures user can only access companies they belong to
--
-- SECURITY:
-- - Still maintains tenant isolation (users can't access companies they're not members of)
-- - No longer tries to limit to "active" company at DB level
-- - "Active company" is now a frontend concept only
-- - Simpler and more reliable
-- =====================================================================

-- Verification notice
DO $$
BEGIN
  RAISE NOTICE 'RLS policies updated to use user_companies table directly';
END $$;
