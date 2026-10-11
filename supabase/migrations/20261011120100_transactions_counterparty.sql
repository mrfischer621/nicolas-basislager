-- Migration: Lieferant / Zahler pro Buchung (Punkt 1, CRM-Anpassungen Okt. 2026)
--
-- Freitext, an wen bezahlt oder von wem Geld erhalten wurde (z.B. Anthropic,
-- Infomaniak). Bewusst keine eigene Lieferanten-Tabelle: Ein spaeterer Wechsel
-- auf eine Tabelle (mit MWST-Nummer) geht ueber eine zusaetzliche Spalte
-- counterparty_id und einen einmaligen Abgleich ueber lower(counterparty).
--
-- Rueckwaertskompatibel: neue, nullbare Spalte; die live laufende App ignoriert sie.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS counterparty text NULL;

COMMENT ON COLUMN public.transactions.counterparty IS
  'Lieferant (bei Ausgaben) bzw. Zahler (bei Einnahmen), Freitext';

-- Vorschlaege und Suche pro Firma, Gross-/Kleinschreibung egal
CREATE INDEX IF NOT EXISTS idx_transactions_company_counterparty
  ON public.transactions (company_id, lower(counterparty))
  WHERE counterparty IS NOT NULL;
