import type { Project } from '../lib/supabase';
import type { Level } from './cockpit';
import { amount, isUnbilled, type InvoicePreset, type TimeRow } from './timeEntries';
import { formatChfDisplay, sumRappen } from './money';
import { zurichDay } from './financeAggregation';

export type ProjectView = 'laufend' | 'offen' | 'abgeschlossen' | 'archiviert' | 'alle';

export const PROJECT_VIEWS: { value: ProjectView; label: string }[] = [
  { value: 'laufend', label: 'Laufend' },
  { value: 'offen', label: 'Offen' },
  { value: 'abgeschlossen', label: 'Abgeschlossen' },
  { value: 'archiviert', label: 'Archiviert' },
  { value: 'alle', label: 'Alle' },
];

export const PROJECT_STATUS_LABEL: Record<Project['status'], string> = { offen: 'Offen', laufend: 'Laufend', abgeschlossen: 'Abgeschlossen' };
export const PROJECT_STATUS_BADGE: Record<Project['status'], string> = { offen: 'badge-neutral', laufend: 'badge-info', abgeschlossen: 'badge-positive' };

/** Archiviert ist ein eigenes Flag; archivierte Projekte erscheinen nur im Tab Archiviert und Alle. */
export function matchesProjectView(p: Pick<Project, 'status' | 'is_active'>, view: ProjectView): boolean {
  if (view === 'alle') return true;
  if (view === 'archiviert') return !p.is_active;
  return p.is_active && p.status === view;
}

// ---------------------------------------------------------------------------
// Budget: kein, gesamt oder wiederkehrend pro Kalenderperiode
// ---------------------------------------------------------------------------

export type BudgetPeriod = NonNullable<Project['budget_period']>;
export type BudgetMode = 'none' | 'total' | 'recurring';

export const BUDGET_PERIOD_LABEL: Record<BudgetPeriod, string> = { monat: 'Monat', quartal: 'Quartal', jahr: 'Jahr' };

type BudgetFields = Pick<Project, 'id' | 'budget'> & Partial<Pick<Project, 'budget_period' | 'budget_hours' | 'budget_start'>>;

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const round2 = (x: number) => Math.round(x * 100) / 100;
const sumHours = (xs: number[]) => round2(xs.reduce((s, x) => s + x, 0));

/** Wiederkehrend nur mit Intervall und Beginn; sonst wie bisher (Gesamtbudget oder keins). */
export function budgetModeOf(p: BudgetFields): BudgetMode {
  if (p.budget_period && p.budget_start) return 'recurring';
  return p.budget ? 'total' : 'none';
}

/**
 * Kalenderperiode, in die ein Tag faellt (alle Tage als Zuercher Kalendertag
 * YYYY-MM-DD). Die erste Periode beginnt erst am Beginn, zaehlt aber voll
 * (keine anteiligen Budgets). Vor dem Beginn: null.
 */
export function budgetPeriodOf(day: string, period: BudgetPeriod, start: string): { from: string; to: string; label: string } | null {
  if (day < start) return null;
  const y = Number(day.slice(0, 4));
  const m = Number(day.slice(5, 7));
  let fromM: number;
  let toM: number;
  let label: string;
  if (period === 'monat') {
    fromM = toM = m;
    label = `${MONTH_NAMES[m - 1]} ${y}`;
  } else if (period === 'quartal') {
    const q = Math.floor((m - 1) / 3);
    fromM = q * 3 + 1;
    toM = q * 3 + 3;
    label = `Q${q + 1} ${y}`;
  } else {
    fromM = 1;
    toM = 12;
    label = String(y);
  }
  const calendarFrom = `${y}-${pad(fromM)}-01`;
  return { from: calendarFrom < start ? start : calendarFrom, to: `${y}-${pad(toM)}-${pad(lastDay(y, toM))}`, label };
}

export interface BudgetPeriodSummary {
  from: string;
  to: string;
  label: string;
  budgetHours: number | null;
  budgetAmount: number | null;
  /** verrechenbare Stunden in der Periode (verrechnet oder nicht) */
  hours: number;
  amount: number;
  /** Verbrauch in Prozent: Stunden, wenn gesetzt, sonst Betrag; null ohne vergleichbares Budget */
  usedPercent: number | null;
  /** Erfasst minus Budget: positiv = Mehraufwand, negativ = Rest; null ohne Stundenbudget */
  overHours: number | null;
  /** Erfasst minus Budget in CHF: positiv = Mehraufwand, negativ = Rest; null ohne Betrag */
  overAmount: number | null;
  unbilledHours: number;
  unbilledAmount: number;
  isCurrent: boolean;
  isClosed: boolean;
}

/**
 * Perioden eines wiederkehrenden Budgets ab Beginn bis und mit der laufenden,
 * neueste zuerst, hoechstens `count`. Ohne wiederkehrendes Budget oder vor
 * dem Beginn: leer. Kein Uebertrag zwischen Perioden.
 */
export function periodHistory(project: BudgetFields, rows: TimeRow[], today: string, count = 12): BudgetPeriodSummary[] {
  if (budgetModeOf(project) !== 'recurring') return [];
  const period = project.budget_period!;
  const start = project.budget_start!;
  const budgetHours = project.budget_hours !== null && project.budget_hours !== undefined ? Number(project.budget_hours) : null;
  const budgetAmount = project.budget !== null && project.budget !== undefined ? Number(project.budget) : null;
  const billable = rows.filter((r) => r.project_id === project.id && r.billable);

  const out: BudgetPeriodSummary[] = [];
  let p = budgetPeriodOf(today, period, start);
  while (p && out.length < count) {
    const { from, to } = p;
    const inPeriod = billable.filter((r) => r.date >= from && r.date <= to);
    const unbilled = inPeriod.filter(isUnbilled);
    const hours = sumHours(inPeriod.map((r) => Number(r.hours)));
    const amt = sumRappen(inPeriod.map(amount));
    const usedPercent = budgetHours ? (hours / budgetHours) * 100 : budgetAmount ? (amt / budgetAmount) * 100 : null;
    out.push({
      ...p,
      budgetHours,
      budgetAmount,
      hours,
      amount: amt,
      usedPercent,
      overHours: budgetHours === null ? null : round2(hours - budgetHours),
      overAmount: budgetAmount === null ? null : round2(amt - budgetAmount),
      unbilledHours: sumHours(unbilled.map((r) => Number(r.hours))),
      unbilledAmount: sumRappen(unbilled.map(amount)),
      isCurrent: today >= from && today <= to,
      isClosed: to < today,
    });
    const before = addDaysIso(from, -1);
    p = budgetPeriodOf(before, period, start);
  }
  return out;
}

function addDaysIso(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Ampel wie bisher: ab 80 % warning, ab 100 % negative. */
export function budgetLevel(used: number | null): Level {
  return used === null ? 'ok' : used >= 100 ? 'negative' : used >= 80 ? 'warning' : 'ok';
}

export interface ProjectStats {
  hours: number;
  /** verrechenbarer Betrag aller erfassten Zeiten */
  amount: number;
  unbilledHours: number;
  unbilledAmount: number;
  /** Verbrauch am Budget in Prozent, null ohne Budget; bei wiederkehrend die laufende Periode */
  budgetUsed: number | null;
  level: Level;
  budgetMode: BudgetMode;
  /** laufende Periode (nur wiederkehrend, null vor dem Beginn) */
  period: BudgetPeriodSummary | null;
}

export function projectStats(project: BudgetFields, rows: TimeRow[], today: string = zurichDay(new Date())): ProjectStats {
  const mine = rows.filter((r) => r.project_id === project.id);
  const billable = mine.filter((r) => r.billable);
  const unbilled = mine.filter(isUnbilled);
  const total = sumRappen(billable.map(amount));
  const mode = budgetModeOf(project);
  let used: number | null;
  let period: BudgetPeriodSummary | null = null;
  if (mode === 'recurring') {
    const current = periodHistory(project, rows, today, 1)[0];
    period = current?.isCurrent ? current : null;
    used = period?.usedPercent ?? null;
  } else {
    const budget = project.budget ? Number(project.budget) : null;
    used = budget ? (total / budget) * 100 : null;
  }
  return {
    hours: sumHours(mine.map((r) => Number(r.hours))),
    amount: total,
    unbilledHours: sumHours(unbilled.map((r) => Number(r.hours))),
    unbilledAmount: sumRappen(unbilled.map(amount)),
    budgetUsed: used,
    level: budgetLevel(used),
    budgetMode: mode,
    period,
  };
}

/**
 * Vorbelegung fuer den Rechnungsentwurf eines wiederkehrenden Projekts:
 * wiederkehrender Umsatz an, Titel «<Projekt> <Periode der aeltesten Zeit>».
 * Nur Vorschlag, im Formular aenderbar. Andere Projekte: unveraendert.
 */
export function withRecurringDefaults(preset: InvoicePreset, project: (BudgetFields & Pick<Project, 'name'>) | undefined, rows: TimeRow[]): InvoicePreset {
  if (!project || preset.projectId !== project.id || budgetModeOf(project) !== 'recurring') return preset;
  const oldest = rows.map((r) => r.date).sort()[0];
  if (!oldest) return { ...preset, isRecurringRevenue: true };
  const label = budgetPeriodOf(oldest, project.budget_period!, project.budget_start!)?.label ?? `${MONTH_NAMES[Number(oldest.slice(5, 7)) - 1]} ${oldest.slice(0, 4)}`;
  return { ...preset, title: `${project.name} ${label}`, isRecurringRevenue: true };
}

const chf0 = (n: number) => formatChfDisplay(n, { decimals: 0 });

/** Verbrauch der Periode in der Vergleichseinheit: «0.50 von 1.00 h» oder «CHF 65 von CHF 130». */
export function periodUsageText(p: BudgetPeriodSummary): string {
  if (p.budgetHours !== null && p.budgetHours > 0) return `${p.hours.toFixed(2)} von ${p.budgetHours.toFixed(2)} h`;
  if (p.budgetAmount !== null) return `${chf0(p.amount)} von ${chf0(p.budgetAmount)}`;
  return `${p.hours.toFixed(2)} h`;
}

/** Budget pro Periode: «1.00 h · CHF 130», «1.00 h» oder «CHF 130». */
export function periodBudgetText(p: Pick<BudgetPeriodSummary, 'budgetHours' | 'budgetAmount'>): string {
  return [p.budgetHours !== null ? `${p.budgetHours.toFixed(2)} h` : null, p.budgetAmount !== null ? chf0(p.budgetAmount) : null].filter(Boolean).join(' · ') || '–';
}

/** Differenz in der Vergleichseinheit (Stunden vor Betrag), null ohne Budget. */
export function periodDiffText(p: BudgetPeriodSummary): string | null {
  if (p.budgetHours !== null && p.budgetHours > 0 && p.overHours !== null) return formatBudgetDiff(p.overHours, 'h', chf0);
  if (p.overAmount !== null) return formatBudgetDiff(p.overAmount, 'chf', chf0);
  return null;
}

/** true, wenn die Periode ueber dem Budget liegt (Mehraufwand) */
export function isOverBudget(p: BudgetPeriodSummary): boolean {
  return p.usedPercent !== null && p.usedPercent > 100;
}

/** Differenz zum Budget als Text mit Vorzeichen und Wort, z. B. «+1.00 h Mehraufwand», «−0.50 h Rest». */
export function formatBudgetDiff(diff: number, unit: 'h' | 'chf', formatChf: (n: number) => string): string {
  const abs = Math.abs(diff);
  const value = unit === 'h' ? `${abs.toFixed(2)} h` : formatChf(abs);
  if (diff > 0) return `+${value} Mehraufwand`;
  if (diff < 0) return `−${value} Rest`;
  return `${value} Rest`;
}
