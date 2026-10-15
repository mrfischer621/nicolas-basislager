-- Migration: Security-Audit vom 15. Oktober 2026, Datenbank nachhaerten
-- Date: 2026-10-15
--
-- EINGESPIELT am 15. Oktober 2026 per SQL (Supabase-MCP, execute_sql), danach
-- verifiziert: Schema test_attack weg, authenticated darf nur noch die zehn
-- RPC-Funktionen ausfuehren, receipts hat 10 MB und sechs MIME-Typen.
-- Wie die Haertung vom 13. September kennt schema_migrations diese Version
-- nicht. Vor dem naechsten "supabase db push" einmal
--   supabase migration repair --status applied 20261015170000
-- ausfuehren, sonst faehrt der Push sie ein zweites Mal (harmlos, aber unnoetig).
--
-- Befunde (Bericht 05_DEV/SECURITY-AUDIT-2026-10-15.md, Punkte M3, M4, M5):
--   M3. Schema test_attack aus dem Search-Path-Test vom Januar liegt noch in
--       der Produktion. Weg damit.
--   M4. Trigger-Funktionen waren fuer authenticated per RPC aufrufbar
--       (Advisor 0029). Ein Trigger braucht dieses Recht zur Laufzeit nicht,
--       das wurde am 15. Oktober 2026 in einer Transaktion mit SET ROLE
--       authenticated nachgewiesen (UPDATE auf opportunities lief nach dem
--       REVOKE durch). handle_new_user behaelt supabase_auth_admin.
--   M5. Bucket receipts hatte weder Groessenlimit noch MIME-Liste. Bestand am
--       15. Oktober 2026: 47 Objekte, PDF und JPEG, groesstes 2 MB.
--       HEIC/HEIF bleibt erlaubt, weil accept="image/*" am Handy auch das
--       liefern kann; iOS wandelt beim Upload meist in JPEG, aber nicht immer.

-- M3 -----------------------------------------------------------------------
DROP SCHEMA IF EXISTS test_attack CASCADE;

-- M4 -----------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_self_role_escalation() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_critical_profile_changes() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_user_companies_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_categories_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_companies_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_customer_contacts_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_opportunities_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_pipeline_stages_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_quotes_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_generate_transaction_number() FROM authenticated;

-- M5 -----------------------------------------------------------------------
UPDATE storage.buckets
   SET file_size_limit = 10485760,  -- 10 MB
       allowed_mime_types = ARRAY[
         'application/pdf',
         'image/jpeg',
         'image/png',
         'image/webp',
         'image/heic',
         'image/heif'
       ]
 WHERE id = 'receipts';

-- ============================================================================
-- VERIFIKATION (SQL-Editor)
-- ============================================================================
-- Erwartet: keine Zeile
--   SELECT nspname FROM pg_namespace WHERE nspname = 'test_attack';
-- Erwartet: nur Funktionen, die die App per RPC aufruft (get_user_companies,
-- set_active_company, create_company_with_admin, convert_prospect_to_customer,
-- generate_transaction_number, get_project_open_hours, resolve_hourly_rate,
-- unlock_year_end_closing, get_user_company_id, ist_firmenadmin)
--   SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND has_function_privilege('authenticated', p.oid, 'EXECUTE');
-- Erwartet: 10485760 und sechs MIME-Typen
--   SELECT file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'receipts';
