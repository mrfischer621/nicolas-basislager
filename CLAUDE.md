# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**nicolas-basislager** - Multi-tenant CRM application for Swiss businesses with integrated financial management, time tracking, invoicing with Swiss QR-Bill generation, and year-end closing capabilities.

## Tech Stack

- **Frontend:** React 19.2.0 + TypeScript 5.9.3 + Vite 5.4.11
- **Styling:** Tailwind CSS 3.4.17
- **Backend/Database:** Supabase (PostgreSQL with Row-Level Security)
- **Deployment:** Vercel with SPA routing
- **Node Requirements:** Node >=20.x, npm >=10.x

## Development Commands

```bash
# Development
npm run dev          # Start Vite dev server on http://localhost:5173

# Build & Quality
npm run build        # TypeScript check + Vite production build → /dist
npm run lint         # Run ESLint on entire project
npm run preview      # Preview production build locally
```

## Architecture

### State Management Pattern

```
App (React Router)
└── AuthProvider (Session management)
    └── CompanyProvider (Multi-tenancy context)
        └── ProtectedRoute (Auth guard)
            └── Layout (Sidebar + Navigation)
                └── Pages (Dashboard, Kunden, Rechnungen, etc.)
```

### Database Schema (Multi-Tenant)

All tables scoped by `company_id` foreign key for tenant isolation:

- **companies** - Company profiles with Swiss banking details (IBAN, QR-IBAN)
- **profiles** - User-to-company mapping (auth.users → companies)
- **customers** - Clients with structured Swiss addresses (QR-Bill compliant)
- **projects** - Project tracking with budgets
- **time_entries** - Billable time logs
- **invoices** - Invoice headers (status: entwurf/versendet/bezahlt/überfällig)
- **invoice_items** - Line items (no company_id, uses JOIN-based RLS)
- **transactions** - Financial journal with flexible tagging
- **expenses** - Expense tracking
- **products** - Product/service catalog
- **year_end_closings** - Annual closing with assets & provisions

### Row-Level Security (RLS)

**CRITICAL:** All tables use RLS policies based on `get_user_company_id()` function.

- Users can ONLY access data from their own company
- The Service Role key bypasses RLS - NEVER expose to frontend
- Frontend must use ANON key from environment variables
- Invoice items use JOIN-based policies through `invoices` table

**Migration Files:** `/supabase/migrations/`
- `20260122_security_overhaul.sql` - Multi-tenant RLS setup
- `20260122_enforce_rls.sql` - Strict policy enforcement

### Swiss Compliance Features

**QR-Bill Generation (SPS 2025 v2.3 Standard):**
- Structured addresses (K=combined, S=structured)
- IBAN and QR-IBAN support
- Latin-1 character encoding restrictions
- Implementation: `/src/utils/swissqr.ts`
- PDF generation: `/src/utils/pdfGenerator.ts`

**Documentation:**
- `PDF_GENERATOR_DOCUMENTATION.md`
- `SWISSQR_IMPLEMENTATION_V2.md`
- `STRUCTURED_ADDRESSES_IMPLEMENTATION.md`

## Code Organization

### Design System: Swiss Modern 2026

The application uses a custom design system with the following architecture:

**Layout Components (`/src/components/`):**
- `BentoLayout.tsx` - Main app shell (dark sidebar + light content area)
- `BentoSidebar.tsx` - Dark navigation sidebar (`bg-slate-900`)
- `BentoHeader.tsx` - Top header bar with user actions

**UI Building Blocks (`/src/components/ui/`):**
- `PageHeader.tsx` - Page title with description and action slots
- `Card.tsx` - Compound component with `Card.Header` and `Card.Content`
- `KPICard.tsx` - Metric display with trend indicators
- `Button.tsx` - Primary/Secondary/Ghost/Danger variants

**Design Tokens (`tailwind.config.js`):**
```
Colors:
- sidebar.bg: #0f172a (slate-900)
- app.bg: #f8fafc (slate-50)
- brand: #2563eb (blue-600) - active states
- surface.border: #e2e8f0 (slate-200)

Shadows: rest, hover, elevated, floating, glow-*
Border Radius: card (12px), button (8px), input (6px)
```

**CSS Utilities (`/src/index.css`):**
- `.card`, `.card-hover`, `.card-interactive`
- `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`
- `.input`, `.input-error`
- `.table`, `.table-container`
- `.badge-success`, `.badge-warning`, `.badge-danger`
- `.scrollbar-thin`, `.scrollbar-hidden`

### Custom Hooks

**`useAnalytics(startDate, endDate)`** (`/src/hooks/useAnalytics.ts`):
- Aggregates financial data from invoices and transactions
- Returns KPIs (income, expenses, profit), timelines, customer/category breakdowns
- Used by Dashboard and Auswertungen pages

**`useYearEnd(year)`** (`/src/hooks/useYearEnd.ts`):
- Year-end closing logic with asset depreciation calculations

### Components Pattern

Most entities follow this structure:
- `[Entity]Form.tsx` - Create/Edit form component
- `[Entity]Table.tsx` - List/Table display component
- Used in corresponding `/src/pages/[Entity].tsx`

**Kanban Components (Sales Pipeline):**
- `KanbanColumn.tsx` - Droppable column with fixed width (`w-72`)
- `OpportunityCard.tsx` - Draggable deal card
- Uses `@dnd-kit` for drag-and-drop functionality

### Key Files

- `/src/lib/supabase.ts` - Database client + TypeScript type definitions
- `/src/components/BentoLayout.tsx` - Main app shell (replaced Layout.tsx)
- `/src/pages/Dashboard.tsx` - KPI overview with analytics
- `/src/pages/Sales.tsx` - Kanban-style sales pipeline
- `/src/pages/Settings.tsx` - Company configuration (logo, IBAN, VAT settings)

## Database Development

### Creating Migrations

Place SQL files in `/supabase/migrations/` with timestamp prefix:
```bash
# Naming convention: YYYYMMDD_description.sql
20260123_add_new_feature.sql
```

### RLS Policy Pattern

Standard policy for tables with `company_id`:
```sql
CREATE POLICY "Tenant Isolation" ON public.table_name
  FOR ALL
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());
```

For tables without `company_id` (like `invoice_items`), use JOIN-based policies:
```sql
CREATE POLICY "Tenant Isolation via Parent" ON public.child_table
  FOR ALL
  USING (
    parent_id IN (
      SELECT id FROM public.parent_table
      WHERE company_id = get_user_company_id()
    )
  );
```

## Deployment & Build

### Vercel Configuration

- **SPA Routing:** `vercel.json` rewrites all routes to `/index.html`
- **Auto-deploy:** Pushes to main branch trigger automatic deployment
- **Build Command:** `npm run build` (defined in package.json)

### Known Issues (Resolved)

**Cross-Platform Compatibility (2026-01-23):**
- Vite downgraded from 6.x → 5.4.11 for stability
- Rollup explicitly added to devDependencies
- Optional Linux-specific dependency for Vercel compatibility
- See `REPAIR_LOG.md` for details

### Environment Variables

Required in Vercel/local `.env`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**NEVER use the Service Role key in frontend code!**

## Financial Analytics

### KPI Calculation

**Income:** Sum of paid invoices (`status = 'bezahlt'`)
**Expenses:** Sum of expense transactions
**Profit:** Income - Expenses

**Timeline Aggregation:**
- Daily data points for date ranges ≤ 60 days
- Monthly data points for longer periods
- Implemented in `useAnalytics` hook

### Year-End Closing

- Locks financial data for a specific year
- Captures assets, provisions, depreciation
- Prevents modifications to prior-year data
- Managed via `/src/pages/Jahresabschluss.tsx`

## Security & Data Sanitization

**Input Validation:** `SECURITY_SANITIZATION.md` documents sanitization rules
- SQL injection prevention via Supabase parameterized queries
- XSS protection via React's automatic escaping
- Swiss QR-Bill data validated for Latin-1 compliance

## Testing

**Current State:** No automated testing framework configured
- Manual testing only
- ESLint for code quality checks

## Common Development Tasks

### Adding a New Entity

1. Define TypeScript interface in `/src/lib/supabase.ts`
2. Create migration in `/supabase/migrations/` with RLS policies
3. Create `[Entity]Form.tsx` and `[Entity]Table.tsx` components
4. Create page in `/src/pages/[Entity].tsx`
5. Add route to `/src/App.tsx` and navigation item to `/src/components/BentoSidebar.tsx`

### Using UI Components

```tsx
import { PageHeader, Card, Button, KPICard } from '../components/ui';

// Page with header and actions
<PageHeader
  title="Page Title"
  description="Optional description"
  actions={<Button variant="primary">Action</Button>}
/>

// Card with compound components
<Card padding="md" hover>
  <Card.Header title="Title" subtitle="Subtitle" />
  <Card.Content>Content here</Card.Content>
</Card>

// KPI display
<KPICard
  label="Revenue"
  value="CHF 12,500"
  trend="up"
  icon={<TrendingUp />}
/>
```

### Modifying RLS Policies

1. Create new migration file with DROP + CREATE for affected policies
2. Test with multiple user accounts from different companies
3. Verify tenant isolation using Supabase SQL editor
4. NEVER disable RLS on production tables

### Updating Swiss QR-Bill Logic

1. Reference SPS 2025 standard documentation
2. Modify `/src/utils/swissqr.ts` for QR code generation
3. Update `/src/utils/pdfGenerator.ts` for PDF layout
4. Test with both IBAN and QR-IBAN formats
5. Validate Latin-1 character encoding

## Navigation Structure

Main sidebar routes (11 total):
1. Dashboard - `/` (Home)
2. Sales Pipeline - `/sales` (Kanban board)
3. Kunden - `/kunden` (Customers)
4. Projekte - `/projekte` (Projects)
5. Produkte - `/produkte` (Products)
6. Zeiterfassung - `/zeiterfassung` (Time tracking)
7. Rechnungen - `/rechnungen` (Invoices)
8. Buchungen - `/buchungen` (Transactions)
9. Auswertungen - `/auswertungen` (Analytics)
10. Jahresabschluss - `/jahresabschluss` (Year-end)
11. Einstellungen - `/settings` (Settings)

## Multi-Company Architecture

**Status:** ✅ Production-Ready (Single-User + Multi-User capable)
**Dokumentation:** `MULTI_COMPANY_IMPLEMENTATION.md`

### Architektur-Übersicht

**Table-Based RLS (Session-Variable-Free):**
- RLS Policies prüfen `user_companies` Tabelle direkt
- Keine Session Variables (verhindert Supabase Connection Pooling Probleme)
- RLS auf `user_companies` ist **DEAKTIVIERT** (verhindert infinite recursion)

### Wichtige RPC-Funktionen

**`get_user_companies()`** - Gibt alle Firmen des Users zurück
```typescript
const { data: companies } = await supabase.rpc('get_user_companies');
```

**`set_active_company(company_id)`** - Setzt aktive Firma
```typescript
await supabase.rpc('set_active_company', { company_id: 'uuid' });
```

### Frontend Pattern

**CompanyContext:**
```typescript
const { selectedCompany, switchCompany } = useCompany();

// Alle Queries filtern nach selectedCompany.id
const { data } = await supabase
  .from('customers')
  .select('*')
  .eq('company_id', selectedCompany.id);  // ✅ Explizit filtern
```

### RLS Policies

**Standard Policy (alle Tabellen mit company_id):**
```sql
CREATE POLICY "Tenant Isolation" ON public.table_name
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM user_companies WHERE user_id = auth.uid()
    )
  );
```

**Spezialfall: invoice_items (kein company_id):**
```sql
CREATE POLICY "Tenant Isolation via Invoice" ON invoice_items
  FOR ALL
  USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE company_id IN (
        SELECT company_id FROM user_companies WHERE user_id = auth.uid()
      )
    )
  );
```

### Wichtige Migrations

- `20260129_fix_rls_no_session.sql` - Entfernt Session-Dependency (KRITISCH!)
- `20260129_disable_rls_user_companies.sql` - Deaktiviert RLS (verhindert Recursion)
- `20260129_add_user_companies_indexes.sql` - Performance-Optimierung

### Best Practices

**✅ DO:**
- Frontend IMMER nach `company_id` filtern (Defense in Depth)
- `get_user_companies()` RPC für Firmenliste verwenden
- `set_active_company()` nur bei Company-Switch aufrufen

**❌ DON'T:**
- `set_active_company()` vor jedem INSERT/UPDATE callen (unnötig!)
- Direkte Queries auf `user_companies` machen (nur via RPC)
- RLS auf `user_companies` enablen (ohne Recursion-Fix)
