-- =====================================================
-- RATE HIERARCHY & SNAPSHOTTING (Phase 4.3)
-- =====================================================
-- Migration: 20260215_rate_hierarchy_snapshotting.sql
-- Purpose: Implement hourly rate hierarchy (Project > Customer > Default 160 CHF)
--          with snapshotting to preserve rates at time of entry creation
-- Date: 2026-02-15
-- Idempotent: Can be run multiple times safely
-- =====================================================

-- =====================================================
-- SECTION 1: Add hourly_rate to projects table
-- =====================================================

-- Add hourly_rate column to projects (project-specific rate override)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'projects'
    AND column_name = 'hourly_rate'
  ) THEN
    ALTER TABLE projects ADD COLUMN hourly_rate DECIMAL(10,2) CHECK (hourly_rate >= 0);
  END IF;
END $$;

-- Add index for filtering projects by rate configuration
DROP INDEX IF EXISTS idx_projects_hourly_rate;
CREATE INDEX idx_projects_hourly_rate
  ON projects(company_id, hourly_rate)
  WHERE hourly_rate IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN projects.hourly_rate IS
  'Project-specific hourly rate override. Takes precedence over customer rate in the hierarchy: Project > Customer > Default (160 CHF).';

-- =====================================================
-- SECTION 2: Add snapshot_source to time_entries table
-- =====================================================

-- Add snapshot_source column to track where the rate came from
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'time_entries'
    AND column_name = 'snapshot_source'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN snapshot_source TEXT;
  END IF;
END $$;

-- Drop existing constraint if exists (for re-running migration)
DO $$
BEGIN
  ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_snapshot_source_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Add constraint
ALTER TABLE time_entries
  ADD CONSTRAINT time_entries_snapshot_source_check
  CHECK (snapshot_source IN ('project', 'customer', 'default', 'manual'));

-- Backfill existing time_entries with 'manual' (historical entries)
-- This indicates that the rate was manually set or created before snapshotting
UPDATE time_entries
SET snapshot_source = 'manual'
WHERE snapshot_source IS NULL;

-- Make snapshot_source required for new entries
ALTER TABLE time_entries
  ALTER COLUMN snapshot_source SET NOT NULL;

-- Add index for analytics/reporting on rate sources
DROP INDEX IF EXISTS idx_time_entries_snapshot_source;
CREATE INDEX idx_time_entries_snapshot_source
  ON time_entries(company_id, snapshot_source);

-- Comment for documentation
COMMENT ON COLUMN time_entries.snapshot_source IS
  'Tracks the source of the hourly rate at time of creation:
   - project: Rate was taken from project.hourly_rate (HIGHEST PRIORITY)
   - customer: Rate was taken from customer.hourly_rate (project had no rate)
   - default: Rate was taken from system default 160 CHF (neither project nor customer had a rate)
   - manual: Rate was manually entered or created before snapshotting was implemented';

-- =====================================================
-- SECTION 3: Create helper function for rate resolution
-- =====================================================

-- Function to resolve hourly rate following the hierarchy
-- Returns: { rate: number, source: 'project' | 'customer' | 'default' }
CREATE OR REPLACE FUNCTION public.resolve_hourly_rate(
  p_project_id UUID,
  p_default_rate DECIMAL(10,2) DEFAULT 160.00
)
RETURNS TABLE(rate DECIMAL(10,2), source TEXT)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_project_rate DECIMAL(10,2);
  v_customer_rate DECIMAL(10,2);
  v_customer_id UUID;
BEGIN
  -- Get project rate and customer_id
  SELECT p.hourly_rate, p.customer_id
  INTO v_project_rate, v_customer_id
  FROM projects p
  WHERE p.id = p_project_id;

  -- Check hierarchy: Project > Customer > Default
  -- PRIORITY 1: Project Rate
  IF v_project_rate IS NOT NULL THEN
    RETURN QUERY SELECT v_project_rate, 'project'::TEXT;
    RETURN;
  END IF;

  -- PRIORITY 2: Customer Rate
  IF v_customer_id IS NOT NULL THEN
    SELECT c.hourly_rate
    INTO v_customer_rate
    FROM customers c
    WHERE c.id = v_customer_id;

    IF v_customer_rate IS NOT NULL THEN
      RETURN QUERY SELECT v_customer_rate, 'customer'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- PRIORITY 3: Default (160 CHF)
  RETURN QUERY SELECT p_default_rate, 'default'::TEXT;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.resolve_hourly_rate(UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_hourly_rate(UUID, DECIMAL) TO anon;

-- Comment for documentation
COMMENT ON FUNCTION public.resolve_hourly_rate(UUID, DECIMAL) IS
  'Resolves the hourly rate for a given project following the hierarchy:
   1. Project hourly_rate (if set) - HIGHEST PRIORITY
   2. Customer hourly_rate (if set and project has no rate) - MEDIUM PRIORITY
   3. System default (160 CHF or custom default) - FALLBACK
   Returns both the rate and the source (project/customer/default) for snapshotting.';

-- =====================================================
-- SECTION 4: Example usage documentation
-- =====================================================

-- Example: Get resolved rate for a project (uses 160 CHF default)
-- SELECT * FROM resolve_hourly_rate('project-uuid');
-- Expected output: { rate: 160.00, source: 'default' } (if no rates set)
-- Expected output: { rate: 180.00, source: 'customer' } (if customer has 180 CHF)
-- Expected output: { rate: 200.00, source: 'project' } (if project has 200 CHF)
--
-- Example: Get resolved rate with custom default
-- SELECT * FROM resolve_hourly_rate('project-uuid', 180.00);
--
-- Frontend usage (TypeScript):
-- const { data } = await supabase.rpc('resolve_hourly_rate', {
--   p_project_id: projectId,
--   p_default_rate: 160.00
-- });
-- // data = [{ rate: 180.00, source: 'customer' }]

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- To verify:
-- 1. Check if column exists: SELECT column_name FROM information_schema.columns WHERE table_name='projects' AND column_name='hourly_rate';
-- 2. Check if function exists: SELECT * FROM resolve_hourly_rate('any-project-uuid');
-- 3. Test hierarchy: Create project with rate, without rate, check customer fallback
-- =====================================================
