-- =====================================================================
-- PERFORMANCE: Add Indexes to user_companies Table
-- =====================================================================
-- Date: 2026-01-29
-- Purpose: Optimize RLS subquery performance
--
-- IMPACT: Every SELECT query on tenant-scoped tables executes:
--   WHERE company_id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid())
--
-- These indexes ensure the subquery is fast (O(log n) instead of O(n))
-- =====================================================================

-- Index on user_id (most common query pattern)
-- Used by ALL RLS policies and get_user_companies() RPC
CREATE INDEX IF NOT EXISTS idx_user_companies_user_id
  ON public.user_companies(user_id);

-- Composite index on (user_id, company_id)
-- Optimizes queries that filter by both columns
CREATE INDEX IF NOT EXISTS idx_user_companies_user_company
  ON public.user_companies(user_id, company_id);

-- Index on company_id (for reverse lookups - e.g., "which users belong to this company")
-- Less common but useful for admin queries
CREATE INDEX IF NOT EXISTS idx_user_companies_company_id
  ON public.user_companies(company_id);

-- Analyze table to update query planner statistics
ANALYZE public.user_companies;

-- Verification
DO $$
BEGIN
    RAISE NOTICE '===== INDEXES CREATED =====';
    RAISE NOTICE '✅ idx_user_companies_user_id (single column)';
    RAISE NOTICE '✅ idx_user_companies_user_company (composite)';
    RAISE NOTICE '✅ idx_user_companies_company_id (reverse lookup)';
    RAISE NOTICE '';
    RAISE NOTICE 'RLS subquery performance should be significantly improved!';
    RAISE NOTICE 'Run EXPLAIN ANALYZE on queries to verify.';
END $$;
