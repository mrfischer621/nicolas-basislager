import type { Project } from '../lib/supabase';
import type { Level } from './cockpit';
import { amount, isUnbilled, type TimeRow } from './timeEntries';
import { sumRappen } from './money';

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

export interface ProjectStats {
  hours: number;
  /** verrechenbarer Betrag aller erfassten Zeiten */
  amount: number;
  unbilledHours: number;
  unbilledAmount: number;
  /** Verbrauch am Budget in Prozent, null ohne Budget */
  budgetUsed: number | null;
  level: Level;
}

export function projectStats(project: Pick<Project, 'id' | 'budget'>, rows: TimeRow[]): ProjectStats {
  const mine = rows.filter((r) => r.project_id === project.id);
  const sum = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) * 100) / 100;
  const billable = mine.filter((r) => r.billable);
  const unbilled = mine.filter(isUnbilled);
  const total = sumRappen(billable.map(amount));
  const budget = project.budget ? Number(project.budget) : null;
  const used = budget ? (total / budget) * 100 : null;
  return {
    hours: sum(mine.map((r) => Number(r.hours))),
    amount: total,
    unbilledHours: sum(unbilled.map((r) => Number(r.hours))),
    unbilledAmount: sumRappen(unbilled.map(amount)),
    budgetUsed: used,
    level: used === null ? 'ok' : used >= 100 ? 'negative' : used >= 80 ? 'warning' : 'ok',
  };
}
