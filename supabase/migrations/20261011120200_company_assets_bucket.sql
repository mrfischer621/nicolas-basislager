-- Migration: Oeffentlicher Bucket company-assets fuer Firmenlogos (Punkt 6)
--
-- Logos lagen bisher bei externen Hostern (postimg.cc, Webflow-CDN). Seit die
-- Content-Security-Policy nur noch Supabase erlaubt (16.09.2026), konnte die
-- App sie fuer die PDFs nicht mehr laden. Neu liegen sie in Supabase Storage:
--
--   company-assets/{company_id}/logo.{png|jpg}
--
-- Lesen: oeffentlich (public bucket, Logo steht ohnehin auf jeder Rechnung).
-- Schreiben: nur angemeldete Mitglieder der jeweiligen Firma (RLS).
-- SVG wird im Browser vor dem Upload in PNG umgewandelt (jsPDF kann kein
-- SVG); der Bucket nimmt darum nur PNG und JPEG an. Das schliesst auch
-- Script-Inhalte in SVG-Dateien auf einer oeffentlichen URL aus.
--
-- Rueckwaertskompatibel: neuer Bucket, neue Policies, nichts geaendert.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('company-assets', 'company-assets', true, 2097152, ARRAY['image/png', 'image/jpeg'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "company-assets: Mitglieder lesen" ON storage.objects;
DROP POLICY IF EXISTS "company-assets: Mitglieder laden hoch" ON storage.objects;
DROP POLICY IF EXISTS "company-assets: Mitglieder ersetzen" ON storage.objects;
DROP POLICY IF EXISTS "company-assets: Mitglieder loeschen" ON storage.objects;

-- SELECT wird fuer upsert (Logo ersetzen) gebraucht; der oeffentliche
-- Download ueber /object/public/ laeuft ohne Policy.
CREATE POLICY "company-assets: Mitglieder lesen" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'company-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT uc.company_id::text FROM public.user_companies uc WHERE uc.user_id = auth.uid()
    )
  );

CREATE POLICY "company-assets: Mitglieder laden hoch" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT uc.company_id::text FROM public.user_companies uc WHERE uc.user_id = auth.uid()
    )
  );

CREATE POLICY "company-assets: Mitglieder ersetzen" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT uc.company_id::text FROM public.user_companies uc WHERE uc.user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'company-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT uc.company_id::text FROM public.user_companies uc WHERE uc.user_id = auth.uid()
    )
  );

CREATE POLICY "company-assets: Mitglieder loeschen" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT uc.company_id::text FROM public.user_companies uc WHERE uc.user_id = auth.uid()
    )
  );
