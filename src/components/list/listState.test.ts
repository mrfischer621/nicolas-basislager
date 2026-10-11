import { describe, it, expect } from 'vitest';
import { activeFilterCount, ilikePattern, orSearch, pageRange, parseSort, readListState, writeListState } from './listState';

describe('Listenzustand in der URL', () => {
  it('liest Parameter und fuellt Standardwerte', () => {
    const s = readListState(new URLSearchParams('ansicht=offen&q=muster&firma='), { ansicht: 'alle', sort: '-issue_date' });
    expect(s).toEqual({ ansicht: 'offen', q: 'muster', sort: '-issue_date' });
  });

  it('schreibt nur Abweichungen vom Standard und setzt die Seite zurueck', () => {
    const next = writeListState(new URLSearchParams('ansicht=offen&seite=3'), { ansicht: 'alle', q: 'abc' }, { ansicht: 'alle' });
    expect(next.toString()).toBe('q=abc');
  });

  it('behaelt die Seite, wenn nur die Seite wechselt', () => {
    const next = writeListState(new URLSearchParams('ansicht=offen'), { seite: '2' });
    expect(next.get('seite')).toBe('2');
    expect(next.get('ansicht')).toBe('offen');
  });

  it('entfernt leere und null-Werte', () => {
    const next = writeListState(new URLSearchParams('q=abc&firma=1'), { q: '', firma: null });
    expect(next.toString()).toBe('');
  });

  it('zaehlt aktive Filter ohne Ansicht, Seite und Sortierung', () => {
    expect(activeFilterCount({ ansicht: 'offen', q: 'x', firma: '1', seite: '2', sort: 'nr' })).toBe(2);
    expect(activeFilterCount({ q: 'x' }, { q: 'x' })).toBe(0);
  });

  it('rechnet Seite in Bereich um', () => {
    expect(pageRange(1)).toEqual([0, 49]);
    expect(pageRange(3, 10)).toEqual([20, 29]);
    expect(pageRange(NaN)).toEqual([0, 49]);
  });

  it('liest die Sortierung', () => {
    expect(parseSort('-date', 'nr')).toEqual({ column: 'date', ascending: false });
    expect(parseSort(undefined, 'nr')).toEqual({ column: 'nr', ascending: true });
  });

  it('entschaerft Suchmuster', () => {
    expect(ilikePattern(' 50% ')).toBe('%50\\%%');
    expect(orSearch(['a', 'b'], 'x,(y)')).toBe('a.ilike.%x  y%,b.ilike.%x  y%');
  });
});
