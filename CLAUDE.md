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

### Design System: Blauwasser (seit Okt. 2026)

Verbindliche Quelle: `design-system/blauwasser/` (README-CRM.md, project/tokens.json).
Konzept, Kontrast und Screenshots: `docs/design-review/`.

- **Tokens:** `src/styles/tokens.css` wird mit `node scripts/build-tokens.mjs` aus
  `tokens.json` erzeugt (Hell und Tiefsee, `data-theme` uebersteuert das System).
  Nie von Hand aendern.
- **Tailwind kennt nur Tokens** (`canvas`, `surface`, `raised`, `ink`, `fg`,
  `fg-muted`, `accent`, `cta`, `line`, `line-strong`, `success|warning|danger`
  mit `-subtle`, `focus`). Die Standardpalette (`gray-500` usw.) ist entfernt.
  Keine Hex-Werte in Komponenten; fuer recharts `useThemeColors()`.
- **Bausteine** (`src/components/ui/`, Klassen in `src/index.css`): `Button`
  (cta = die eine Pill pro Ansicht, primary, secondary, ghost, danger),
  `PageHeader` (Titel in Versalien), `Card`, `KPICard`, `Badge`,
  `SegmentedControl`, `EmptyState`, `Skeleton`; `Modal` mit Fokusfalle.
- **Standard ist immer hell**; Tiefsee nur, wenn in den Einstellungen gewaehlt
  (`src/utils/theme.ts`), nie ueber `prefers-color-scheme`.
- **Statusfarben (Erweiterung CRM, nicht im Design System):** `positive`,
  `negative`, `warning`, `attention`, `info`, definiert in
  `scripts/build-tokens.mjs`. `bg-<x>-solid` fuer Flaechen/Balken/Icons,
  `text-<x>` fuer Text, `bg-<x>-subtle` + `text-<x>-on-subtle` fuer Badges,
  `text-fg-on-light` fuer Tinte auf Statusflaechen. Farbe nie allein:
  Vorzeichen, Pfeil, Wort. Details: `docs/design-review/hell-und-status/`.
- **PDF (Rechnung/Offerte):** Blauwasser-Gestaltung, Schriften als TTF in
  `public/fonts/` (`src/utils/pdfFonts.ts`), keine farbigen Unterstreichungen,
  Hellblau nur als senkrechte Linie am Total. QR-Teil immer Helvetica.
  Muster: `node scripts/pdf-muster/render.mjs` (siehe `docs/design-review/pdf/`).
- Icons Lucide mit Strich 1.5, Fokus nie unterdruecken (`outline-none` ist tabu).
- Screenshots ohne echte Daten: `MOCK=1 node scripts/screenshots.mjs <ordner>`
  (Repo ist oeffentlich). Rauchtest: `node scripts/smoke-pages.mjs`. Handy-Audit:
  `node scripts/mobile-audit.mjs <ordner>`.

### Custom Hooks

**`useAnalytics(range, granularity)`** (`/src/hooks/useAnalytics.ts`):
- Dünne Schicht über der zentralen Aggregation (Cockpit, Berichte)

**Datenhooks pro Bereich:** `useInvoices.ts`, `useQuotes.ts`, `useTimeEntries.ts`, `usePipeline.ts`, `useContacts.ts`, `useCompanySettings.ts`, `useCockpitData.ts` (React Query; schreibende Funktionen daneben exportiert).

**`useYearEnd(year)`** (`/src/hooks/useYearEnd.ts`):
- Year-end closing logic with asset depreciation calculations

### Components Pattern

Most entities follow this structure:
- `[Entity]Form.tsx` - Create/Edit form component
- `[Entity]Table.tsx` - List/Table display component
- Used in corresponding `/src/pages/[Entity].tsx`

**Pipeline:** Board in `pages/Pipeline.tsx` (`@dnd-kit`, useDraggable/useDroppable), Lead/Deal-Panel `components/pipeline/OpportunityDrawer.tsx`.

### Key Files

- `/src/lib/supabase.ts` - Database client + TypeScript type definitions
- `/src/components/BentoLayout.tsx` - Main app shell (replaced Layout.tsx)
- `/src/pages/Cockpit.tsx` - Zu erledigen, Steuerung, Kennzahlen (ersetzt Dashboard)
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

### Zentrale Aggregation

Alle Finanzzahlen (Dashboard, Auswertung beide Modi, Buchungsliste,
Jahresabschluss) kommen aus `src/utils/financeAggregation.ts` ueber
`useFinanceEntries()` (`src/hooks/useFinance.ts`). Keine eigenen Rechenwege.

- **Einnahmen:** bezahlte Rechnungen nach `paid_at` plus Buchungen `einnahme`
  ohne `invoice_id`. Bezahlte Rechnungen ohne `paid_at` werden nicht geraten,
  sondern gemeldet (`paidWithoutDate`).
- **Ausgaben:** Buchungen `ausgabe`. Die Tabelle `expenses` ist leer und wird
  nicht gelesen.
- Datum immer als Zuercher Kalendertag `YYYY-MM-DD`, nie `toISOString()`.

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

**Vitest** (seit 12.08.2026). Ausführen mit `npm test`, im Watch-Modus mit
`npm run test:watch`. Konfiguration in `vite.config.ts` (`environment: 'node'`;
Komponententests `*.test.tsx` mit Kopfkommentar `@vitest-environment jsdom` und
Testing Library).

Abgedeckt sind die Stellen, an denen ein Fehler Geld kostet:

- `src/utils/money.test.ts` — Rundung auf Rappen
- `src/utils/invoiceTotals.test.ts` — Betragsberechnung, Rabatte, MwSt.
- `src/utils/swissqr.test.ts` — QR-Referenz, IBAN, Latin-1-Konformität

**Geldbeträge:** Immer über `roundRappen`/`sumRappen` aus `src/utils/money.ts`
rechnen und **auf Rappen runden, sobald ein Betrag feststeht** — nicht erst bei
der Anzeige. Summen aus bereits gerundeten Teilbeträgen bilden. Sonst weicht
die Summe der angezeigten Zeilen vom ausgewiesenen Total ab. Die
Rechenlogik liegt bewusst als reine Funktion in `src/utils/invoiceTotals.ts`,
damit sie testbar bleibt — nicht als Closure im Formular.

UI-Verhalten wird weiterhin manuell geprüft; ESLint für Codequalität.

## Audit-Stand

`AUDIT_2026-08-12.md` im Wurzelverzeichnis hält den vollständigen Befund des
Codebase-Audits fest: was behoben ist, was auf dem Branch `refactor/audit-rest`
liegt und was offen ist. **Vor grösseren Umbauten dort hineinschauen** — es
enthält mehrere Fallstricke, die sonst erneut auflaufen (RLS von
`user_companies`, Migrationsreihenfolge, generierte Supabase-Typen).

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

Seit der UX-Struktur (Okt. 2026, docs/ux-struktur/konzept.md) entlang des Geschäftsablaufs:

| Bereich | Seiten |
|---|---|
| – | Cockpit `/`, Kontakte `/kontakte` (Firmen/Personen), Firmenseite `/kontakte/firmen/:id` |
| Verkauf | Leads `/leads`, Pipeline `/pipeline`, Offerten `/offerten`, `/offerten/:id` |
| Arbeit | Projekte `/projekte`, `/projekte/:id`, Zeiterfassung `/zeiterfassung` |
| Finanzen | Rechnungen `/rechnungen`, `/rechnungen/:id`, Buchungen `/buchungen`, Berichte `/berichte?tab=` |
| unten | Einstellungen `/einstellungen/<bereich>` |

Alte Adressen (`/sales`, `/angebote`, `/kunden`, `/auswertungen`, `/jahresabschluss`, `/produkte`, `/settings?tab=`) leiten über `src/routes/legacy.ts` weiter. Begriffe: `docs/glossar.md` (Firma/Person, Unternehmen = eigenes Geschäft, Offerte statt Angebot).

### Listen-Template (`src/components/list/`)

Alle Übersichten nutzen `ListPage`, `ViewTabs`, `KpiStrip`, `DataTable` (Tabelle ab 1280 px, darunter Kartenliste), `RowMenu` (ein Menü pro Zeile, nicht mögliche Aktionen ausgeblendet), `BulkBar`, `Drawer`. Filter, Ansicht, Sortierung und Seite stehen in der URL (`useListState`, Schlüssel `ansicht`, `q`, `firma`, `projekt`, `von`, `bis`, `seite`, `sort`). Listen fragen gefiltert und seitenweise (50) die Datenbank ab; Tab-Zahlen kommen aus schlanken Abfragen. Ausnahme: Buchungen und Projekte filtern im Browser (kleine Mengen, zentrale Aggregation).

### Handy-Ansicht (seit Okt. 2026, docs/mobile/)

Konzept und Bericht: `docs/mobile/konzept.md`, `docs/mobile/bericht.md`. Handy heisst unter `md` (768 px); die Kartenliste der `DataTable` gilt unter `xl`. Der Desktop ab 1280 px darf sich nicht verändern. Prüfen mit `scripts/ux-audit-screens.mjs` (1440) im Pixelvergleich vorher und nachher.

- **Audit:** `node scripts/mobile-audit.mjs <ordner>` (Mock). Liefert Bilder 375/390/430 in hell und Tiefsee und `messungen-*.json`: Überlauf, Ziele unter 24/44 px, Felder unter 16 px, Lage der Pill. Eingrenzen mit `WIDTHS=390 THEMES=hell PAGES=…`, ganze Seiten mit `FULL=1`.
- **Grundgerüst:** `h-dvh`, nie `h-screen`/`100vh`. Feste Elemente mit `env(safe-area-inset-*)`.
- **Felder:** Unter `md` haben Felder 16 px (`index.css`, `!important`). Sonst zoomt iOS.
- **Touch-Ziele:**
  - `.tap` an Icon-Knöpfen: 44 × 44 px unter `md`, darüber neutral.
  - Negative Ränder zum Ausgleich nur mit `max-md:` setzen, sonst verrutscht der Desktop.
- **Masken:**
  - Die Zeile mit Speichern bekommt `.sheet-actions`. In Dialogen haftet sie unten. Der Rand gleicht den Innenabstand des Blatts aus (`px-5 py-5`).
  - Die Zeile muss direktes Kind des Formulars sein. Wenn nicht, die Hülle am Handy mit `max-md:contents` auflösen (siehe `OpportunityDrawer`).
- **Werkzeugleiste:** Auswahlfilter bekommen `.toolbar-collapsible` (macht `FilterSelect` von selbst). Sie liegen am Handy hinter «Filter (n)». Suche und aktive Filter-Chips bleiben sichtbar.
- **Bausteine:**
  - `useIsMobile()`/`useMediaQuery()` (`hooks/useMediaQuery.ts`, ohne `matchMedia` in jsdom = Desktop);
  - `RowMenu`: am Handy ein Blatt;
  - `ContactActions` (tel:/mailto:, `utils/contactLinks.ts`);
  - `PdfFrame`: am Handy «PDF öffnen» und «Teilen»;
  - Container Query: `.cq` + `.cq-cols-3` (eigenes CSS, kein Plugin).
- **Leiste unten** (`MobileBar`): Cockpit, Zeit erfassen, Beleg, Suche. Die Timer-Leiste erscheint, wenn ein Timer läuft. Stopp geht über das Ereignis `requestTimerStop()` an den Dialog im `TimerButton`.
- **Mobiles Menü:** Das Menü braucht eine eigene Ebene (`relative z-50`). Sonst liegt der Hintergrund (z-40) darüber und schluckt alle Tipps.
- **Einmalige URL-Parameter** wie `?neu=1`: Seiten rendern erst, wenn das Unternehmen geladen ist (`BentoLayout`). Sonst baut der `key` die Seite nach dem Entfernen des Parameters neu auf.

### Abgeleitete Status

- Rechnung **überfällig** = versendet und Fälligkeit vor heute (`utils/invoiceViews.ts`); der alte gespeicherte Wert `überfällig` zählt wie versendet.
- Offerte **abgelaufen** = versendet und Gültigkeit vorbei; `offen` heisst «Entwurf», `bestaetigt` heisst «Umgewandelt» (`utils/quoteViews.ts`).
- Zeit **nicht verrechnet** = verrechenbar, ohne Rechnung, ohne manuellen Status verrechnet/bezahlt (`utils/timeEntries.ts`).
- Leads sind `opportunities.kind = 'lead'`; die Lead-Stufe (`pipeline_stages.is_lead_stage`) erscheint nicht im Board.

### Cockpit

Alle Werte über reine Funktionen in `utils/cockpit.ts` und `utils/cockpitTodos.ts` (getestet), immer nur für das gewählte Unternehmen (Blauwasser und Freiluftchuchi nie zusammenzählen). Einstellungen in `company_settings` und `company_revenue_targets`, Kontostände `bank_balances`, Fristen `deadlines`, Notizen `notes`.

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
