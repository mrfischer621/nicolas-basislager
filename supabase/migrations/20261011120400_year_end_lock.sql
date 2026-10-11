-- Migration: Jahresabschluss sperren, Entsperren mit Grund, unveraenderbares Protokoll (Punkt 3B)
--
-- Anforderungen (Entscheid 11.10.2026, Art. 958f OR, GeBueV Art. 3, 8, 9):
--   * Ein abgeschlossenes Jahr ist schreibgeschuetzt: Buchungen mit Datum in
--     einem gesperrten Jahr lassen sich weder anlegen, aendern noch loeschen.
--   * Beim Sperren wird ein SHA-256-Hash ueber alle Buchungen und bezahlten
--     Rechnungen des Jahres sowie die Abschlussdaten gespeichert.
--   * Entsperren nur mit Grund. Protokolliert werden Zeitpunkt, Benutzer,
--     Grund und der Hash vor dem Entsperren. Erneutes Sperren berechnet einen
--     neuen Hash. Das Protokoll ist unveraenderbar (kein UPDATE/DELETE).
--
-- Rueckwaertskompatibel: Sperren per UPDATE status='locked' (so macht es die
-- heutige App) funktioniert weiter, Hash und Protokoll setzt der Trigger.
-- Einzige bewusste Verschaerfung: Entsperren geht nur noch ueber die Funktion
-- unlock_year_end_closing(id, grund). Stand 11.10.2026 ist kein Jahr gesperrt.

-- 1. Spalte fuer den Hash ----------------------------------------------------

ALTER TABLE public.year_end_closings
  ADD COLUMN IF NOT EXISTS snapshot_hash text NULL;

COMMENT ON COLUMN public.year_end_closings.snapshot_hash IS
  'SHA-256 ueber Buchungen, bezahlte Rechnungen und Abschlussdaten beim Sperren';

-- 2. Protokoll ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.year_end_closing_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id  uuid NOT NULL,
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  year        integer NOT NULL,
  action      text NOT NULL CHECK (action IN ('lock', 'unlock')),
  hash        text NOT NULL,
  reason      text NULL,
  user_id     uuid NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (action <> 'unlock' OR length(btrim(reason)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_year_end_closing_log_company_year
  ON public.year_end_closing_log (company_id, year, created_at);

ALTER TABLE public.year_end_closing_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Isolation (lesen)" ON public.year_end_closing_log;
CREATE POLICY "Tenant Isolation (lesen)" ON public.year_end_closing_log
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()));

-- Schreiben nur ueber die Trigger-Funktion (SECURITY DEFINER), nie direkt
REVOKE ALL ON public.year_end_closing_log FROM anon, authenticated;
GRANT SELECT ON public.year_end_closing_log TO authenticated;

-- Unveraenderbar. Ausnahme: Die ganze Firma wird geloescht (ON DELETE CASCADE),
-- dann existiert die Firma beim Ausfuehren nicht mehr.
CREATE OR REPLACE FUNCTION public.year_end_closing_log_unveraenderbar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = OLD.company_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Das Protokoll der Jahresabschluesse ist unveraenderbar.'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS trg_year_end_closing_log_unveraenderbar ON public.year_end_closing_log;
CREATE TRIGGER trg_year_end_closing_log_unveraenderbar
  BEFORE UPDATE OR DELETE ON public.year_end_closing_log
  FOR EACH ROW EXECUTE FUNCTION public.year_end_closing_log_unveraenderbar();

-- 3. Hash ueber ein Geschaeftsjahr ---------------------------------------------

CREATE OR REPLACE FUNCTION public.jahresabschluss_hash(p_company_id uuid, p_year integer, p_data jsonb)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT encode(sha256(convert_to(
    coalesce((
      SELECT string_agg(concat_ws('|', t.id, t.type, t.date, t.amount, t.category, t.counterparty,
                                  t.description, t.transaction_number, t.receipt_url), E'\n' ORDER BY t.id)
        FROM public.transactions t
       WHERE t.company_id = p_company_id
         AND t.date BETWEEN make_date(p_year, 1, 1) AND make_date(p_year, 12, 31)
    ), '') || E'\n#rechnungen\n' ||
    coalesce((
      SELECT string_agg(concat_ws('|', i.id, i.invoice_number, i.total, i.paid_at), E'\n' ORDER BY i.id)
        FROM public.invoices i
       WHERE i.company_id = p_company_id
         AND i.status = 'bezahlt'
         AND (i.paid_at AT TIME ZONE 'Europe/Zurich')::date
             BETWEEN make_date(p_year, 1, 1) AND make_date(p_year, 12, 31)
    ), '') || E'\n#daten\n' || coalesce(p_data::text, ''),
  'UTF8')), 'hex');
$$;

-- Nur fuer die Trigger (laufen als Eigentuemer), nicht direkt aufrufbar
REVOKE EXECUTE ON FUNCTION public.jahresabschluss_hash(uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;

-- 4. Status-Wechsel des Jahresabschlusses ----------------------------------------

CREATE OR REPLACE FUNCTION public.year_end_closing_status_pruefen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reason text := nullif(btrim(current_setting('crm.entsperr_grund', true)), '');
  v_hash   text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'locked'
       AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = OLD.company_id) THEN
      RAISE EXCEPTION 'Das Jahr % ist abgeschlossen und kann nicht geloescht werden.', OLD.year
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'locked' THEN
      NEW.locked_at := now();
      NEW.snapshot_hash := public.jahresabschluss_hash(NEW.company_id, NEW.year, NEW.data);
      INSERT INTO public.year_end_closing_log (closing_id, company_id, year, action, hash, user_id)
      VALUES (NEW.id, NEW.company_id, NEW.year, 'lock', NEW.snapshot_hash, auth.uid());
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.company_id <> OLD.company_id OR NEW.year <> OLD.year THEN
    RAISE EXCEPTION 'Firma und Jahr eines Jahresabschlusses sind fest.';
  END IF;

  IF OLD.status = 'locked' AND NEW.status = 'locked' THEN
    IF NEW.data IS DISTINCT FROM OLD.data OR NEW.final_profit IS DISTINCT FROM OLD.final_profit
       OR NEW.snapshot_hash IS DISTINCT FROM OLD.snapshot_hash OR NEW.locked_at IS DISTINCT FROM OLD.locked_at THEN
      RAISE EXCEPTION 'Das Jahr % ist abgeschlossen. Zum Aendern zuerst mit Grund entsperren.', OLD.year
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'draft' AND NEW.status = 'locked' THEN
    NEW.locked_at := now();
    NEW.snapshot_hash := public.jahresabschluss_hash(NEW.company_id, NEW.year, NEW.data);
    INSERT INTO public.year_end_closing_log (closing_id, company_id, year, action, hash, user_id)
    VALUES (NEW.id, NEW.company_id, NEW.year, 'lock', NEW.snapshot_hash, auth.uid());
    RETURN NEW;
  END IF;

  IF OLD.status = 'locked' AND NEW.status = 'draft' THEN
    IF v_reason IS NULL THEN
      RAISE EXCEPTION 'Entsperren nur mit Grund (Funktion unlock_year_end_closing).'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    -- Hash unmittelbar vor dem Entsperren: Zeigt, ob seit dem Sperren etwas
    -- veraendert wurde (Vergleich mit dem Hash beim Sperren).
    v_hash := public.jahresabschluss_hash(OLD.company_id, OLD.year, OLD.data);
    INSERT INTO public.year_end_closing_log (closing_id, company_id, year, action, hash, reason, user_id)
    VALUES (OLD.id, OLD.company_id, OLD.year, 'unlock', v_hash, v_reason, auth.uid());
    NEW.locked_at := NULL;
    NEW.snapshot_hash := NULL;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_year_end_closing_status ON public.year_end_closings;
CREATE TRIGGER trg_year_end_closing_status
  BEFORE INSERT OR UPDATE OR DELETE ON public.year_end_closings
  FOR EACH ROW EXECUTE FUNCTION public.year_end_closing_status_pruefen();

-- 5. Entsperren mit Grund ----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.unlock_year_end_closing(p_closing_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Bitte einen Grund fuer das Entsperren angeben (mindestens 5 Zeichen).';
  END IF;
  PERFORM set_config('crm.entsperr_grund', btrim(p_reason), true);
  -- RLS von year_end_closings greift (SECURITY INVOKER): nur eigene Firmen
  UPDATE public.year_end_closings
     SET status = 'draft'
   WHERE id = p_closing_id
     AND status = 'locked';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jahresabschluss nicht gefunden oder nicht gesperrt.';
  END IF;
  PERFORM set_config('crm.entsperr_grund', '', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.unlock_year_end_closing(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlock_year_end_closing(uuid, text) TO authenticated;

-- 6. Buchungen in gesperrten Jahren sperren -----------------------------------------

CREATE OR REPLACE FUNCTION public.buchung_gesperrtes_jahr_pruefen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND EXISTS (
       SELECT 1 FROM public.year_end_closings y
        WHERE y.company_id = OLD.company_id
          AND y.year = extract(year FROM OLD.date)::int
          AND y.status = 'locked') THEN
    RAISE EXCEPTION 'Das Jahr % ist abgeschlossen. Buchungen darin koennen nicht geaendert oder geloescht werden.',
      extract(year FROM OLD.date)::int USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND EXISTS (
       SELECT 1 FROM public.year_end_closings y
        WHERE y.company_id = NEW.company_id
          AND y.year = extract(year FROM NEW.date)::int
          AND y.status = 'locked') THEN
    RAISE EXCEPTION 'Das Jahr % ist abgeschlossen. Darin koennen keine Buchungen erfasst werden.',
      extract(year FROM NEW.date)::int USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_buchung_gesperrtes_jahr ON public.transactions;
CREATE TRIGGER trg_buchung_gesperrtes_jahr
  BEFORE INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.buchung_gesperrtes_jahr_pruefen();

-- 7. Bezahlte Rechnungen eines gesperrten Jahres (Einnahmen) ebenfalls sperren --

CREATE OR REPLACE FUNCTION public.rechnung_gesperrtes_jahr_pruefen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_year int := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') AND OLD.status = 'bezahlt' AND OLD.paid_at IS NOT NULL
                         THEN extract(year FROM (OLD.paid_at AT TIME ZONE 'Europe/Zurich'))::int END;
  v_new_year int := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') AND NEW.status = 'bezahlt' AND NEW.paid_at IS NOT NULL
                         THEN extract(year FROM (NEW.paid_at AT TIME ZONE 'Europe/Zurich'))::int END;
BEGIN
  -- Unveraenderte Zahlungsdaten: nichts zu pruefen (z.B. Notizen an der Rechnung)
  IF TG_OP = 'UPDATE'
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.paid_at IS NOT DISTINCT FROM OLD.paid_at
     AND NEW.total IS NOT DISTINCT FROM OLD.total
     AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id THEN
    RETURN NEW;
  END IF;

  IF v_old_year IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.year_end_closings y
        WHERE y.company_id = OLD.company_id AND y.year = v_old_year AND y.status = 'locked') THEN
    RAISE EXCEPTION 'Das Jahr % ist abgeschlossen. Bezahlte Rechnungen darin koennen nicht geaendert werden.', v_old_year
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_new_year IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.year_end_closings y
        WHERE y.company_id = NEW.company_id AND y.year = v_new_year AND y.status = 'locked') THEN
    RAISE EXCEPTION 'Das Jahr % ist abgeschlossen. Darin kann kein Zahlungseingang erfasst werden.', v_new_year
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rechnung_gesperrtes_jahr ON public.invoices;
CREATE TRIGGER trg_rechnung_gesperrtes_jahr
  BEFORE INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.rechnung_gesperrtes_jahr_pruefen();

-- Trigger-Funktionen nicht direkt aufrufbar machen
REVOKE EXECUTE ON FUNCTION public.rechnung_gesperrtes_jahr_pruefen() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.year_end_closing_log_unveraenderbar() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.year_end_closing_status_pruefen() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.buchung_gesperrtes_jahr_pruefen() FROM PUBLIC, anon, authenticated;
