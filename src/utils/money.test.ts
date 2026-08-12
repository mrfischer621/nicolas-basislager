import { describe, it, expect } from 'vitest';
import { roundRappen, sumRappen, formatChf } from './money';

describe('roundRappen', () => {
  it('rundet auf zwei Nachkommastellen', () => {
    expect(roundRappen(1.234)).toBe(1.23);
    expect(roundRappen(1.235)).toBe(1.24);
    expect(roundRappen(1.239)).toBe(1.24);
  });

  it('faengt den binaeren Grenzfall 1.005 ab', () => {
    // Math.round(1.005 * 100) / 100 ergibt 1.00, weil 1.005 binaer minimal
    // unter dem Grenzwert liegt. Das Epsilon korrigiert das.
    expect(roundRappen(1.005)).toBe(1.01);
    expect(roundRappen(8.045)).toBe(8.05);
  });

  it('laesst bereits gerundete Werte unveraendert', () => {
    expect(roundRappen(100)).toBe(100);
    expect(roundRappen(0)).toBe(0);
    expect(roundRappen(15.5)).toBe(15.5);
  });

  it('behandelt negative Betraege symmetrisch genug fuer Gutschriften', () => {
    expect(roundRappen(-1.234)).toBe(-1.23);
  });

  it('liefert 0 statt NaN oder Infinity', () => {
    expect(roundRappen(NaN)).toBe(0);
    expect(roundRappen(Infinity)).toBe(0);
  });
});

describe('sumRappen', () => {
  it('summiert und rundet das Ergebnis', () => {
    expect(sumRappen([0.1, 0.2])).toBe(0.3);
    expect(sumRappen([])).toBe(0);
  });

  it('vermeidet den klassischen Float-Fehler 0.1 + 0.2', () => {
    // Ohne Rundung waere das 0.30000000000000004
    expect(sumRappen([0.1, 0.2])).toBe(0.3);
    expect(0.1 + 0.2).not.toBe(0.3);
  });
});

describe('formatChf', () => {
  it('gibt immer zwei Nachkommastellen aus', () => {
    expect(formatChf(15)).toBe('15.00');
    expect(formatChf(15.5)).toBe('15.50');
    expect(formatChf(15.456)).toBe('15.46');
  });
});
