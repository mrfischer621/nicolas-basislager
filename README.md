# nicolas-basislager

Multi-Tenant CRM für Schweizer Einzelfirmen mit integriertem Finanzmanagement, Zeiterfassung, Rechnungsstellung mit Swiss QR-Bill und Offerten-Modul.

## Tech Stack

- **Frontend:** React 19.2 + TypeScript 5.9 + Vite 5.4
- **Styling:** Tailwind CSS 3.4
- **Backend:** Supabase (PostgreSQL + Row-Level Security)
- **Deployment:** Vercel

## Quick Start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # Production build
npm run lint     # ESLint check
```

## Features

| Modul | Beschreibung |
|-------|-------------|
| Dashboard | KPIs, Umsatz-Charts, Quick Actions |
| Sales Pipeline | Kanban-Board mit Drag & Drop |
| Kunden | Kundenverwaltung mit Swiss-Adressen |
| Projekte | Projektverwaltung mit Budgets |
| Zeiterfassung | Stundenerfassung pro Projekt |
| **Angebote** | Offerten mit PDF-Export |
| Rechnungen | Swiss QR-Bill (SPS 2025 v2.3) |
| Buchungen | Einnahmen/Ausgaben-Journal |
| Auswertungen | Finanzanalysen & Charts |

---

## Offerten-Modul (Angebote)

### Übersicht

Vollständiges Angebots-Management mit CRUD, PDF-Export und Konvertierung zu Rechnungen.

### Datenbank-Schema

```sql
-- Tabellen: quotes, quote_items
-- Migration: supabase/migrations/20260131_quotes_module.sql

quotes (
  id, company_id, quote_number,  -- AN-YYYY-NNN Format
  customer_id, project_id, opportunity_id,
  issue_date, valid_until,       -- Gültigkeitsdatum
  subtotal, vat_rate, vat_amount, total,
  status,                        -- offen|versendet|akzeptiert|abgelehnt|bestaetigt|ueberfallig
  converted_to_invoice_id, converted_at
)

quote_items (
  id, quote_id, description, quantity, unit_price, total, sort_order
)
```

### RLS Policies

```sql
-- quotes: Standard company_id Policy
CREATE POLICY "Tenant Isolation" ON quotes
  FOR ALL USING (
    company_id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid())
  );

-- quote_items: JOIN-based Policy (kein company_id)
CREATE POLICY "Tenant Isolation via Quote" ON quote_items
  FOR ALL USING (
    quote_id IN (SELECT id FROM quotes WHERE company_id IN (...))
  );
```

### Status-Workflow

```
offen → versendet → akzeptiert → bestaetigt (nach Konvertierung)
                  ↘ abgelehnt
                  ↘ ueberfallig (valid_until < heute)
```

### PDF-Export

- **Titel:** "ANGEBOT" (nicht "RECHNUNG")
- **Gültigkeitsdatum:** Prominent angezeigt
- **Kein QR-Bill:** Angebote sind keine Zahlungsdokumente
- **Text-Templates:** `company.quote_intro_text` / `quote_footer_text`

### Sales Pipeline Integration

Deals mit bestehendem Kunden haben einen "Angebot"-Button:
```
/angebote?customerId=xxx&opportunityId=yyy
```

### Dateien

| Datei | Beschreibung |
|-------|-------------|
| `src/pages/Angebote.tsx` | Hauptseite mit CRUD |
| `src/components/QuoteForm.tsx` | Formular |
| `src/components/QuoteTable.tsx` | Tabelle mit Status-Badges |
| `src/components/QuoteToInvoiceModal.tsx` | Konvertierung |
| `src/utils/quoteValidation.ts` | Validierung (ohne IBAN) |
| `src/utils/pdfGenerator.ts` | `generateQuotePDF()` |

---

## Architektur

### Multi-Company (Multi-Tenant)

- Table-based RLS (keine Session Variables)
- `user_companies` Junction Table
- Frontend filtert explizit nach `company_id` (Defense in Depth)

### Wichtige Dokumentation

- `CLAUDE.md` - Projekt-Kontext & Guidelines
- `MULTI_COMPANY_IMPLEMENTATION.md` - Multi-Company Architektur
- `ROADMAP_PROMPT.md` - Entwicklungs-Roadmap
- `PDF_GENERATOR_DOCUMENTATION.md` - PDF & QR-Bill

---

## Environment Variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Nie den Service Role Key im Frontend verwenden!**
