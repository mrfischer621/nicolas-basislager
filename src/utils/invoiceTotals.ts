import { roundRappen, sumRappen } from './money';

/**
 * Betragsberechnung fuer Rechnungen und Angebote.
 *
 * Bewusst als reine Funktion ausserhalb der Formulare: vorher lag die Logik
 * als Closure in InvoiceForm bzw. QuoteForm und war dadurch nicht testbar -
 * genau der Grund, warum die Rappendifferenz jahrelang unbemerkt blieb.
 *
 * Rundungsregel: auf Rappen runden, sobald ein Betrag feststeht. Summen
 * entstehen aus bereits gerundeten Teilbetraegen, damit die angezeigten
 * Zeilen exakt die angezeigte Summe ergeben und
 * Zwischensumme + MwSt. = Total ausnahmslos gilt.
 */

export type DiscountType = 'percent' | 'fixed';

export interface TotalsInput {
  items: Array<{
    quantity: number;
    unitPrice: number;
    /** Rabatt auf die einzelne Zeile, in Prozent */
    discountPercent?: number;
    /** MwSt.-Satz dieser Zeile in Prozent. Fehlt er, greift defaultVatRate */
    vatRate?: number | null;
  }>;
  vatEnabled: boolean;
  defaultVatRate: number;
  discountType: DiscountType;
  /** Prozentwert oder CHF-Betrag, je nach discountType */
  discountValue: number;
}

export interface TotalsResult {
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  total: number;
  /** MwSt. je Zeile, bereits um den Gesamtrabatt reduziert */
  lineVatAmounts: number[];
}

export function calculateInvoiceTotals(input: TotalsInput): TotalsResult {
  const { items, vatEnabled, defaultVatRate, discountType, discountValue } = input;

  const lines = items.map(item => {
    const qty = Number.isFinite(item.quantity) ? item.quantity : 0;
    const price = Number.isFinite(item.unitPrice) ? item.unitPrice : 0;
    const lineDiscount = item.discountPercent ?? 0;

    const gross = qty * price;
    const netto = roundRappen(gross - gross * (lineDiscount / 100));

    let rate = 0;
    if (vatEnabled) {
      rate = item.vatRate === null || item.vatRate === undefined ? defaultVatRate : item.vatRate;
    }

    return { netto, vatAmount: roundRappen(netto * (rate / 100)) };
  });

  const subtotal = sumRappen(lines.map(l => l.netto));

  // Gesamtrabatt, begrenzt auf die Zwischensumme
  const rawDiscount = discountType === 'percent'
    ? subtotal * (discountValue / 100)
    : discountValue;
  const discountAmount = roundRappen(Math.max(0, Math.min(rawDiscount, subtotal)));

  const subtotalAfterDiscount = roundRappen(subtotal - discountAmount);

  // MwSt. proportional zum Rabatt kuerzen
  const factor = subtotal > 0 ? subtotalAfterDiscount / subtotal : 1;
  const lineVatAmounts = lines.map(l => roundRappen(l.vatAmount * factor));
  const vatAmount = sumRappen(lineVatAmounts);

  // Beide Summanden sind gerundet -> das Total geht exakt auf
  const total = roundRappen(subtotalAfterDiscount + vatAmount);

  return { subtotal, discountAmount, vatAmount, total, lineVatAmounts };
}
