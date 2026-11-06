-- ============================================================================
-- Migration: Eigene Adresse fuer Briefkopf und Fusszeile
-- Date: 2026-11-06
--
-- Der QR-Zahlteil und der Swiss QR Code bleiben unveraendert: sie lesen wie
-- bisher street, house_number, zip_code, city und qr_creditor_name. Diese
-- Felder sind ab jetzt ausschliesslich die Zahlteil-Adresse.
--
-- Neu: letterhead_* fuer Briefkopf, Fensterzeile und Fusszeile von Rechnung
-- und Offerte. address_line1 (bisher ungenutzt) ist der Adresszusatz (c/o)
-- vor der Strasse. Die neuen Felder werden mit den heutigen Werten gefuellt,
-- damit sich kein Dokument veraendert.
--
-- get_user_companies() liefert die neuen Spalten, sonst zeigte das
-- Einstellungsformular sie leer an und speicherte sie leer zurueck.
-- ============================================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS letterhead_street       TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS letterhead_house_number TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS letterhead_zip_code     TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS letterhead_city         TEXT DEFAULT NULL;

COMMENT ON COLUMN public.companies.street IS 'Zahlteil QR-Rechnung und Swiss QR Code. Nur aendern, wenn die Bank informiert ist.';
COMMENT ON COLUMN public.companies.house_number IS 'Zahlteil QR-Rechnung und Swiss QR Code. Nur aendern, wenn die Bank informiert ist.';
COMMENT ON COLUMN public.companies.zip_code IS 'Zahlteil QR-Rechnung und Swiss QR Code. Nur aendern, wenn die Bank informiert ist.';
COMMENT ON COLUMN public.companies.city IS 'Zahlteil QR-Rechnung und Swiss QR Code. Nur aendern, wenn die Bank informiert ist.';
COMMENT ON COLUMN public.companies.address_line1 IS 'Adresszusatz (c/o) im Briefkopf und in der Fusszeile, vor der Strasse.';
COMMENT ON COLUMN public.companies.letterhead_street IS 'Briefkopf und Fusszeile. Leer = Zahlteil-Adresse.';

-- Heutige Werte uebernehmen (nur wo noch leer)
UPDATE public.companies
SET letterhead_street       = street,
    letterhead_house_number = house_number,
    letterhead_zip_code     = zip_code,
    letterhead_city         = city
WHERE letterhead_street IS NULL;

-- RPC um die Briefkopf-Felder erweitern (Rueckgabetyp aendert sich: DROP noetig)
DROP FUNCTION IF EXISTS public.get_user_companies();

CREATE FUNCTION public.get_user_companies()
RETURNS TABLE (
    company_id              UUID,
    company_name            TEXT,
    role                    TEXT,
    is_active               BOOLEAN,
    alternativ_name         TEXT,
    rechnungsname           TEXT,
    logo_url                TEXT,
    sender_contact_name     TEXT,
    street                  TEXT,
    house_number            TEXT,
    zip_code                TEXT,
    city                    TEXT,
    country                 TEXT,
    address_line1           TEXT,
    letterhead_street       TEXT,
    letterhead_house_number TEXT,
    letterhead_zip_code     TEXT,
    letterhead_city         TEXT,
    iban                    TEXT,
    qr_iban                 TEXT,
    qr_creditor_name        TEXT,
    bank_name               TEXT,
    uid_number              TEXT,
    vat_number              TEXT,
    vat_registered          BOOLEAN,
    vat_enabled             BOOLEAN,
    default_vat_rate        NUMERIC,
    phone                   TEXT,
    email                   TEXT,
    website                 TEXT,
    product_categories      JSONB,
    invoice_intro_text      TEXT,
    invoice_footer_text     TEXT,
    quote_intro_text        TEXT,
    quote_footer_text       TEXT,
    created_at              TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    active_company_id UUID;
BEGIN
    active_company_id := public.get_user_company_id();

    RETURN QUERY
    SELECT
        c.id                  AS company_id,
        c.name                AS company_name,
        uc.role::TEXT,
        (c.id = active_company_id) AS is_active,
        c.alternativ_name,
        c.rechnungsname,
        c.logo_url,
        c.sender_contact_name,
        c.street,
        c.house_number,
        c.zip_code,
        c.city,
        c.country,
        c.address_line1,
        c.letterhead_street,
        c.letterhead_house_number,
        c.letterhead_zip_code,
        c.letterhead_city,
        c.iban,
        c.qr_iban,
        c.qr_creditor_name,
        c.bank_name,
        c.uid_number,
        c.vat_number,
        c.vat_registered,
        c.vat_enabled,
        c.default_vat_rate,
        c.phone,
        c.email,
        c.website,
        COALESCE(c.product_categories, '[]'::jsonb),
        c.invoice_intro_text,
        c.invoice_footer_text,
        c.quote_intro_text,
        c.quote_footer_text,
        c.created_at
    FROM public.user_companies uc
    JOIN public.companies c ON uc.company_id = c.id
    WHERE uc.user_id = auth.uid()
    ORDER BY (c.id = active_company_id) DESC, c.name ASC;
END;
$$;

-- Rechte wie nach dem Security-Audit (20260912233000): nur authenticated
REVOKE EXECUTE ON FUNCTION public.get_user_companies() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_companies() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_companies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_companies() TO service_role;
