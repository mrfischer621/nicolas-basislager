import { describe, it, expect } from 'vitest';
import type { PipelineStage } from '../lib/supabase';
import { boardStages, columnSummaries, daysSinceContact, firstDealStage, isOverdueAction, leadCounts, opportunityCompany, weightedPipeline, type OpportunityRow } from './pipeline';

const TODAY = '2026-10-11';
const stage = (id: string, name: string, position: number, probability: number | null, extra: Partial<PipelineStage> = {}): PipelineStage => ({
  id, company_id: 'c', name, position, color: '', created_at: '', updated_at: '', probability, is_won: false, is_lead_stage: false, ...extra,
});
const stages = [
  stage('s0', 'Recherche', 0, null, { is_lead_stage: true }),
  stage('s1', 'Erstgespräch', 1, 10),
  stage('s2', 'Analyse', 2, 30),
  stage('s3', 'Offerte', 3, 50),
  stage('s5', 'Gewonnen', 5, 100, { is_won: true }),
];
const deal = (id: string, stage_id: string, value: number | null, extra: Partial<OpportunityRow> = {}): OpportunityRow => ({
  id, company_id: 'c', existing_customer_id: null, prospect_info: { company: `Firma ${id}` }, title: `Deal ${id}`, stage_id,
  expected_value: value, last_contact_at: '2026-10-01T09:00:00Z', next_action_date: null, notes: null, is_lost: false,
  created_at: '', updated_at: '', kind: 'deal', lead_status: null, source: null, ...extra,
});

describe('Pipeline: Spalten', () => {
  it('blendet die Lead-Stufe aus und findet die erste Deal-Stufe', () => {
    expect(boardStages(stages).map((s) => s.name)).toEqual(['Erstgespräch', 'Analyse', 'Offerte', 'Gewonnen']);
    expect(firstDealStage(stages)?.name).toBe('Erstgespräch');
  });

  it('summiert pro Spalte, gewichtet nach Wahrscheinlichkeit, ohne Verlorene und Leads', () => {
    const deals = [
      deal('a', 's1', 490),
      deal('b', 's1', 4490),
      deal('c', 's3', 4490),
      deal('d', 's3', 1000, { is_lost: true }),
      deal('e', 's0', 999, { kind: 'lead' }),
      deal('f', 's2', null),
    ];
    const cols = columnSummaries(stages, deals);
    expect(cols.map((c) => [c.stage.name, c.count, c.sum, c.weighted])).toEqual([
      ['Erstgespräch', 2, 4980, 498],
      ['Analyse', 1, 0, 0],
      ['Offerte', 1, 4490, 2245],
      ['Gewonnen', 0, 0, 0],
    ]);
    // Verlorene sichtbar, aber nicht in der Summe
    const withLost = columnSummaries(stages, deals, { showLost: true });
    expect(withLost[2]).toMatchObject({ count: 2, sum: 4490 });
  });

  it('kommt ohne Deals und ohne Wahrscheinlichkeit zurecht', () => {
    expect(columnSummaries(stages, []).every((c) => c.count === 0 && c.sum === 0)).toBe(true);
    const noProb = [stage('x', 'Neu', 1, null)];
    expect(columnSummaries(noProb, [deal('a', 'x', 100)])[0].weighted).toBe(0);
  });
});

describe('Pipeline: gewichteter Wert', () => {
  const deals = [
    deal('a', 's1', 1000, { next_action_date: '2026-10-20' }),
    deal('b', 's3', 4000, { next_action_date: '2027-03-01' }),
    deal('c', 's3', 2000),
    deal('w', 's5', 9000),
    deal('l', 's3', 5000, { is_lost: true }),
  ];
  it('rechnet offene Deals ohne Gewonnene und Verlorene', () => {
    expect(weightedPipeline(stages, deals, TODAY)).toEqual({ open: 7000, weighted: 3100, count: 3 });
  });
  it('beschraenkt auf drei Monate nach naechster Aktion', () => {
    expect(weightedPipeline(stages, deals, TODAY, 90)).toEqual({ open: 3000, weighted: 1100, count: 2 });
  });
});

describe('Pipeline: Hinweise und Leads', () => {
  it('erkennt ueberfaellige Aktionen und alte Kontakte', () => {
    expect(isOverdueAction({ next_action_date: '2026-10-10' }, TODAY)).toBe(true);
    expect(isOverdueAction({ next_action_date: '2026-10-11' }, TODAY)).toBe(false);
    expect(daysSinceContact({ last_contact_at: '2026-09-23T09:00:00Z' }, TODAY)).toBe(18);
  });
  it('zaehlt Leads pro Status', () => {
    expect(leadCounts([{ lead_status: 'neu' }, { lead_status: null }, { lead_status: 'kein_interesse' }])).toEqual({ neu: 2, kontaktiert: 0, kein_interesse: 1, alle: 3 });
  });
  it('nimmt den Namen der verknuepften Firma vor dem Interessenten', () => {
    expect(opportunityCompany(deal('a', 's1', 0, { customers: { name: 'Beispiel GmbH' } }))).toBe('Beispiel GmbH');
    expect(opportunityCompany(deal('a', 's1', 0))).toBe('Firma a');
  });
});
