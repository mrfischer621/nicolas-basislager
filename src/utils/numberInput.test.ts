import { describe, it, expect } from 'vitest';
import { parseNumber } from './numberInput';

describe('parseNumber', () => {
  it('liest Punkt, Komma und Tausender-Apostroph (Handy-Tastatur)', () => {
    expect(parseNumber('70.05')).toBe(70.05);
    expect(parseNumber('70,05')).toBe(70.05);
    expect(parseNumber("1'234.50")).toBe(1234.5);
    expect(parseNumber(' 12 ')).toBe(12);
  });
  it('liefert null fuer leer oder Unsinn', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
  });
});
