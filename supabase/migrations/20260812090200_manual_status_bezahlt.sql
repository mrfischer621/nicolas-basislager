-- Migration: Status "bezahlt" als manuelle Option
-- Date: 2026-08-12
--
-- Erweitert den manuellen Status-Override (20260812_time_entries_manual_status.sql)
-- um den Wert 'bezahlt'. Damit lässt sich ein Zeiteintrag auch dann als bezahlt
-- markieren, wenn die Zahlung ausserhalb des Tools erfasst wurde oder gar keine
-- Rechnung im System verknüpft ist.
--
-- Status-Semantik für die Berechnung offener Stunden:
--   'offen'      -> zählt als offen
--   'verrechnet' -> zählt nicht mehr als offen
--   'bezahlt'    -> zählt nicht mehr als offen
--   NULL         -> automatisch aus der Rechnungsverknüpfung ableiten

-- 1. CHECK-Constraint um 'bezahlt' erweitern
ALTER TABLE time_entries
  DROP CONSTRAINT IF EXISTS time_entries_manual_status_check;

ALTER TABLE time_entries
  ADD CONSTRAINT time_entries_manual_status_check
  CHECK (manual_status IS NULL OR manual_status IN ('offen', 'verrechnet', 'bezahlt'));

COMMENT ON COLUMN time_entries.manual_status IS
  'Manuelle Übersteuerung des abgeleiteten Status. NULL = automatisch aus invoice_id ableiten. '
  'Werte: offen | verrechnet | bezahlt.';

-- 2. Offene Stunden: 'bezahlt' zählt wie 'verrechnet' nicht mehr als offen.
--    Die View braucht keine Anpassung - sie reicht manual_status unverändert durch.
CREATE OR REPLACE FUNCTION get_project_open_hours(p_project_id uuid)
RETURNS numeric AS $$
  SELECT COALESCE(SUM(te.hours), 0)
  FROM time_entries te
  LEFT JOIN invoices i ON te.invoice_id = i.id
  WHERE te.project_id = p_project_id
    AND te.billable = true
    AND CASE
          WHEN te.manual_status IS NOT NULL THEN te.manual_status = 'offen'
          ELSE (te.invoice_id IS NULL OR i.status = 'entwurf')
        END;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_project_open_hours(uuid) IS
  'Returns the sum of billable hours for a project that count as open. '
  'Respects the manual_status override (nur offen zählt), otherwise: not invoiced or draft invoice.';
