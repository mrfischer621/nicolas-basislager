# Database Schema Reference

**Source of Truth for Freiluftchuchi CRM Database Structure**

This document provides a comprehensive reference of the PostgreSQL database schema for the Freiluftchuchi CRM application, including all tables, columns, data types, relationships, constraints, and Row-Level Security (RLS) policies.

**Last Updated:** 2026-01-23
**Database:** Supabase PostgreSQL
**Migration Files:** `/supabase/migrations/`

---

## Table of Contents

1. [Overview](#overview)
2. [Entity Relationship Diagram](#entity-relationship-diagram)
3. [Core Tables](#core-tables)
4. [Security Architecture](#security-architecture)
5. [Helper Functions](#helper-functions)
6. [Storage Buckets](#storage-buckets)

---

## Overview

### Multi-Tenant Architecture

The database implements **strict multi-tenant isolation** using Row-Level Security (RLS). All business data tables are scoped by `company_id`, ensuring complete data separation between tenants.

**Key Security Principles:**
- Every user belongs to exactly ONE company (via `profiles` table)
- All data access is filtered by `company_id = get_user_company_id()`
- Users can ONLY access data from their own company
- Service Role key bypasses RLS (NEVER expose to frontend)
- Frontend MUST use ANON key from environment variables

---

## Entity Relationship Diagram

```
┌──────────────┐
│ auth.users   │ (Supabase Auth - external)
└──────┬───────┘
       │
       │ 1:1 (ON DELETE CASCADE)
       │
       ▼
┌─────────────────┐         ┌──────────────────┐
│   profiles      │────────▶│   companies      │
│   (User Auth)   │   n:1   │   (Tenants)      │
└─────────────────┘         └────────┬─────────┘
                                     │
                                     │ 1:n (company_id FK)
                   ┌─────────────────┼─────────────────────────────┐
                   │                 │                             │
                   ▼                 ▼                             ▼
            ┌─────────────┐   ┌──────────────┐          ┌──────────────────┐
            │  customers  │   │   products   │          │   transactions   │
            └──────┬──────┘   └──────────────┘          └──────────────────┘
                   │
                   │ 1:n (customer_id FK)
                   │
                   ▼
            ┌─────────────┐
            │  projects   │
            └──────┬──────┘
                   │
          ┌────────┼────────┐
          │        │        │
          │ 1:n    │ 1:n    │ 1:n
          ▼        ▼        ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ invoices │ │time_entries│expenses  │
   └────┬─────┘ └──────────┘ └──────────┘
        │
        │ 1:n (invoice_id FK)
        │
        ▼
   ┌──────────────┐
   │invoice_items │ (NO company_id - uses JOIN-based RLS)
   └──────────────┘

┌─────────────────────┐
│ year_end_closings   │ (separate hierarchy, company-scoped)
└─────────────────────┘
```

---

## Core Tables

### 1. `companies`

**Purpose:** Tenant/company information with Swiss banking details for QR-Bill generation.

| Column Name       | Data Type        | Nullable | Default | Description                                    |
|-------------------|------------------|----------|---------|------------------------------------------------|
| `id`              | `UUID`           | NOT NULL | `gen_random_uuid()` | Primary key                      |
| `name`            | `TEXT`           | NOT NULL |         | Company name                                   |
| `logo_url`        | `TEXT`           | NULL     |         | URL to company logo (Supabase Storage)         |
| `street`          | `TEXT`           | NULL     |         | Street name (Swiss QR-Bill structured address) |
| `house_number`    | `TEXT`           | NULL     |         | House number (Swiss QR-Bill)                   |
| `zip_code`        | `TEXT`           | NULL     |         | Postal code                                    |
| `city`            | `TEXT`           | NULL     |         | City name                                      |
| `iban`            | `TEXT`           | NULL     |         | Standard IBAN for banking                      |
| `qr_iban`         | `TEXT`           | NULL     |         | QR-IBAN for Swiss QR-Bill (SPS 2025 v2.3)     |
| `uid_number`      | `TEXT`           | NULL     |         | Swiss UID number (company registration)        |
| `bank_name`       | `TEXT`           | NULL     |         | Bank name                                      |
| `vat_number`      | `TEXT`           | NULL     |         | VAT registration number                        |
| `vat_registered`  | `BOOLEAN`        | NOT NULL | `false` | Whether company is VAT-registered              |
| `created_at`      | `TIMESTAMPTZ`    | NOT NULL | `now()` | Record creation timestamp                      |

**Primary Key:** `id`
**Indexes:**
- Primary key index on `id`

**RLS Policies:**
- `Own Company Access` (SELECT): Users can view their own company (`id = get_user_company_id()`)
- `Own Company Update` (UPDATE): Users can update their own company
- `Company Creation` (INSERT): Authenticated users can create companies (for registration)
- `Own Company Delete` (DELETE): Users can delete their own company

---

### 2. `profiles`

**Purpose:** Maps authenticated users (`auth.users`) to companies for multi-tenant access control.

| Column Name  | Data Type     | Nullable | Default    | Description                                      |
|--------------|---------------|----------|------------|--------------------------------------------------|
| `id`         | `UUID`        | NOT NULL |            | Primary key, references `auth.users(id)` (CASCADE)|
| `company_id` | `UUID`        | NOT NULL |            | FK to `companies(id)` (CASCADE)                  |
| `email`      | `TEXT`        | NOT NULL |            | User email (unique constraint)                   |
| `full_name`  | `TEXT`        | NULL     |            | User's full name                                 |
| `role`       | `TEXT`        | NOT NULL | `'member'` | User role: `'owner'`, `'admin'`, or `'member'`   |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `now()`    | Record creation timestamp                        |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `now()`    | Last update timestamp (auto-updated by trigger)  |

**Primary Key:** `id`
**Foreign Keys:**
- `id` → `auth.users(id)` ON DELETE CASCADE
- `company_id` → `companies(id)` ON DELETE CASCADE

**Unique Constraints:**
- `profiles_email_unique` on `email`

**Check Constraints:**
- `role` IN ('owner', 'admin', 'member')

**Indexes:**
- Primary key index on `id`
- `idx_profiles_company_id` on `company_id`
- `idx_profiles_email` on `email`

**Triggers:**
- `trigger_update_profiles_updated_at`: Auto-updates `updated_at` on row modification
- `enforce_immutable_profile_fields`: Prevents modification of `company_id` and `role` (privilege escalation protection)

**RLS Policies:**
- `Users can view own profile` (SELECT): `id = auth.uid()`
- `Users can update own profile` (UPDATE): `id = auth.uid()` (but trigger prevents changing `company_id`/`role`)
- `Users can create own profile` (INSERT): `id = auth.uid()`

**CRITICAL SECURITY NOTE:**
The trigger `enforce_immutable_profile_fields` prevents privilege escalation attacks by blocking modifications to `company_id` and `role`. These fields can ONLY be changed by administrators using the Service Role key.

---

### 3. `customers`

**Purpose:** Customer/client management with Swiss QR-Bill compliant structured addresses.

| Column Name                 | Data Type     | Nullable | Default | Description                                        |
|-----------------------------|---------------|----------|---------|----------------------------------------------------|
| `id`                        | `UUID`        | NOT NULL | `gen_random_uuid()` | Primary key                            |
| `company_id`                | `UUID`        | NOT NULL |         | FK to `companies(id)` (tenant isolation)           |
| `name`                      | `TEXT`        | NOT NULL |         | Customer/company name                              |
| `contact_person`            | `TEXT`        | NULL     |         | Primary contact name                               |
| `email`                     | `TEXT`        | NULL     |         | Contact email                                      |
| `hourly_rate`               | `NUMERIC`     | NULL     |         | Default hourly rate for billing                    |
| `street`                    | `TEXT`        | NULL     |         | Street name (QR-Bill structured)                   |
| `house_number`              | `TEXT`        | NULL     |         | House number (QR-Bill structured)                  |
| `zip_code`                  | `TEXT`        | NULL     |         | Postal code                                        |
| `city`                      | `TEXT`        | NULL     |         | City name                                          |
| `country`                   | `TEXT`        | NULL     |         | Country code (ISO 3166-1 alpha-2)                  |
| `alternate_billing_address` | `TEXT`        | NULL     |         | Full billing address if different                  |
| `co`                        | `TEXT`        | NULL     |         | Care of (c/o) address line                         |
| `department`                | `TEXT`        | NULL     |         | Department/division                                |
| `phone`                     | `TEXT`        | NULL     |         | Phone number                                       |
| `website`                   | `TEXT`        | NULL     |         | Website URL                                        |
| `created_at`                | `TIMESTAMPTZ` | NOT NULL | `now()` | Record creation timestamp                          |

**Primary Key:** `id`
**Foreign Keys:**
- `company_id` → `companies(id)` (implicit, enforced by RLS)

**Indexes:**
- Primary key index on `id`
- (Recommended: index on `company_id` for performance)

**RLS Policies:**
- `Tenant Isolation` (ALL): `company_id = get_user_company_id()`

---

### 4. `projects`

**Purpose:** Project tracking with budgets, linked to customers.

| Column Name   | Data Type     | Nullable | Default | Description                                          |
|---------------|---------------|----------|---------|------------------------------------------------------|
| `id`          | `UUID`        | NOT NULL | `gen_random_uuid()` | Primary key                              |
| `company_id`  | `UUID`        | NOT NULL |         | FK to `companies(id)` (tenant isolation)             |
| `customer_id` | `UUID`        | NOT NULL |         | FK to `customers(id)`                                |
| `name`        | `TEXT`        | NOT NULL |         | Project name                                         |
| `description` | `TEXT`        | NULL     |         | Project description                                  |
| `status`      | `TEXT`        | NOT NULL | `'offen'` | Status: `'offen'`, `'laufend'`, `'abgeschlossen'` |
| `budget`      | `NUMERIC`     | NULL     |         | Budget CHF: Gesamtbudget, bei wiederkehrendem Budget der Betrag pro Periode |
| `budget_period` | `TEXT`      | NULL     |         | Wiederkehrendes Budget: `'monat'`, `'quartal'`, `'jahr'`. NULL = Gesamtbudget oder kein Budget |
| `budget_hours`  | `NUMERIC(8,2)` | NULL  |         | Stunden pro Periode (nur wiederkehrend). Gesetzt: Vergleich in Stunden, sonst in CHF |
| `budget_start`  | `DATE`      | NULL     |         | Beginn des wiederkehrenden Budgets; Zeiten davor zählen nicht |
| `hourly_rate` | `NUMERIC`     | NULL     |         | Projektsatz (übersteuert Firma und Standardsatz)     |
| `is_active`   | `BOOLEAN`     | NOT NULL | `true`  | false = archiviert                                   |
| `created_at`  | `TIMESTAMPTZ` | NOT NULL | `now()` | Record creation timestamp                            |

**Primary Key:** `id`
**Foreign Keys:**
- `company_id` → `companies(id)` (implicit, enforced by RLS)
- `customer_id` → `customers(id)` (implicit, should have FK constraint)

**Check Constraints:**
- `status` IN ('offen', 'laufend', 'abgeschlossen')
- `projects_budget_period_check`: `budget_period` IN ('monat', 'quartal', 'jahr')
- `projects_budget_hours_check`: `budget_hours >= 0`
- `projects_recurring_budget_complete`: ist `budget_period` gesetzt, dann `budget_start` gesetzt und `budget` oder `budget_hours` gesetzt

**Wiederkehrendes Budget** (Migration `20261105153141_projects_recurring_budget.sql`):
Perioden sind Kalendermonate, -quartale oder -jahre ab `budget_start` (erste
Periode ab Beginn, aber mit vollem Budget). Verbrauch einer Periode = verrechenbare
Zeiten mit Datum in der Periode, verrechnet oder nicht. Kein Übertrag zwischen
Perioden. Berechnung in `src/utils/projects.ts` (`periodHistory`, `projectStats`).

**RLS Policies:**
- `Tenant Isolation` (ALL): `company_id = get_user_company_id()`

---

### 5. `time_entries`

**Purpose:** Time tracking for billable hours, linked to projects.

| Column Name   | Data Type     | Nullable | Default  | Description                                    |
|---------------|---------------|----------|----------|------------------------------------------------|
| `id`          | `UUID`        | NOT NULL | `gen_random_uuid()` | Primary key                        |
| `company_id`  | `UUID`        | NOT NULL |          | FK to `companies(id)` (tenant isolation)       |
| `project_id`  | `UUID`        | NOT NULL |          | FK to `projects(id)`                           |
| `date`        | `DATE`        | NOT NULL |          | Date of work                                   |
| `hours`       | `NUMERIC`     | NOT NULL |          | Hours worked (can be decimal, e.g., 2.5)       |
| `rate`        | `NUMERIC`     | NOT NULL |          | Hourly rate (CHF)                              |
| `description` | `TEXT`        | NULL     |          | Work description                               |
| `invoiced`    | `BOOLEAN`     | NOT NULL | `false`  | Whether time has been invoiced                 |
| `created_at`  | `TIMESTAMPTZ` | NOT NULL | `now()`  | Record creation timestamp                      |

**Primary Key:** `id`
**Foreign Keys:**
- `company_id` → `companies(id)` (implicit, enforced by RLS)
- `project_id` → `projects(id)` (implicit, should have FK constraint)

**RLS Policies:**
- `Tenant Isolation` (ALL): `company_id = get_user_company_id()`

---

### 6. `invoices`

**Purpose:** Invoice headers with Swiss QR-Bill generation support.

| Column Name      | Data Type     | Nullable | Default | Description                                              |
|------------------|---------------|----------|---------|----------------------------------------------------------|
| `id`             | `UUID`        | NOT NULL | `gen_random_uuid()` | Primary key                                  |
| `company_id`     | `UUID`        | NOT NULL |         | FK to `companies(id)` (tenant isolation)                 |
| `invoice_number` | `TEXT`        | NOT NULL |         | Human-readable invoice number (unique per company)       |
| `customer_id`    | `UUID`        | NOT NULL |         | FK to `customers(id)`                                    |
| `project_id`     | `UUID`        | NULL     |         | FK to `projects(id)` (optional)                          |
| `issue_date`     | `DATE`        | NOT NULL |         | Invoice issue date                                       |
| `due_date`       | `DATE`        | NULL     |         | Payment due date                                         |
| `subtotal`       | `NUMERIC`     | NOT NULL |         | Subtotal before VAT (CHF)                                |
| `vat_rate`       | `NUMERIC`     | NOT NULL |         | VAT rate as decimal (e.g., 0.077 for 7.7%)               |
| `vat_amount`     | `NUMERIC`     | NOT NULL |         | VAT amount (CHF)                                         |
| `total`          | `NUMERIC`     | NOT NULL |         | Total amount including VAT (CHF)                         |
| `status`         | `TEXT`        | NOT NULL | `'entwurf'` | Status: `'entwurf'`, `'versendet'`, `'bezahlt'`, `'überfällig'` |
| `paid_at`        | `TIMESTAMPTZ` | NULL     |         | Payment timestamp                                        |
| `created_at`     | `TIMESTAMPTZ` | NOT NULL | `now()` | Record creation timestamp                                |

**Primary Key:** `id`
**Foreign Keys:**
- `company_id` → `companies(id)` (implicit, enforced by RLS)
- `customer_id` → `customers(id)` (implicit, should have FK constraint)
- `project_id` → `projects(id)` (implicit, optional)

**Check Constraints:**
- `status` IN ('entwurf', 'versendet', 'bezahlt', 'überfällig')

**RLS Policies:**
- `Tenant Isolation` (ALL): `company_id = get_user_company_id()`

**Related Tables:**
- `invoice_items` (1:n relationship via `invoice_id`)

---

### 7. `invoice_items`

**Purpose:** Line items for invoices (products/services on an invoice).

| Column Name  | Data Type | Nullable | Default | Description                                      |
|--------------|-----------|----------|---------|--------------------------------------------------|
| `id`         | `UUID`    | NOT NULL | `gen_random_uuid()` | Primary key                          |
| `invoice_id` | `UUID`    | NOT NULL |         | FK to `invoices(id)`                             |
| `description`| `TEXT`    | NOT NULL |         | Item description (product/service name)          |
| `quantity`   | `NUMERIC` | NOT NULL |         | Quantity                                         |
| `unit_price` | `NUMERIC` | NOT NULL |         | Price per unit (CHF)                             |
| `total`      | `NUMERIC` | NOT NULL |         | Total for this line item (quantity × unit_price) |

**Primary Key:** `id`
**Foreign Keys:**
- `invoice_id` → `invoices(id)` (implicit, should have FK constraint with CASCADE)

**IMPORTANT:** This table does NOT have a `company_id` column. Tenant isolation is enforced via JOIN-based RLS policies.

**RLS Policies:**
- `Tenant Isolation via Invoice` (ALL):
  ```sql
  USING (
    invoice_id IN (
      SELECT id FROM public.invoices
      WHERE company_id = get_user_company_id()
    )
  )
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM public.invoices
      WHERE company_id = get_user_company_id()
    )
  )
  ```

---

### 8. `transactions`

**Purpose:** Financial journal entries (income/expenses) with flexible tagging and linking.

| Column Name         | Data Type     | Nullable | Default | Description                                        |
|---------------------|---------------|----------|---------|----------------------------------------------------|
| `id`                | `UUID`        | NOT NULL | `gen_random_uuid()` | Primary key                            |
| `company_id`        | `UUID`        | NOT NULL |         | FK to `companies(id)` (tenant isolation)           |
| `type`              | `TEXT`        | NOT NULL |         | Transaction type: `'einnahme'` or `'ausgabe'`      |
| `date`              | `DATE`        | NOT NULL |         | Transaction date                                   |
| `amount`            | `NUMERIC`     | NOT NULL |         | Amount (CHF, always positive)                      |
| `description`       | `TEXT`        | NULL     |         | Transaction description                            |
| `category`          | `TEXT`        | NULL     |         | Category (e.g., "Marketing", "Office Supplies")    |
| `project_id`        | `UUID`        | NULL     |         | FK to `projects(id)` (optional linking)            |
| `customer_id`       | `UUID`        | NULL     |         | FK to `customers(id)` (optional linking)           |
| `invoice_id`        | `UUID`        | NULL     |         | FK to `invoices(id)` (optional linking)            |
| `document_url`      | `TEXT`        | NULL     |         | URL to receipt/document in Supabase Storage        |
| `tags`              | `TEXT[]`      | NULL     |         | Array of tags for flexible categorization          |
| `billable`          | `BOOLEAN`     | NOT NULL | `false` | Whether transaction is billable to client          |
| `transaction_number`| `TEXT`        | NULL     |         | Optional transaction/receipt number                |
| `created_at`        | `TIMESTAMPTZ` | NOT NULL | `now()` | Record creation timestamp                          |

**Primary Key:** `id`
**Foreign Keys:**
- `company_id` → `companies(id)` (implicit, enforced by RLS)
- `project_id` → `projects(id)` (optional)
- `customer_id` → `customers(id)` (optional)
- `invoice_id` → `invoices(id)` (optional)

**Check Constraints:**
- `type` IN ('einnahme', 'ausgabe')

**RLS Policies:**
- `Tenant Isolation` (ALL): `company_id = get_user_company_id()`

---

### 9. `expenses`

**Purpose:** Expense tracking (legacy table, overlaps with `transactions`).

| Column Name   | Data Type     | Nullable | Default | Description                              |
|---------------|---------------|----------|---------|------------------------------------------|
| `id`          | `UUID`        | NOT NULL | `gen_random_uuid()` | Primary key              |
| `company_id`  | `UUID`        | NOT NULL |         | FK to `companies(id)` (tenant isolation) |
| `description` | `TEXT`        | NOT NULL |         | Expense description                      |
| `amount`      | `NUMERIC`     | NOT NULL |         | Expense amount (CHF)                     |
| `date`        | `DATE`        | NOT NULL |         | Expense date                             |
| `category`    | `TEXT`        | NULL     |         | Expense category                         |
| `created_at`  | `TIMESTAMPTZ` | NOT NULL | `now()` | Record creation timestamp                |

**Primary Key:** `id`
**Foreign Keys:**
- `company_id` → `companies(id)` (implicit, enforced by RLS)

**RLS Policies:**
- `Tenant Isolation` (ALL): `company_id = get_user_company_id()`

**Note:** This table is being deprecated in favor of using `transactions` with `type = 'ausgabe'`.

---

### 10. `products`

**Purpose:** Product/service catalog for reusable invoice items.

| Column Name   | Data Type     | Nullable | Default | Description                                |
|---------------|---------------|----------|---------|--------------------------------------------|
| `id`          | `UUID`        | NOT NULL | `gen_random_uuid()` | Primary key                    |
| `company_id`  | `UUID`        | NOT NULL |         | FK to `companies(id)` (tenant isolation)   |
| `name`        | `TEXT`        | NOT NULL |         | Product/service name                       |
| `price`       | `NUMERIC`     | NOT NULL |         | Default price per unit (CHF)               |
| `unit`        | `TEXT`        | NOT NULL |         | Unit of measurement (e.g., "Stunde", "Stk")|
| `description` | `TEXT`        | NULL     |         | Product/service description                |
| `is_active`   | `BOOLEAN`     | NOT NULL | `true`  | Whether product is active/available        |
| `created_at`  | `TIMESTAMPTZ` | NOT NULL | `now()` | Record creation timestamp                  |
| `updated_at`  | `TIMESTAMPTZ` | NOT NULL | `now()` | Last update timestamp (auto-updated)       |

**Primary Key:** `id`
**Foreign Keys:**
- `company_id` → `companies(id)` (implicit, enforced by RLS)

**RLS Policies:**
- `Tenant Isolation` (ALL): `company_id = get_user_company_id()`

---

### 11. `year_end_closings`

**Purpose:** Annual financial closing with asset depreciation and provisions.

| Column Name               | Data Type     | Nullable | Default | Description                                          |
|---------------------------|---------------|----------|---------|------------------------------------------------------|
| `id`                      | `UUID`        | NOT NULL | `gen_random_uuid()` | Primary key                              |
| `company_id`              | `UUID`        | NOT NULL |         | FK to `companies(id)` (tenant isolation)             |
| `year`                    | `INTEGER`     | NOT NULL |         | Fiscal year (e.g., 2025)                             |
| `status`                  | `TEXT`        | NOT NULL | `'draft'` | Status: `'draft'` or `'locked'`                    |
| `data`                    | `JSONB`       | NOT NULL |         | Structured closing data (assets, provisions, etc.)   |
| `final_profit`            | `NUMERIC`     | NOT NULL |         | Final profit/loss for the year (CHF)                 |
| `locked_at`               | `TIMESTAMPTZ` | NULL     |         | Timestamp when closing was locked                    |
| `created_at`              | `TIMESTAMPTZ` | NOT NULL | `now()` | Record creation timestamp                            |
| `updated_at`              | `TIMESTAMPTZ` | NOT NULL | `now()` | Last update timestamp (auto-updated)                 |

**Primary Key:** `id`
**Foreign Keys:**
- `company_id` → `companies(id)` (implicit, enforced by RLS)

**Check Constraints:**
- `status` IN ('draft', 'locked')

**JSONB Data Structure (`data` column):**
```typescript
{
  assets: [
    {
      name: string;
      value: number;
      depreciation_rate: number;
      amount: number;
    }
  ];
  private_shares: [
    {
      category: string;
      percentage: number;
      amount: number;
    }
  ];
  social_security_provision: number;
}
```

**RLS Policies:**
- `Tenant Isolation` (ALL): `company_id = get_user_company_id()`

**Business Logic:**
- Once `status = 'locked'`, the closing should be immutable (enforced by application logic)
- Prevents modifications to prior-year financial data

---

## Security Architecture

### Row-Level Security (RLS)

**ALL tables have RLS enabled.** Users can ONLY access data belonging to their company.

### Helper Function: `get_user_company_id()`

**Purpose:** Retrieves the `company_id` for the currently authenticated user.

```sql
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public  -- CRITICAL: Prevents schema injection attacks
AS $$
  SELECT company_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;
```

**Security Features:**
- `SECURITY DEFINER`: Runs with elevated privileges to access `profiles` table
- `STABLE`: Function result doesn't change within a transaction (performance optimization)
- `SET search_path = public`: **CRITICAL SECURITY FIX** - prevents search path injection attacks

**Used By:** All RLS policies for tenant isolation

---

### RLS Policy Patterns

#### 1. Standard Pattern (Tables with `company_id`)

**Example:** `customers`, `projects`, `invoices`, etc.

```sql
CREATE POLICY "Tenant Isolation" ON public.customers
  FOR ALL
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());
```

- **USING clause:** Controls which rows are visible for SELECT/UPDATE/DELETE
- **WITH CHECK clause:** Controls which rows can be inserted/updated

#### 2. JOIN-Based Pattern (Tables WITHOUT `company_id`)

**Example:** `invoice_items`

```sql
CREATE POLICY "Tenant Isolation via Invoice" ON public.invoice_items
  FOR ALL
  USING (
    invoice_id IN (
      SELECT id FROM public.invoices
      WHERE company_id = get_user_company_id()
    )
  )
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM public.invoices
      WHERE company_id = get_user_company_id()
    )
  );
```

#### 3. Self-Access Pattern (User Profiles)

**Example:** `profiles`

```sql
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT
  USING (id = auth.uid());
```

- Users can ONLY access their own profile
- Modifications to `company_id` and `role` are blocked by trigger

---

### Security Triggers

#### `enforce_immutable_profile_fields`

**Purpose:** Prevents privilege escalation attacks by blocking modifications to sensitive fields.

**Protected Fields:**
- `company_id`: Prevents users from accessing other companies' data
- `role`: Prevents users from granting themselves admin privileges

**Trigger Function:**
```sql
CREATE OR REPLACE FUNCTION prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'Cannot modify company_id. Contact administrator to change companies.'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.role IS DISTINCT FROM NEW.role THEN
    RAISE EXCEPTION 'Cannot modify role. Contact administrator to change user permissions.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
```

**Error Code:** `42501` (insufficient_privilege)

---

## Helper Functions

### `get_user_company_id()`

See [Security Architecture](#helper-function-get_user_company_id) section above.

### `update_profiles_updated_at()`

**Purpose:** Auto-updates the `updated_at` timestamp on profile modifications.

```sql
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Trigger:**
```sql
CREATE TRIGGER trigger_update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();
```

---

## Storage Buckets

### `invoices` Bucket

**Purpose:** Stores invoice PDFs, receipts, and transaction documents.

**Configuration:**
- **Public:** NO (private bucket)
- **File Size Limit:** 10 MB
- **Allowed MIME Types:**
  - `application/pdf`
  - `image/jpeg`
  - `image/png`
  - `image/webp`

**File Path Format:**
```
{company_id}/{filename}
```

**Example:**
```
550e8400-e29b-41d4-a716-446655440000/invoice_2025_001.pdf
```

### Storage RLS Policies

**ALL storage policies enforce tenant isolation using the first path segment as `company_id`.**

```sql
-- SELECT Policy
CREATE POLICY "Tenant isolation for invoices - SELECT"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'invoices' AND
    (storage.foldername(name))[1] = get_user_company_id()::text
  );

-- INSERT Policy
CREATE POLICY "Tenant isolation for invoices - INSERT"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'invoices' AND
    (storage.foldername(name))[1] = get_user_company_id()::text
  );

-- UPDATE Policy
CREATE POLICY "Tenant isolation for invoices - UPDATE"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'invoices' AND
    (storage.foldername(name))[1] = get_user_company_id()::text
  )
  WITH CHECK (
    bucket_id = 'invoices' AND
    (storage.foldername(name))[1] = get_user_company_id()::text
  );

-- DELETE Policy
CREATE POLICY "Tenant isolation for invoices - DELETE"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'invoices' AND
    (storage.foldername(name))[1] = get_user_company_id()::text
  );
```

**Function Used:** `storage.foldername(path)` - extracts path segments as an array

---

## Migration History

| Migration File                            | Date       | Description                                    |
|-------------------------------------------|------------|------------------------------------------------|
| `20260122_security_overhaul.sql`          | 2026-01-22 | Initial RLS setup with multi-tenant policies  |
| `20260122_enforce_rls.sql`                | 2026-01-22 | Simplified policy creation (consolidated)      |
| `20260123_secure_storage_setup.sql`       | 2026-01-23 | Storage bucket RLS for file uploads            |
| `20260123_critical_security_fixes.sql`    | 2026-01-23 | Fixed search path injection & privilege escalation |

---

## Database Access Patterns

### Frontend (Client-Side)

**MUST use:** `VITE_SUPABASE_ANON_KEY` (public anonymous key)

**Key Characteristics:**
- All queries are automatically filtered by RLS policies
- Users can ONLY see/modify data from their company
- Company context is retrieved via: `SELECT * FROM profiles WHERE id = auth.uid()`
- File uploads MUST use path format: `{company_id}/{filename}`

**Example Query:**
```typescript
// NO need to manually filter by company_id - RLS does it automatically
const { data: customers } = await supabase
  .from('customers')
  .select('*');
// Returns ONLY customers belonging to the authenticated user's company
```

### Backend/Admin (Server-Side)

**MUST use:** Service Role Key (from Supabase Dashboard)

**Key Characteristics:**
- **BYPASSES RLS** - has full database access
- Used for admin operations, migrations, data seeding
- **NEVER expose to frontend code or client applications**

---

## Important Notes

### DO:
- ✅ Always use the ANON key in frontend code
- ✅ Trust RLS policies to enforce tenant isolation
- ✅ Use `get_user_company_id()` in custom SQL functions
- ✅ Follow the `{company_id}/{filename}` format for storage uploads
- ✅ Test RLS policies with multiple user accounts from different companies

### DON'T:
- ❌ NEVER expose the Service Role key to clients
- ❌ NEVER manually filter queries by `company_id` (RLS does this automatically)
- ❌ NEVER disable RLS on production tables
- ❌ NEVER modify `profiles.company_id` or `profiles.role` from frontend
- ❌ NEVER create storage file paths without the `company_id` prefix

---

## Verification Queries

### Check RLS Status
```sql
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```
**Expected:** All tables should have `rowsecurity = true`

### List All Policies
```sql
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```
**Expected:** All tables should have at least one policy

### Test `get_user_company_id()` Function
```sql
SELECT get_user_company_id();
```
**Expected:** Returns your `company_id` UUID (must be logged in as authenticated user)

### Verify Security Function Settings
```sql
SELECT
  proname as function_name,
  prosecdef as is_security_definer,
  proconfig as settings
FROM pg_proc
WHERE proname = 'get_user_company_id'
  AND pronamespace = 'public'::regnamespace;
```
**Expected:** `settings` should contain `"search_path=public"`

---

## TypeScript Type Definitions

Full type definitions are available in `/src/lib/supabase.ts`.

**Key Interfaces:**
- `Company`
- `Customer`
- `Project`
- `TimeEntry`
- `Invoice`
- `InvoiceItem`
- `Transaction`
- `Expense`
- `Product`
- `YearEndClosing`
- `YearEndClosingData` (JSONB structure)

**Database Type:**
```typescript
import { Database } from '@/lib/supabase';

// Typed Supabase client
const supabase = createClient<Database>(url, key);
```

---

## End of Document

**Last Updated:** 2026-01-23
**Maintained By:** Development Team
**Status:** ✅ Production-Ready
