import { describe, it, expect } from 'vitest';
import type { Deadline } from '../lib/supabase';
import { deadlineTemplates, nextOccurrence, upcomingDeadlines } from './deadlines';

describe('Fristen', () => {
  it('rechnet den naechsten Termin', () => {
    expect(nextOccurrence('2026-10-20', 'monatlich')).toBe('2026-11-20');
    expect(nextOccurrence('2026-11-15', 'quartalsweise')).toBe('2027-02-15');
    expect(nextOccurrence('2026-03-31', 'jaehrlich')).toBe('2027-03-31');
    expect(nextOccurrence('2026-10-20', 'einmalig')).toBeNull();
  });

  it('haelt das Monatsende', () => {
    expect(nextOccurrence('2026-01-31', 'monatlich')).toBe('2026-02-28');
    expect(nextOccurrence('2026-02-28', 'monatlich')).toBe('2026-03-31');
    expect(nextOccurrence('2026-12-31', 'quartalsweise')).toBe('2027-03-31');
    expect(nextOccurrence('2026-01-30', 'monatlich')).toBe('2026-02-28');
  });

  it('listet offene Fristen der naechsten 14 Tage inklusive ueberfaelliger', () => {
    const d = (id: string, due_date: string, done = false): Deadline => ({ id, company_id: 'c', title: id, due_date, recurrence: 'einmalig', done_at: done ? '2026-10-01T00:00:00Z' : null, note: null, created_at: '' });
    const list = [d('spaet', '2026-10-30'), d('bald', '2026-10-20'), d('vorbei', '2026-10-01'), d('erledigt', '2026-10-12', true)];
    expect(upcomingDeadlines(list, '2026-10-11').map((x) => x.id)).toEqual(['vorbei', 'bald']);
    expect(upcomingDeadlines([], '2026-10-11')).toEqual([]);
  });

  it('bietet Vorlagen mit sinnvollen Daten', () => {
    const t = deadlineTemplates('2026-10-11');
    expect(t[0]).toMatchObject({ due_date: '2027-03-31', recurrence: 'jaehrlich' });
    expect(t[1].due_date).toBe('2026-12-31');
  });
});
