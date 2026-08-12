-- Migration: Manueller Status-Override für Zeiteinträge
-- Date: 2026-08-12
--
-- Purpose:
-- Der Status eines Zeiteintrags wird bisher ausschliesslich aus der
-- Rechnungsverknüpfung abgeleitet (siehe 20260201_time_entries_dynamic_status_view.sql).
-- Das ist korrekt, solange jede verrechnete Stunde auch wirklich über den
-- Zeiteintrags-Import in die Rechnung gelangt ist. In der Praxis gibt es aber Fälle
-- ohne Verknüpfung (manuell getippte Positionen, extern gestellte Rechnungen,
-- Altbestand), die dauerhaft als "offen" erscheinen.
--
-- Lösung: eine optionale manuelle Übersteuerung.
--   manual_status IS NULL        -> automatisch (Verhalten wie bisher)
--   manual_status = 'verrechnet' -> gilt als erledigt, egal ob invoice_id gesetzt ist
--   manual_status = 'offen'      -> gilt als offen, auch wenn eine Rechnung verknüpft ist
--
-- Die Ableitung bleibt der Normalfall; der Override ist die bewusste Ausnahme
-- und lässt sich jederzeit wieder auf "automatisch" zurücksetzen.

-- 1. Override-Spalte
ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS manual_status text
  CHECK (manual_status IS NULL OR manual_status IN ('offen', 'verrechnet'));

COMMENT ON COLUMN time_entries.manual_status IS
  'Manuelle Übersteuerung des abgeleiteten Status. NULL = automatisch aus invoice_id ableiten. '
  'Werte: offen | verrechnet.';

-- Teilindex: nur die wenigen übersteuerten Zeilen landen im Index
CREATE INDEX IF NOT EXISTS idx_time_entries_manual_status
  ON time_entries(company_id, manual_status)
  WHERE manual_status IS NOT NULL;

-- 2. View neu aufbauen (DROP statt REPLACE, da sich die Spaltenliste erweitert)
DROP VIEW IF EXISTS view_time_entries_with_status;

CREATE VIEW view_time_entries_with_status AS
SELECT
  te.id,
  te.company_id,
  te.project_id,
  te.date,
  te.hours,
  te.rate,
  te.snapshot_source,
  te.description,
  te.billable,
  te.invoice_id,
  te.created_at,
  -- Deprecated column (kept for backwards compatibility, but derived)
  CASE WHEN te.invoice_id IS NOT NULL THEN true ELSE false END AS invoiced,
  -- Manueller Override (NULL = automatisch)
  te.manual_status,
  -- Status: manueller Override schlägt die Ableitung
  CASE
    WHEN te.manual_status IS NOT NULL THEN te.manual_status
    WHEN te.invoice_id IS NULL THEN 'offen'
    ELSE COALESCE(i.status, 'offen')
  END AS derived_status,
  -- Kennzeichnet, ob der Status von Hand gesetzt wurde (für die UI)
  (te.manual_status IS NOT NULL) AS is_manual_status,
  -- Invoice details for display
  i.invoice_number,
  i.status AS invoice_status,
  i.issue_date AS invoice_date
FROM time_entries te
LEFT JOIN invoices i ON te.invoice_id = i.id;

COMMENT ON VIEW view_time_entries_with_status IS
  'View that derives time entry status from the invoice relationship, with an optional '
  'manual override (time_entries.manual_status). Precedence: manual_status > invoice status > offen. '
  'The invoiced column is deprecated - use invoice_id IS NOT NULL instead.';

GRANT SELECT ON view_time_entries_with_status TO authenticated;
GRANT SELECT ON view_time_entries_with_status TO anon;

-- 3. Offene-Stunden-Berechnung respektiert den Override
CREATE OR REPLACE FUNCTION get_project_open_hours(p_project_id uuid)
RETURNS numeric AS $$
  SELECT COALESCE(SUM(te.hours), 0)
  FROM time_entries te
  LEFT JOIN invoices i ON te.invoice_id = i.id
  WHERE te.project_id = p_project_id
    AND te.billable = true
    AND CASE
          WHEN te.manual_status = 'verrechnet' THEN false
          WHEN te.manual_status = 'offen' THEN true
          ELSE (te.invoice_id IS NULL OR i.status = 'entwurf')
        END;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_project_open_hours(uuid) IS
  'Returns the sum of billable hours for a project that count as open. '
  'Respects the manual_status override, otherwise: not invoiced or linked to a draft invoice.';
