-- Migration: Anfragen von blauwasser-it.ch als Opportunity ablegen
-- Date: 2026-09-13 (Version 20260912221345 in UTC, so von Supabase verbucht)
--
-- Kontaktformular und Zeitfresser-Check auf blauwasser-it.ch legen jede
-- Anfrage als Opportunity in der Pipeline ab (Spalte "Kontaktaufnahme").
-- Die Website ruft dafuer nur diese eine Funktion auf, mit dem oeffentlichen
-- Anon-Key und einem Geheimnis, das nur bei Vercel liegt. Ohne Geheimnis
-- passiert nichts, anon bekommt sonst keine neuen Rechte.
--
-- Zielfirma und Hash des Geheimnisses stehen in website_ablage.einstellungen.
-- Die Zeile wird von Hand gesetzt, nicht hier: keine IDs und kein Geheimnis
-- im Repository. Gesetzt am 13. September 2026 fuer die Firma
-- "Nicolas Fischer":
--
--   insert into website_ablage.einstellungen (company_id, geheimnis_sha256)
--   values ('<company_id>', '<sha256 von CRM_ABLAGE_GEHEIMNIS>');
--
-- Gegenstueck auf der Website: lib/leads/crm.ts im Repository Blauwasser.

CREATE SCHEMA IF NOT EXISTS website_ablage;
REVOKE ALL ON SCHEMA website_ablage FROM PUBLIC, anon, authenticated;

CREATE TABLE website_ablage.einstellungen (
  -- genau eine Zeile
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  stufe_name text NOT NULL DEFAULT 'Kontaktaufnahme',
  geheimnis_sha256 text NOT NULL CHECK (geheimnis_sha256 ~ '^[0-9a-f]{64}$')
);
REVOKE ALL ON website_ablage.einstellungen FROM PUBLIC, anon, authenticated;
ALTER TABLE website_ablage.einstellungen ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE website_ablage.einstellungen IS
  'Konfiguration fuer public.website_anfrage_ablegen: Zielfirma, Name der Stufe, SHA-256 des Geheimnisses (CRM_ABLAGE_GEHEIMNIS bei Vercel). Fuer anon und authenticated nicht lesbar.';

CREATE OR REPLACE FUNCTION public.website_anfrage_ablegen(geheimnis text, anfrage jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  cfg website_ablage.einstellungen;
  stufe uuid;
  neue_id uuid;
  v_titel text := btrim(coalesce(anfrage->>'titel', ''));
  v_name text := btrim(coalesce(anfrage->>'name', ''));
  v_firma text := btrim(coalesce(anfrage->>'firma', ''));
  v_email text := btrim(coalesce(anfrage->>'email', ''));
  v_telefon text := btrim(coalesce(anfrage->>'telefon', ''));
  v_notiz text := coalesce(anfrage->>'notiz', '');
BEGIN
  SELECT * INTO cfg FROM website_ablage.einstellungen WHERE id;
  IF NOT FOUND
     OR geheimnis IS NULL
     OR encode(extensions.digest(geheimnis, 'sha256'), 'hex') <> cfg.geheimnis_sha256 THEN
    RAISE EXCEPTION 'nicht erlaubt' USING ERRCODE = '42501';
  END IF;

  IF char_length(v_titel) NOT BETWEEN 1 AND 200
     OR char_length(v_name) NOT BETWEEN 1 AND 120
     OR char_length(v_firma) > 160
     OR char_length(v_email) > 254
     OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+$'
     OR char_length(v_telefon) > 40
     OR char_length(v_notiz) > 20000 THEN
    RAISE EXCEPTION 'ungueltige anfrage' USING ERRCODE = '22023';
  END IF;

  -- Die Stufe mit dem eingestellten Namen, sonst die erste Spalte.
  SELECT s.id INTO stufe
    FROM public.pipeline_stages s
   WHERE s.company_id = cfg.company_id
   ORDER BY (s.name = cfg.stufe_name) DESC, s.position ASC
   LIMIT 1;
  IF stufe IS NULL THEN
    RAISE EXCEPTION 'keine stufe' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.opportunities (company_id, prospect_info, title, stage_id, notes)
  VALUES (
    cfg.company_id,
    jsonb_strip_nulls(jsonb_build_object(
      'name', v_name,
      'email', v_email,
      'phone', nullif(v_telefon, ''),
      'company', nullif(v_firma, '')
    )),
    v_titel,
    stufe,
    nullif(v_notiz, '')
  )
  RETURNING id INTO neue_id;

  RETURN neue_id;
END;
$$;

REVOKE ALL ON FUNCTION public.website_anfrage_ablegen(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.website_anfrage_ablegen(text, jsonb) TO anon;

COMMENT ON FUNCTION public.website_anfrage_ablegen(text, jsonb) IS
  'Legt eine Anfrage von blauwasser-it.ch als Opportunity an (prospect_info, title, notes). Nur mit dem Geheimnis aus website_ablage.einstellungen. Einzige Funktion, die anon ausfuehren darf, ohne angemeldet zu sein.';
