-- Pipeline-Phasen und Leads (docs/ux-struktur/konzept.md, Abschnitt 7.3)
-- Freigegeben am 11.10.2026. Keine IDs im Repository: Die betroffene Firma
-- ist die Zielfirma der Website-Ablage (website_ablage.einstellungen).
-- Nichts wird geloescht; Stufen-IDs bleiben, kein Deal wechselt die Stufe.

-- Lead-Stufe: nimmt Leads auf und erscheint nicht im Board
ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS is_lead_stage boolean NOT NULL DEFAULT false;

DO $$
DECLARE
  v_company uuid;
  v_recherche uuid;
  v_leads integer;
BEGIN
  SELECT company_id INTO v_company FROM website_ablage.einstellungen WHERE id;
  IF v_company IS NULL THEN
    RAISE NOTICE 'Keine Zielfirma der Website-Ablage, Pipeline bleibt unveraendert';
    RETURN;
  END IF;

  SELECT id INTO v_recherche FROM public.pipeline_stages WHERE company_id = v_company AND name = 'Recherche';
  IF v_recherche IS NOT NULL THEN
    UPDATE public.pipeline_stages SET is_lead_stage = true WHERE id = v_recherche;
    -- Die Recherche-Eintraege werden Leads (Status neu, Quelle Recherche)
    UPDATE public.opportunities
       SET kind = 'lead', lead_status = 'neu', source = coalesce(source, 'Recherche')
     WHERE company_id = v_company AND stage_id = v_recherche AND kind = 'deal';
    GET DIAGNOSTICS v_leads = ROW_COUNT;
    RAISE NOTICE '% Eintraege aus Recherche sind jetzt Leads', v_leads;
  END IF;

  UPDATE public.pipeline_stages SET name = 'Erstgespräch' WHERE company_id = v_company AND name = 'Kontaktaufnahme';
  UPDATE public.pipeline_stages SET name = 'Analyse' WHERE company_id = v_company AND name = 'Bedarfsanalyse';
  UPDATE public.pipeline_stages SET name = 'Offerte' WHERE company_id = v_company AND name = 'Angebot';

  UPDATE public.pipeline_stages
     SET probability = CASE name
       WHEN 'Erstgespräch' THEN 10 WHEN 'Analyse' THEN 30 WHEN 'Offerte' THEN 50
       WHEN 'Verhandlung' THEN 70 WHEN 'Gewonnen' THEN 100 END
   WHERE company_id = v_company AND NOT is_lead_stage;

  -- Website-Anfragen landen kuenftig als Lead in der Lead-Stufe
  UPDATE website_ablage.einstellungen SET stufe_name = 'Recherche' WHERE id;
END $$;

-- Uebrige Firmen (Freiluftchuchi): Namen bleiben, nur Wahrscheinlichkeiten
UPDATE public.pipeline_stages s
   SET probability = CASE s.name
     WHEN 'Kontaktaufnahme' THEN 10 WHEN 'Bedarfsanalyse' THEN 30 WHEN 'Offeriert' THEN 50
     WHEN 'Angebot' THEN 50 WHEN 'Verhandlung' THEN 70 WHEN 'Gewonnen' THEN 100 END
 WHERE s.probability IS NULL
   AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = s.company_id);

UPDATE public.pipeline_stages s SET is_won = true
 WHERE s.name = 'Gewonnen' AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = s.company_id);

-- Website-Anfragen als Lead (Konzept 2.2 A, Variante 2). Signatur unveraendert.
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

  -- Lead-Stufe, sonst die Stufe mit dem eingestellten Namen, sonst die erste
  SELECT s.id INTO stufe
    FROM public.pipeline_stages s
   WHERE s.company_id = cfg.company_id
   ORDER BY s.is_lead_stage DESC, (s.name = cfg.stufe_name) DESC, s.position ASC
   LIMIT 1;
  IF stufe IS NULL THEN
    RAISE EXCEPTION 'keine stufe' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.opportunities (company_id, prospect_info, title, stage_id, notes, kind, lead_status, source)
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
    nullif(v_notiz, ''),
    'lead',
    'neu',
    'Website'
  )
  RETURNING id INTO neue_id;

  RETURN neue_id;
END;
$$;

REVOKE ALL ON FUNCTION public.website_anfrage_ablegen(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.website_anfrage_ablegen(text, jsonb) TO anon;

-- Ruecknahme (falls noetig):
--   UPDATE public.pipeline_stages SET name = 'Kontaktaufnahme' WHERE name = 'Erstgespräch';
--   UPDATE public.pipeline_stages SET name = 'Bedarfsanalyse' WHERE name = 'Analyse';
--   UPDATE public.pipeline_stages SET name = 'Angebot' WHERE name = 'Offerte' AND is_lead_stage = false;
--   UPDATE public.opportunities SET kind = 'deal' WHERE kind = 'lead';
--   UPDATE website_ablage.einstellungen SET stufe_name = 'Kontaktaufnahme';
--   Funktion website_anfrage_ablegen aus 20260912221345 erneut einspielen.
