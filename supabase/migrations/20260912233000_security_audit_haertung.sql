-- Migration: Security-Audit vom 13. September 2026, Datenbank haerten
-- Date: 2026-09-13 (Version 20260912233000 in UTC)
--
-- EINGESPIELT am 13. September 2026 von Nicolas im SQL-Editor von Supabase,
-- danach per SQL verifiziert: RLS auf user_companies an, fuenf Policies,
-- anon darf nur noch website_anfrage_ablegen ausfuehren, keine Tabellenrechte
-- fuer anon, keine Funktion ohne search_path.
--
-- Weil sie von Hand eingespielt wurde, kennt supabase_migrations.schema_migrations
-- diese Version nicht. Vor dem naechsten "supabase db push" darum einmal
--   supabase migration repair --status applied 20260912233000
-- ausfuehren, sonst faehrt der Push sie ein zweites Mal.
--
-- Befunde (Supabase-Advisor und eigene Pruefung):
--   1. public.user_companies hatte RLS aus (seit 20260129090200, wegen
--      Endlosrekursion der selbstbezueglichen Policies). Folge: jeder
--      angemeldete Benutzer konnte alle Zuordnungen lesen und sich selbst als
--      Admin in jede Firma eintragen. Behoben mit einer SECURITY-DEFINER-
--      Hilfsfunktion, die user_companies ohne RLS liest, damit die Policies
--      sich nicht selbst aufrufen.
--   2. anon durfte jede Funktion in public ausfuehren (PostgreSQL-Default) und
--      hatte volle Tabellenrechte (nur durch RLS gebremst). Entzogen; die
--      Website braucht nur website_anfrage_ablegen.
--   3. 13 Funktionen ohne festen search_path. Gesetzt.

-- 1. RLS auf user_companies, ohne Rekursion ------------------------------

CREATE OR REPLACE FUNCTION public.ist_firmenadmin(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_companies uc
     WHERE uc.user_id = auth.uid()
       AND uc.company_id = p_company_id
       AND uc.role = 'admin'
  );
$$;
COMMENT ON FUNCTION public.ist_firmenadmin(uuid) IS
  'Ist der angemeldete Benutzer Admin dieser Firma? Liest user_companies als Besitzer (ohne RLS), damit die Policies auf user_companies sich nicht selbst aufrufen.';

DROP POLICY IF EXISTS "Company admins can add users" ON public.user_companies;
DROP POLICY IF EXISTS "Company admins can remove users" ON public.user_companies;
DROP POLICY IF EXISTS "Company admins can update user roles" ON public.user_companies;
DROP POLICY IF EXISTS "Company admins can view company users" ON public.user_companies;
DROP POLICY IF EXISTS "Users can view their own company assignments" ON public.user_companies;

CREATE POLICY "Mitglied sieht eigene Zuordnungen" ON public.user_companies
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Firmenadmin sieht Mitglieder" ON public.user_companies
  FOR SELECT TO authenticated
  USING (public.ist_firmenadmin(company_id));

CREATE POLICY "Firmenadmin fuegt Mitglieder hinzu" ON public.user_companies
  FOR INSERT TO authenticated
  WITH CHECK (public.ist_firmenadmin(company_id));

CREATE POLICY "Firmenadmin aendert Rollen anderer" ON public.user_companies
  FOR UPDATE TO authenticated
  USING (public.ist_firmenadmin(company_id) AND user_id <> auth.uid())
  WITH CHECK (public.ist_firmenadmin(company_id) AND user_id <> auth.uid());

CREATE POLICY "Firmenadmin entfernt andere" ON public.user_companies
  FOR DELETE TO authenticated
  USING (public.ist_firmenadmin(company_id) AND user_id <> auth.uid());

ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

-- 2. Rechte von anon und PUBLIC entziehen --------------------------------

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn.signature);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.signature);
  END LOOP;
END $$;

-- Die eine Ausnahme: die Ablage von blauwasser-it.ch, nur anon, nur mit Geheimnis.
REVOKE EXECUTE ON FUNCTION public.website_anfrage_ablegen(text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.website_anfrage_ablegen(text, jsonb) TO anon;

-- Der Trigger auf auth.users laeuft als supabase_auth_admin.
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

-- Kuenftige Objekte bekommen anon nicht mehr automatisch.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- 3. Fester search_path ---------------------------------------------------

ALTER FUNCTION public.prevent_critical_profile_changes() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_quotes_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_customer_contacts_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_categories_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_opportunities_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_pipeline_stages_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_transaction_number(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.auto_generate_transaction_number() SET search_path = public, pg_temp;
ALTER FUNCTION public.resolve_hourly_rate(uuid, numeric) SET search_path = public, pg_temp;
ALTER FUNCTION public.update_companies_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_project_open_hours(uuid) SET search_path = public, pg_temp;

-- ============================================================================
-- VERIFIKATION (SQL-Editor)
-- ============================================================================
-- Erwartet: rls = true, 5 Policies
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'user_companies';
--   SELECT policyname FROM pg_policies WHERE tablename = 'user_companies';
-- Erwartet: nur website_anfrage_ablegen
--   SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND has_function_privilege('anon', p.oid, 'EXECUTE');
-- Erwartet: keine Zeile
--   SELECT table_name FROM information_schema.role_table_grants
--    WHERE grantee = 'anon' AND table_schema = 'public';
-- Erwartet als Nicolas: die eigenen zwei Zuordnungen, Firmen und Karten
--   BEGIN; SELECT set_config('request.jwt.claims',
--     '{"sub":"<deine auth.users.id>","role":"authenticated"}', true);
--   SET LOCAL ROLE authenticated;
--   SELECT count(*) FROM public.user_companies;
--   SELECT count(*) FROM public.get_user_companies();
--   SELECT count(*) FROM public.opportunities; ROLLBACK;
