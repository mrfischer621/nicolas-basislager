-- Migration: Externen Lesezugriff schliessen (Audit vom 2026-08-12)
-- Date: 2026-08-12
--
-- Auditbefund: Mit dem oeffentlichen Anon-Key (steckt im ausgelieferten
-- Frontend-Bundle, ist also faktisch oeffentlich) waren ohne jede Anmeldung
-- lesbar:
--   1. view_time_entries_with_status  -> 78 Zeilen
--   2. user_companies                 -> 2 Zeilen
-- Alle uebrigen 20 geprueften Tabellen, die Storage-Buckets und die RPC-
-- Funktionen gaben nichts preis.
--
-- ============================================================================
-- TEIL A - schliesst beide Lecks. Risikoarm.
-- ============================================================================

-- A1. View: laeuft bisher mit den Rechten ihres Besitzers und umgeht damit die
--     RLS der Tabelle time_entries. security_invoker verlagert die Auswertung
--     auf den aufrufenden User. Voraussetzung: PostgreSQL 15+ (Supabase erfuellt das).
ALTER VIEW public.view_time_entries_with_status SET (security_invoker = on);

REVOKE SELECT ON public.view_time_entries_with_status FROM anon;
GRANT SELECT ON public.view_time_entries_with_status TO authenticated;

COMMENT ON VIEW public.view_time_entries_with_status IS
  'Leitet den Status eines Zeiteintrags aus der Rechnungsverknuepfung ab, mit optionalem '
  'manuellem Override (time_entries.manual_status). Reihenfolge: manual_status > Rechnungsstatus > offen. '
  'security_invoker = on: die RLS des aufrufenden Users wird durchgesetzt.';

-- A2. user_companies: RLS ist hier bewusst deaktiviert (siehe
--     20260129_disable_rls_user_companies.sql), weil die Policies aller anderen
--     Tabellen per Inline-Subquery auf diese Tabelle zugreifen und RLS darauf zu
--     einer Endlosrekursion gefuehrt hat.
--
--     WICHTIG: authenticated MUSS die SELECT-Berechtigung behalten. Die Policies
--     der anderen Tabellen werden mit den Rechten des aufrufenden Users
--     ausgewertet; ohne dieses Recht scheitern sie mit "permission denied for
--     table user_companies" und die App faellt komplett aus.
--     Nur anon wird entzogen - das schliesst das Leck, ohne die Policies zu brechen.
REVOKE ALL ON public.user_companies FROM anon;

-- ============================================================================
-- TEIL B - Haertung. Kein aktives Leck, aber unnoetige Angriffsflaeche.
--
-- Die RPC-Funktionen sind fuer anon aufrufbar, weil PostgreSQL EXECUTE
-- standardmaessig an PUBLIC vergibt. Sie liefern derzeit nichts Verwertbares,
-- da sie alle an auth.uid() haengen (ohne Login = NULL) - getestet am 2026-08-12.
--
-- ACHTUNG: REVOKE ... FROM PUBLIC ist scharf. Es muss von anon entzogen, aber
-- an authenticated und service_role vergeben werden. Nach dem Einspielen
-- unbedingt die App durchklicken: Login, Firmenwechsel, Zeiterfassung,
-- Rechnung erstellen.
-- ============================================================================

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
  LOOP
    -- Erst den Default-Grant an PUBLIC entfernen, dann gezielt zurueckgeben.
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn.signature);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.signature);
  END LOOP;
END $$;

-- ============================================================================
-- VERIFIKATION (im SQL-Editor ausfuehren, Ergebnisse pruefen)
-- ============================================================================
-- Erwartet: security_invoker steht auf on
--   SELECT relname, reloptions FROM pg_class
--   WHERE relname = 'view_time_entries_with_status';
--
-- Erwartet: anon taucht in keiner Zeile auf
--   SELECT grantee, table_name, privilege_type
--   FROM information_schema.role_table_grants
--   WHERE grantee = 'anon' AND table_schema = 'public';
