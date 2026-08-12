import { describe, it, expect } from 'vitest';
import { calculateInvoiceTotals } from './invoiceTotals';
import type { TotalsInput } from './invoiceTotals';

/** Kurzform fuer den Normalfall: MwSt. aktiv, Schweizer Normalsatz, kein Gesamtrabatt */
function totals(items: TotalsInput['items'], overrides: Partial<TotalsInput> = {}) {
  return calculateInvoiceTotals({
    items,
    vatEnabled: true,
    defaultVatRate: 8.1,
    discountType: 'percent',
    discountValue: 0,
    ...overrides,
  });
}

describe('calculateInvoiceTotals — Grundrechnung', () => {
  it('rechnet eine einzelne Position korrekt', () => {
    const r = totals([{ quantity: 1, unitPrice: 100 }]);
    expect(r.subtotal).toBe(100);
    expect(r.vatAmount).toBe(8.1);
    expect(r.total).toBe(108.1);
  });

  it('summiert mehrere Positionen', () => {
    const r = totals([
      { quantity: 2, unitPrice: 50 },
      { quantity: 3, unitPrice: 20 },
    ]);
    expect(r.subtotal).toBe(160);
    expect(r.total).toBe(172.96);
  });

  it('liefert Nullen bei leerer Position', () => {
    const r = totals([]);
    expect(r).toMatchObject({ subtotal: 0, vatAmount: 0, total: 0, discountAmount: 0 });
  });

  it('rechnet ohne MwSt., wenn die Firma nicht MwSt.-pflichtig ist', () => {
    const r = totals([{ quantity: 1, unitPrice: 100 }], { vatEnabled: false });
    expect(r.vatAmount).toBe(0);
    expect(r.total).toBe(100);
  });
});

describe('calculateInvoiceTotals — Rappendifferenzen (Regression)', () => {
  // Diese Faelle erzeugten in der alten Implementierung eine Rechnung, auf der
  // Zwischensumme + MwSt. nicht dem ausgewiesenen Total entsprach.
  const bekannteProblemfaelle = [15, 35, 55, 85, 95];

  it.each(bekannteProblemfaelle)('CHF %d bei 8.1%%: Zwischensumme + MwSt. = Total', (preis) => {
    const r = totals([{ quantity: 1, unitPrice: preis }]);
    expect(r.subtotal + r.vatAmount).toBeCloseTo(r.total, 10);
    // und die Teilbetraege sind selbst schon auf Rappen gerundet
    expect(r.subtotal).toBe(Math.round(r.subtotal * 100) / 100);
    expect(r.vatAmount).toBe(Math.round(r.vatAmount * 100) / 100);
  });

  // Hilfsfunktion: liegt der Wert exakt auf einem Rappen?
  const istAufRappen = (v: number) => Number.isInteger(Math.round(v * 100 * 1e6) / 1e6);

  it('haelt die Invariante ueber viele Kombinationen', () => {
    const saetze = [8.1, 2.6, 3.8];
    let geprueft = 0;
    for (const satz of saetze) {
      for (let menge = 1; menge <= 12; menge++) {
        for (let preis = 5; preis <= 200; preis += 0.25) {
          const r = totals([{ quantity: menge, unitPrice: preis }], { defaultVatRate: satz });

          // Die Invariante allein genuegt nicht: ohne jede Rundung waere sie
          // trivial erfuellt. Entscheidend ist, dass die Teilbetraege selbst
          // schon auf Rappen liegen - genau das war vorher nicht der Fall.
          expect(istAufRappen(r.subtotal)).toBe(true);
          expect(istAufRappen(r.vatAmount)).toBe(true);
          expect(istAufRappen(r.total)).toBe(true);
          expect(r.subtotal + r.vatAmount).toBeCloseTo(r.total, 10);
          geprueft++;
        }
      }
    }
    expect(geprueft).toBeGreaterThan(25000);
  });

  it('haelt die Invariante auch mit Rabatt und mehreren MwSt.-Saetzen', () => {
    const r = totals(
      [
        { quantity: 3, unitPrice: 33.33, vatRate: 8.1 },
        { quantity: 1, unitPrice: 12.55, vatRate: 2.6 },
        { quantity: 7, unitPrice: 4.95, vatRate: null },
      ],
      { discountType: 'percent', discountValue: 12.5 },
    );
    expect(r.subtotal - r.discountAmount + r.vatAmount).toBeCloseTo(r.total, 10);
  });
});

describe('calculateInvoiceTotals — Rabatte', () => {
  it('zieht einen Prozentrabatt von der Zwischensumme ab', () => {
    const r = totals([{ quantity: 1, unitPrice: 200 }], { discountValue: 10 });
    expect(r.discountAmount).toBe(20);
    expect(r.total).toBe(194.58); // 180 + 8.1% davon
  });

  it('zieht einen Fixrabatt ab', () => {
    const r = totals([{ quantity: 1, unitPrice: 200 }], {
      discountType: 'fixed',
      discountValue: 50,
    });
    expect(r.discountAmount).toBe(50);
    expect(r.subtotal).toBe(200);
  });

  it('begrenzt den Rabatt auf die Zwischensumme', () => {
    const r = totals([{ quantity: 1, unitPrice: 100 }], {
      discountType: 'fixed',
      discountValue: 500,
    });
    expect(r.discountAmount).toBe(100);
    expect(r.total).toBe(0);
  });

  it('ignoriert einen negativen Rabatt, statt den Betrag zu erhoehen', () => {
    const r = totals([{ quantity: 1, unitPrice: 100 }], {
      discountType: 'fixed',
      discountValue: -50,
    });
    expect(r.discountAmount).toBe(0);
    expect(r.total).toBe(108.1);
  });

  it('kuerzt die MwSt. proportional zum Gesamtrabatt', () => {
    const ohne = totals([{ quantity: 1, unitPrice: 100 }]);
    const mit = totals([{ quantity: 1, unitPrice: 100 }], { discountValue: 50 });
    expect(mit.vatAmount).toBeCloseTo(ohne.vatAmount / 2, 2);
  });

  it('beruecksichtigt Rabatt auf einzelne Zeilen', () => {
    const r = totals([{ quantity: 1, unitPrice: 100, discountPercent: 25 }]);
    expect(r.subtotal).toBe(75);
  });
});

describe('calculateInvoiceTotals — MwSt.-Saetze pro Zeile', () => {
  it('nutzt den Zeilensatz statt des Firmenstandards', () => {
    const r = totals([{ quantity: 1, unitPrice: 100, vatRate: 2.6 }]);
    expect(r.vatAmount).toBe(2.6);
  });

  it('faellt bei null auf den Firmenstandard zurueck', () => {
    const r = totals([{ quantity: 1, unitPrice: 100, vatRate: null }]);
    expect(r.vatAmount).toBe(8.1);
  });

  it('mischt verschiedene Saetze korrekt', () => {
    const r = totals([
      { quantity: 1, unitPrice: 100, vatRate: 8.1 },
      { quantity: 1, unitPrice: 100, vatRate: 2.6 },
    ]);
    expect(r.subtotal).toBe(200);
    expect(r.vatAmount).toBe(10.7);
    expect(r.lineVatAmounts).toEqual([8.1, 2.6]);
  });
});

describe('calculateInvoiceTotals — Robustheit', () => {
  it('behandelt NaN-Eingaben als 0, statt die Rechnung zu zerstoeren', () => {
    const r = totals([{ quantity: NaN, unitPrice: 100 }]);
    expect(r.total).toBe(0);
  });

  it('kommt mit Menge 0 zurecht', () => {
    const r = totals([{ quantity: 0, unitPrice: 100 }]);
    expect(r.subtotal).toBe(0);
  });
});
