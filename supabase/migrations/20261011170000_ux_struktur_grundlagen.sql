-- UX-Struktur (docs/ux-struktur/konzept.md, Abschnitt 7.1 und 7.2)
-- Rueckwaertskompatibel: nur neue Tabellen und neue Spalten mit Standardwert
-- oder NULL. Nichts wird geloescht, umbenannt oder ueberschrieben.

-- ---------------------------------------------------------------------------
-- Einstellungen fuer Cockpit und Masken (1:1 zu companies)
-- Eigene Tabelle statt Spalten in companies: companies traegt die Rechnungs-
-- und PDF-Stammdaten, get_user_companies liefert deren Spalten. Diese Werte
-- sind Ziele und Schaetzungen und lassen sich so getrennt zuruecknehmen.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  weekly_hours_target numeric(5,2) CHECK (weekly_hours_target IS NULL OR weekly_hours_target BETWEEN 0 AND 168),
  ahv_rate numeric(5,2) NOT NULL DEFAULT 10 CHECK (ahv_rate BETWEEN 0 AND 100),
  tax_rate numeric(5,2) CHECK (tax_rate IS NULL OR tax_rate BETWEEN 0 AND 100),
  min_reserve numeric(12,2) CHECK (min_reserve IS NULL OR min_reserve >= 0),
  vat_threshold numeric(12,2) NOT NULL DEFAULT 100000 CHECK (vat_threshold > 0),
  concentration_warn integer NOT NULL DEFAULT 50 CHECK (concentration_warn BETWEEN 1 AND 100),
  concentration_alert integer NOT NULL DEFAULT 70 CHECK (concentration_alert BETWEEN 1 AND 100),
  default_hourly_rate numeric(10,2) CHECK (default_hourly_rate IS NULL OR default_hourly_rate >= 0),
  payment_terms_days integer NOT NULL DEFAULT 30 CHECK (payment_terms_days BETWEEN 0 AND 365),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_revenue_targets (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  year integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  revenue_target numeric(12,2) NOT NULL CHECK (revenue_target >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, year)
);

-- Kontostaende (spaeter durch Bankimport ersetzbar)
CREATE TABLE IF NOT EXISTS public.bank_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  date date NOT NULL,
  amount numeric(12,2) NOT NULL,
  account_label text NOT NULL DEFAULT 'Geschäftskonto' CHECK (char_length(account_label) BETWEEN 1 AND 80),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bank_balances_company_date ON public.bank_balances(company_id, date DESC);

-- Fristen. Beim Erledigen einer wiederkehrenden Frist legt die App die naechste
-- als neue Zeile an; die erledigte bleibt als Verlauf stehen.
CREATE TABLE IF NOT EXISTS public.deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  due_date date NOT NULL,
  recurrence text NOT NULL DEFAULT 'einmalig' CHECK (recurrence IN ('einmalig', 'monatlich', 'quartalsweise', 'jaehrlich')),
  done_at timestamptz,
  note text CHECK (note IS NULL OR char_length(note) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deadlines_company_due ON public.deadlines(company_id, due_date) WHERE done_at IS NULL;

-- Notizen fuer den Zeitstrahl (Firma, Deal oder Projekt)
CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 20000),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notes_hat_bezug CHECK (num_nonnulls(customer_id, opportunity_id, project_id) >= 1)
);
CREATE INDEX IF NOT EXISTS idx_notes_customer ON public.notes(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notes_opportunity ON public.notes(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notes_project ON public.notes(project_id) WHERE project_id IS NOT NULL;

-- RLS: Mandantentrennung ueber user_companies wie bei den bestehenden Tabellen
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['company_settings', 'company_revenue_targets', 'bank_balances', 'deadlines', 'notes'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I', t);
    EXECUTE format($p$CREATE POLICY "Tenant Isolation" ON public.%I FOR ALL TO authenticated
      USING (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()))
      WITH CHECK (company_id IN (SELECT uc.company_id FROM public.user_companies uc WHERE uc.user_id = auth.uid()))$p$, t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS company_settings_updated_at ON public.company_settings;
CREATE TRIGGER company_settings_updated_at BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS company_revenue_targets_updated_at ON public.company_revenue_targets;
CREATE TRIGGER company_revenue_targets_updated_at BEFORE UPDATE ON public.company_revenue_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Neue Spalten
-- ---------------------------------------------------------------------------
-- Wiederkehrende Ausgaben (Fixkosten, Liquiditaetsvorschau)
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS recurrence_interval text
  CHECK (recurrence_interval IS NULL OR recurrence_interval IN ('monatlich', 'quartalsweise', 'jaehrlich'));

-- Wiederkehrender Umsatz, Versanddatum, Herkunft des Zahlungsdatums
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS is_recurring_revenue boolean NOT NULL DEFAULT false;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS sent_at timestamptz;
-- 'erfasst' = echtes Zahlungsdatum, 'faelligkeit' = bewusst vom Faelligkeitsdatum
-- uebernommen (zaehlt nicht in die Zahlungsdauer). NULL = altes Verhalten.
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_at_source text
  CHECK (paid_at_source IS NULL OR paid_at_source IN ('erfasst', 'faelligkeit'));
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS sent_at timestamptz;

-- Leads als Art in opportunities (keine eigene Tabelle, Konzept 2.2 A)
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'deal'
  CHECK (kind IN ('lead', 'deal'));
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS lead_status text
  CHECK (lead_status IS NULL OR lead_status IN ('neu', 'kontaktiert', 'kein_interesse'));
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS source text
  CHECK (source IS NULL OR char_length(source) <= 80);
CREATE INDEX IF NOT EXISTS idx_opportunities_company_kind ON public.opportunities(company_id, kind);

-- Gewichtete Pipeline und Abschlussphase
ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS probability integer
  CHECK (probability IS NULL OR probability BETWEEN 0 AND 100);
ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS is_won boolean NOT NULL DEFAULT false;

-- Rueckbau (nur falls noetig, Daten in neuen Spalten gehen verloren):
--   DROP TABLE public.notes, public.deadlines, public.bank_balances,
--     public.company_revenue_targets, public.company_settings;
--   ALTER TABLE public.transactions DROP COLUMN is_recurring, DROP COLUMN recurrence_interval;
--   ALTER TABLE public.invoices DROP COLUMN is_recurring_revenue, DROP COLUMN sent_at, DROP COLUMN paid_at_source;
--   ALTER TABLE public.quotes DROP COLUMN sent_at;
--   ALTER TABLE public.opportunities DROP COLUMN kind, DROP COLUMN lead_status, DROP COLUMN source;
--   ALTER TABLE public.pipeline_stages DROP COLUMN probability, DROP COLUMN is_won;
