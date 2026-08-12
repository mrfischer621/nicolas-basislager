-- ============================================================================
-- QUOTES MODULE - Database Migration
-- Date: 2026-01-31
-- Description: Creates quotes and quote_items tables with RLS policies
-- ============================================================================

-- ============================================================================
-- QUOTES TABLE
-- ============================================================================

CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL,  -- AN-YYYY-NNN Format
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  project_id UUID NULL REFERENCES public.projects(id) ON DELETE SET NULL,
  opportunity_id UUID NULL REFERENCES public.opportunities(id) ON DELETE SET NULL,
  issue_date DATE NOT NULL,
  valid_until DATE NOT NULL,   -- Validity date (Gueltig bis)
  subtotal NUMERIC(10, 2) DEFAULT 0,
  vat_rate NUMERIC(4, 2) DEFAULT 7.7,
  vat_amount NUMERIC(10, 2) DEFAULT 0,
  total NUMERIC(10, 2) DEFAULT 0,
  status TEXT DEFAULT 'offen' CHECK (status IN ('offen', 'versendet', 'akzeptiert', 'abgelehnt', 'bestaetigt', 'ueberfallig')),
  converted_to_invoice_id UUID NULL REFERENCES public.invoices(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id, quote_number)
);

-- Enable RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- RLS Policy for quotes (table-based, no session variables)
CREATE POLICY "Tenant Isolation" ON public.quotes
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- QUOTE ITEMS TABLE
-- ============================================================================

CREATE TABLE public.quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10, 3) DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL,
  total NUMERIC(10, 2) NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

-- RLS Policy for quote_items (JOIN-based via quotes table)
CREATE POLICY "Tenant Isolation via Quote" ON public.quote_items
  FOR ALL
  USING (
    quote_id IN (
      SELECT id FROM public.quotes WHERE company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    quote_id IN (
      SELECT id FROM public.quotes WHERE company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Quotes indexes
CREATE INDEX idx_quotes_company_id ON public.quotes(company_id);
CREATE INDEX idx_quotes_customer_id ON public.quotes(customer_id);
CREATE INDEX idx_quotes_project_id ON public.quotes(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_quotes_opportunity_id ON public.quotes(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX idx_quotes_status ON public.quotes(status);
CREATE INDEX idx_quotes_created_at ON public.quotes(created_at DESC);

-- Quote items indexes
CREATE INDEX idx_quote_items_quote_id ON public.quote_items(quote_id);
CREATE INDEX idx_quote_items_sort_order ON public.quote_items(quote_id, sort_order);

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_quotes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_quotes_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.quotes IS 'Quotes/Offers (Angebote/Offerten) for customers';
COMMENT ON TABLE public.quote_items IS 'Line items for quotes';

COMMENT ON COLUMN public.quotes.quote_number IS 'Unique quote number in AN-YYYY-NNN format';
COMMENT ON COLUMN public.quotes.valid_until IS 'Quote validity date (Gueltig bis)';
COMMENT ON COLUMN public.quotes.status IS 'Quote status: offen, versendet, akzeptiert, abgelehnt, bestaetigt (after conversion), ueberfallig';
COMMENT ON COLUMN public.quotes.converted_to_invoice_id IS 'Reference to invoice if quote was converted';
COMMENT ON COLUMN public.quotes.converted_at IS 'Timestamp when quote was converted to invoice';
