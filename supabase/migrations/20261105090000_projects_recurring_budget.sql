-- Wiederkehrendes Budget pro Projekt (Retainer, Wartung).
--
-- budget_period null  = bisheriges Verhalten: projects.budget ist das
--                       Gesamtbudget (oder kein Budget, wenn auch budget null).
-- budget_period gesetzt = wiederkehrend: Budget gilt pro Kalenderperiode ab
--                       budget_start; projects.budget ist dann der Betrag pro
--                       Periode, budget_hours die Stunden pro Periode.
--
-- Neue Spalten auf bestehender Tabelle: RLS-Policies bleiben unveraendert.
-- Kein Backfill.

alter table public.projects
  add column if not exists budget_period text null,
  add column if not exists budget_hours numeric(8,2) null,
  add column if not exists budget_start date null;

alter table public.projects
  add constraint projects_budget_period_check
    check (budget_period in ('monat', 'quartal', 'jahr')),
  add constraint projects_budget_hours_check
    check (budget_hours >= 0),
  add constraint projects_recurring_budget_complete
    check (
      budget_period is null
      or (budget_start is not null and (budget is not null or budget_hours is not null))
    );

comment on column public.projects.budget is
  'Budget in CHF. Ohne budget_period: Gesamtbudget ueber die ganze Laufzeit. Mit budget_period: Betrag pro Periode.';
comment on column public.projects.budget_period is
  'Wiederkehrendes Budget: monat, quartal oder jahr (Kalenderperioden ab budget_start). null = Gesamtbudget oder kein Budget.';
comment on column public.projects.budget_hours is
  'Stunden pro Periode bei wiederkehrendem Budget. Gesetzt: Vergleich in Stunden, sonst in CHF (budget).';
comment on column public.projects.budget_start is
  'Beginn des wiederkehrenden Budgets. Zeiten davor zaehlen nicht. Pflicht, wenn budget_period gesetzt ist.';
