import { describe, it, expect } from 'vitest';
import { fitLogo } from './pdfGenerator';

describe('fitLogo', () => {
  it('begrenzt eine Querformat-Wortmarke ueber die Breite, ohne Verzerrung', () => {
    const { w, h } = fitLogo(920, 174, 60, 18);
    expect(w).toBe(60);
    expect(h).toBeCloseTo(11.35, 2);
    expect(w / h).toBeCloseTo(920 / 174, 6);
  });

  it('begrenzt ein Hochformat ueber die Hoehe', () => {
    const { w, h } = fitLogo(300, 600, 60, 18);
    expect(h).toBe(18);
    expect(w).toBe(9);
  });

  it('setzt ein quadratisches Logo auf 18 x 18 mm', () => {
    expect(fitLogo(500, 500, 60, 18)).toEqual({ w: 18, h: 18 });
  });

  it('faellt bei fehlenden Masszahlen auf ein Quadrat zurueck', () => {
    expect(fitLogo(0, 0, 60, 18)).toEqual({ w: 18, h: 18 });
  });
});
