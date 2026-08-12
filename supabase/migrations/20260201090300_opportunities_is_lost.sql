-- =====================================================
-- Add is_lost column to opportunities
-- Created: 2026-02-01
-- Purpose: Allow marking deals as lost without deleting
-- =====================================================

-- Add is_lost column with default false
ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS is_lost BOOLEAN NOT NULL DEFAULT false;

-- Index for filtering lost/active opportunities
CREATE INDEX IF NOT EXISTS idx_opportunities_is_lost
ON public.opportunities(company_id, is_lost);

COMMENT ON COLUMN public.opportunities.is_lost IS 'True if deal was lost. Lost deals are hidden by default in the UI.';

-- =====================================================
-- END OF MIGRATION
-- =====================================================
