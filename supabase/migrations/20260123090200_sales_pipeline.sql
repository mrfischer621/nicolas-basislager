-- =====================================================
-- Sales Pipeline Module
-- Created: 2026-01-23
-- Purpose: Opportunity tracking (Akquise) with Kanban workflow
-- =====================================================

-- =====================================================
-- 1. PIPELINE STAGES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  color TEXT NOT NULL DEFAULT '#6B7280',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Key (implicit, enforced by RLS)
  -- company_id references companies(id)

  -- Constraints
  CONSTRAINT pipeline_stages_name_check CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
  CONSTRAINT pipeline_stages_position_check CHECK (position >= 0),
  CONSTRAINT pipeline_stages_unique_position UNIQUE (company_id, position)
);

-- Indexes for performance
CREATE INDEX idx_pipeline_stages_company_id ON public.pipeline_stages(company_id);
CREATE INDEX idx_pipeline_stages_position ON public.pipeline_stages(company_id, position);

COMMENT ON TABLE public.pipeline_stages IS 'Sales pipeline stages for Kanban board (company-specific)';
COMMENT ON COLUMN public.pipeline_stages.position IS 'Order position for Kanban columns (0-based)';
COMMENT ON COLUMN public.pipeline_stages.color IS 'Hex color code for stage badge';


-- =====================================================
-- 2. OPPORTUNITIES TABLE (The Deal)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,

  -- Customer Linking (NULL = prospect, UUID = existing customer)
  existing_customer_id UUID NULL,

  -- Prospect Information (for leads without customer account)
  prospect_info JSONB NULL DEFAULT NULL,

  -- Deal Details
  title TEXT NOT NULL,
  stage_id UUID NOT NULL,
  expected_value NUMERIC(10, 2) NULL,

  -- Activity Tracking
  last_contact_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_action_date DATE NULL,
  notes TEXT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Foreign Keys (implicit, enforced by RLS)
  -- company_id references companies(id)
  -- existing_customer_id references customers(id)
  -- stage_id references pipeline_stages(id)

  -- Constraints
  CONSTRAINT opportunities_title_check CHECK (char_length(title) >= 1 AND char_length(title) <= 200),
  CONSTRAINT opportunities_customer_xor_prospect CHECK (
    (existing_customer_id IS NOT NULL AND prospect_info IS NULL) OR
    (existing_customer_id IS NULL AND prospect_info IS NOT NULL)
  )
);

-- Indexes for performance
CREATE INDEX idx_opportunities_company_id ON public.opportunities(company_id);
CREATE INDEX idx_opportunities_stage_id ON public.opportunities(stage_id);
CREATE INDEX idx_opportunities_customer_id ON public.opportunities(existing_customer_id);
CREATE INDEX idx_opportunities_last_contact ON public.opportunities(company_id, last_contact_at DESC);

COMMENT ON TABLE public.opportunities IS 'Sales opportunities/deals with prospect or customer linking';
COMMENT ON COLUMN public.opportunities.prospect_info IS 'JSONB: {name: string, email?: string, phone?: string, company?: string}';
COMMENT ON COLUMN public.opportunities.last_contact_at IS 'Last interaction timestamp - used for stale detection (>14 days)';
COMMENT ON CONSTRAINT opportunities_customer_xor_prospect ON public.opportunities IS 'Deal must link to EITHER existing customer OR prospect info (XOR logic)';


-- =====================================================
-- 3. AUTO-UPDATE TIMESTAMPS TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_opportunities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_opportunities_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunities_updated_at();

CREATE OR REPLACE FUNCTION update_pipeline_stages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pipeline_stages_updated_at
  BEFORE UPDATE ON public.pipeline_stages
  FOR EACH ROW
  EXECUTE FUNCTION update_pipeline_stages_updated_at();


-- =====================================================
-- 4. ROW-LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- Pipeline Stages Policies
CREATE POLICY "Tenant Isolation - pipeline_stages"
  ON public.pipeline_stages
  FOR ALL
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- Opportunities Policies
CREATE POLICY "Tenant Isolation - opportunities"
  ON public.opportunities
  FOR ALL
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());


-- =====================================================
-- 5. SEED DATA (Default Pipeline Stages)
-- =====================================================

-- Insert default stages for ALL existing companies
-- This ensures every company gets the standard pipeline
INSERT INTO public.pipeline_stages (company_id, name, position, color)
SELECT
  c.id,
  stage.name,
  stage.position,
  stage.color
FROM
  public.companies c
CROSS JOIN (
  VALUES
    ('Recherche', 0, '#6B7280'),       -- Gray
    ('Kontaktaufnahme', 1, '#3B82F6'), -- Blue
    ('Bedarfsanalyse', 2, '#8B5CF6'),  -- Purple
    ('Angebot', 3, '#F59E0B'),         -- Amber
    ('Verhandlung', 4, '#EF4444'),     -- Red
    ('Gewonnen', 5, '#10B981')         -- Green
) AS stage(name, position, color)
ON CONFLICT DO NOTHING;

-- Note: For new companies created after this migration,
-- use the application layer to create default stages on company registration


-- =====================================================
-- 6. CONVERSION FUNCTION (Prospect → Customer)
-- =====================================================

CREATE OR REPLACE FUNCTION public.convert_prospect_to_customer(
  opportunity_id_param UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- CRITICAL: Prevents search path injection attacks
AS $$
DECLARE
  v_opportunity RECORD;
  v_customer_id UUID;
  v_user_company_id UUID;
BEGIN
  -- Get user's company_id for security check
  v_user_company_id := get_user_company_id();

  -- Fetch opportunity with RLS check
  SELECT * INTO v_opportunity
  FROM public.opportunities
  WHERE id = opportunity_id_param
    AND company_id = v_user_company_id;  -- SECURITY: Manual check in SECURITY DEFINER

  -- Validate opportunity exists and belongs to user's company
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Opportunity not found or access denied'
      USING ERRCODE = '42501';
  END IF;

  -- Validate opportunity has prospect_info (not already a customer)
  IF v_opportunity.existing_customer_id IS NOT NULL THEN
    RAISE EXCEPTION 'Opportunity is already linked to an existing customer'
      USING ERRCODE = '23514';
  END IF;

  IF v_opportunity.prospect_info IS NULL THEN
    RAISE EXCEPTION 'No prospect information available for conversion'
      USING ERRCODE = '23514';
  END IF;

  -- Create customer from prospect_info
  INSERT INTO public.customers (
    company_id,
    name,
    contact_person,
    email,
    phone,
    created_at
  ) VALUES (
    v_user_company_id,
    COALESCE(v_opportunity.prospect_info->>'name', v_opportunity.prospect_info->>'company', 'Unnamed Customer'),
    v_opportunity.prospect_info->>'contact_person',
    v_opportunity.prospect_info->>'email',
    v_opportunity.prospect_info->>'phone',
    now()
  )
  RETURNING id INTO v_customer_id;

  -- Update opportunity: link to new customer, clear prospect_info
  UPDATE public.opportunities
  SET
    existing_customer_id = v_customer_id,
    prospect_info = NULL,
    updated_at = now()
  WHERE id = opportunity_id_param;

  -- Return new customer_id
  RETURN v_customer_id;
END;
$$;

COMMENT ON FUNCTION public.convert_prospect_to_customer IS
  'Converts a prospect opportunity into a customer account. Returns new customer_id. SECURITY DEFINER with search_path protection.';


-- =====================================================
-- 7. GRANT PERMISSIONS
-- =====================================================

-- Grant access to authenticated users (RLS will enforce tenant isolation)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_stages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities TO authenticated;

-- Grant execute on conversion function
GRANT EXECUTE ON FUNCTION public.convert_prospect_to_customer TO authenticated;


-- =====================================================
-- END OF MIGRATION
-- =====================================================
