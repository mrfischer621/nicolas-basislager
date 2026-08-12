-- Migration: Dynamic Status View for Time Entries
-- Phase: Architecture Fix - Avoid redundant status fields
-- Date: 2026-02-01
--
-- Purpose:
-- Instead of storing status in time_entries, derive it dynamically from the
-- invoice relationship. This ensures data integrity and eliminates sync issues.
--
-- Status Logic:
-- - invoice_id IS NULL -> 'offen' (not yet invoiced)
-- - invoice_id NOT NULL -> inherit status from linked invoice (entwurf/versendet/bezahlt/überfällig)
--
-- Note: The 'invoiced' boolean column in time_entries is now DEPRECATED.
-- It should no longer be used - use invoice_id IS NOT NULL instead.

-- Create the view with dynamic status
CREATE OR REPLACE VIEW view_time_entries_with_status AS
SELECT
  te.id,
  te.company_id,
  te.project_id,
  te.date,
  te.hours,
  te.rate,
  te.description,
  te.billable,
  te.invoice_id,
  te.created_at,
  -- Deprecated column (kept for backwards compatibility, but derived)
  CASE WHEN te.invoice_id IS NOT NULL THEN true ELSE false END AS invoiced,
  -- Dynamic status based on invoice relationship
  CASE
    WHEN te.invoice_id IS NULL THEN 'offen'
    ELSE COALESCE(i.status, 'offen')
  END AS derived_status,
  -- Invoice details for display
  i.invoice_number,
  i.status AS invoice_status,
  i.issue_date AS invoice_date
FROM time_entries te
LEFT JOIN invoices i ON te.invoice_id = i.id;

-- Add comment explaining the view
COMMENT ON VIEW view_time_entries_with_status IS
  'View that derives time entry status from invoice relationship. '
  'Status logic: NULL invoice_id = offen, otherwise inherits invoice status. '
  'The invoiced column is deprecated - use invoice_id IS NOT NULL instead.';

-- Grant permissions (same as time_entries table)
GRANT SELECT ON view_time_entries_with_status TO authenticated;
GRANT SELECT ON view_time_entries_with_status TO anon;

-- Create a helper function for open hours calculation
-- This considers entries as "open" if:
-- 1. invoice_id IS NULL (not linked to any invoice), OR
-- 2. invoice_id IS NOT NULL but invoice status is 'entwurf' (draft - not yet sent)
CREATE OR REPLACE FUNCTION get_project_open_hours(p_project_id uuid)
RETURNS numeric AS $$
  SELECT COALESCE(SUM(te.hours), 0)
  FROM time_entries te
  LEFT JOIN invoices i ON te.invoice_id = i.id
  WHERE te.project_id = p_project_id
    AND te.billable = true
    AND (
      te.invoice_id IS NULL
      OR i.status = 'entwurf'
    );
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_project_open_hours(uuid) IS
  'Returns the sum of billable hours for a project that are either not invoiced '
  'or linked to a draft invoice. Used for "offene Stunden" calculation.';

-- Mark the 'invoiced' column as deprecated (add comment)
COMMENT ON COLUMN time_entries.invoiced IS
  'DEPRECATED: Use invoice_id IS NOT NULL instead. '
  'This column exists for backwards compatibility only.';
