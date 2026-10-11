import type { LeadStatus, Opportunity, PipelineStage } from '../lib/supabase';
import { addDays, toDay } from './financeAggregation';
import { roundRappen, sumRappen } from './money';

/** Deal oder Lead mit verknuepftem Firmennamen aus der Abfrage. */
export type OpportunityRow = Opportunity & { customers?: { name: string } | null };

/** Anzeigename der Firma: bestehende Firma, sonst Interessent. */
export function opportunityCompany(o: OpportunityRow): string {
  return o.customers?.name ?? o.prospect_info?.company ?? o.prospect_info?.name ?? 'Ohne Firma';
}

export function opportunityPerson(o: OpportunityRow): string | null {
  const p = o.prospect_info;
  if (!p) return null;
  const person = p.contact_person || (p.company ? p.name : null);
  return person || null;
}

export function isLead(o: Pick<Opportunity, 'kind'>): boolean {
  return o.kind === 'lead';
}

/** Board-Stufen: ohne Lead-Stufe, nach Position. */
export function boardStages(stages: PipelineStage[]): PipelineStage[] {
  return stages.filter((s) => !s.is_lead_stage).sort((a, b) => a.position - b.position);
}

/** Erste offene Stufe fuer neue Deals und uebernommene Leads (z.B. Erstgespraech). */
export function firstDealStage(stages: PipelineStage[]): PipelineStage | undefined {
  return boardStages(stages).find((s) => !s.is_won);
}

export function isOverdueAction(o: Pick<Opportunity, 'next_action_date'>, today: string): boolean {
  return !!o.next_action_date && toDay(o.next_action_date) < today;
}

export function isDueAction(o: Pick<Opportunity, 'next_action_date'>, today: string): boolean {
  return !!o.next_action_date && toDay(o.next_action_date) <= today;
}

/** Tage seit dem letzten Kontakt; ab 14 Tagen ein dezenter Hinweis. */
export function daysSinceContact(o: Pick<Opportunity, 'last_contact_at'>, today: string): number | null {
  if (!o.last_contact_at) return null;
  const a = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const d = toDay(o.last_contact_at);
  const b = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  return Math.round((a - b) / 86_400_000);
}

export const STALE_CONTACT_DAYS = 14;

export interface ColumnSummary {
  stage: PipelineStage;
  deals: OpportunityRow[];
  count: number;
  sum: number;
  weighted: number;
}

/** Spaltenkoepfe: Anzahl, Summe und gewichtete Summe (Betrag x Wahrscheinlichkeit). */
export function columnSummaries(stages: PipelineStage[], deals: OpportunityRow[], options: { showLost?: boolean } = {}): ColumnSummary[] {
  return boardStages(stages).map((stage) => {
    const inStage = deals.filter((d) => d.stage_id === stage.id && !isLead(d) && (options.showLost || !d.is_lost));
    const open = inStage.filter((d) => !d.is_lost);
    const p = (stage.probability ?? 0) / 100;
    return {
      stage,
      deals: inStage,
      count: inStage.length,
      sum: sumRappen(open.map((d) => Number(d.expected_value ?? 0))),
      weighted: sumRappen(open.map((d) => roundRappen(Number(d.expected_value ?? 0) * p))),
    };
  });
}

/**
 * Gewichteter Pipeline-Wert offener Deals (ohne gewonnene und verlorene).
 * Mit `horizonDays`: nur Deals, deren naechste Aktion bis dahin faellt oder
 * kein Datum hat (Annahme: in Bearbeitung).
 */
export function weightedPipeline(stages: PipelineStage[], deals: OpportunityRow[], today: string, horizonDays?: number): { open: number; weighted: number; count: number } {
  const byId = new Map(stages.map((s) => [s.id, s]));
  const limit = horizonDays !== undefined ? addDays(today, horizonDays) : null;
  const relevant = deals.filter((d) => {
    const s = byId.get(d.stage_id);
    if (!s || isLead(d) || d.is_lost || s.is_won || s.is_lead_stage) return false;
    return !limit || !d.next_action_date || toDay(d.next_action_date) <= limit;
  });
  return {
    open: sumRappen(relevant.map((d) => Number(d.expected_value ?? 0))),
    weighted: sumRappen(relevant.map((d) => roundRappen(Number(d.expected_value ?? 0) * ((byId.get(d.stage_id)?.probability ?? 0) / 100)))),
    count: relevant.length,
  };
}

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  neu: 'Neu',
  kontaktiert: 'Kontaktiert',
  kein_interesse: 'Kein Interesse',
};

export const LEAD_STATUS_BADGE: Record<LeadStatus, string> = {
  neu: 'badge-info',
  kontaktiert: 'badge-neutral',
  kein_interesse: 'badge-neutral',
};

export type LeadView = 'neu' | 'kontaktiert' | 'kein_interesse' | 'alle';

export function leadCounts(leads: Pick<Opportunity, 'lead_status'>[]): Record<LeadView, number> {
  const c: Record<LeadView, number> = { neu: 0, kontaktiert: 0, kein_interesse: 0, alle: leads.length };
  for (const l of leads) c[(l.lead_status ?? 'neu') as LeadStatus]++;
  return c;
}
