import { describe, it, expect, vi } from 'vitest';
import { generateInvoicePDF } from './pdfGenerator';

/**
 * Prueft die QR-Rechnung im erzeugten PDF gegen Style Guide QR-Rechnung 1.1
 * (Seite 6 «Praezise Masse») und IG QR-Rechnung 2.3 (Kap. 6.4):
 * Swiss QR Code exakt 46 x 46 mm, oben links bei x 67 / y 209 mm
 * (Zahlteil ab x 62 + 5 mm Rand, Schnittkante y 192 + 5 Rand + 7 Titel + 5).
 */

// Schriften gibt es in der Testumgebung nicht: Generator faellt auf Helvetica zurueck
vi.stubGlobal('fetch', async () => new Response(null, { status: 404 }));

const company = {
  id: 'c1', name: 'ZZ Testfirma', rechnungsname: 'ZZ Testfirma', qr_creditor_name: 'Test Person',
  street: 'Musterstrasse', house_number: '12', zip_code: '8500', city: 'Frauenfeld', country: 'CH',
  iban: 'CH9300762011623852957', qr_iban: null, logo_url: null,
} as never;
const customer = { id: 'k1', name: 'Beispiel GmbH', street: 'Bahnhofstrasse', house_number: '5', zip_code: '8570', city: 'Weinfelden', country: 'CH' } as never;
const invoice = {
  id: 'r1', invoice_number: 'RE-2026-014', issue_date: '2026-10-11', due_date: '2026-11-10', status: 'versendet',
  subtotal: 2390, vat_rate: 0, vat_amount: 0, total: 2390, discount_type: 'none', discount_value: 0, title: null,
} as never;
const items = [{ id: 'i1', description: 'Workshop', quantity: 1, unit_price: 2390, discount_percent: 0, total: 2390 }] as never;

const PT_PER_MM = 72 / 25.4;

describe('QR-Rechnung: Abmessungen im PDF', () => {
  it('zeichnet den Swiss QR Code als Vektor, 46 x 46 mm an x 67 / y 209 mm', async () => {
    const blob = await generateInvoicePDF({ invoice, items, customer, company });
    const pdf = await blob.text();
    // letzte Seite = QR-Rechnung; schwarze Rechtecke ("x y w h re" nach "0 g")
    const pages = pdf.split('/Type /Page\n');
    const content = pdf;
    const rects = [...content.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) (-?[\d.]+) re\nf/g)].map((m) => m.slice(1, 5).map(Number));
    expect(pages.length).toBeGreaterThan(1);
    expect(rects.length).toBeGreaterThan(200); // Module als Rechtecke, kein Rasterbild
    // Bereich des QR-Codes: alle Rechtecke links von x = 113.5 mm und unterhalb y = 205 mm
    const pageH = 297 * PT_PER_MM;
    const qr = rects
      .map(([x, y, w, h]) => {
        const top = h < 0 ? y + h : y; // jsPDF zeichnet mit negativer Hoehe
        const height = Math.abs(h);
        return { x1: x / PT_PER_MM, x2: (x + w) / PT_PER_MM, y1: (pageH - (top + height)) / PT_PER_MM, y2: (pageH - top) / PT_PER_MM };
      })
      .filter((r) => r.x1 >= 66 && r.x2 <= 114 && r.y1 >= 208 && r.y2 <= 256);
    const minX = Math.min(...qr.map((r) => r.x1));
    const maxX = Math.max(...qr.map((r) => r.x2));
    const minY = Math.min(...qr.map((r) => r.y1));
    const maxY = Math.max(...qr.map((r) => r.y2));
    expect(minX).toBeCloseTo(67, 1);
    expect(minY).toBeCloseTo(209, 1);
    expect(maxX - minX).toBeCloseTo(46, 1);
    expect(maxY - minY).toBeCloseTo(46, 1);
    // Schweizerkreuz: Logo 7 x 7 mm exakt mittig auf dem QR-Code (90 / 232 mm),
    // weisses Kreuz nach der offiziellen SIX-Datei (Raster 19.8 = 7 mm)
    const u = 7 / 19.8;
    const boxes = rects.map(([x, y, w, h]) => {
      const top = h < 0 ? y + h : y;
      const height = Math.abs(h);
      return { x1: x / PT_PER_MM, y1: (pageH - (top + height)) / PT_PER_MM, w: w / PT_PER_MM, h: height / PT_PER_MM };
    });
    const logo = boxes.find((b) => Math.abs(b.w - 7) < 0.001 && Math.abs(b.h - 7) < 0.001);
    expect(logo).toBeDefined();
    expect(logo!.x1 + 3.5).toBeCloseTo(90, 3);
    expect(logo!.y1 + 3.5).toBeCloseTo(232, 3);
    const vertical = boxes.find((b) => Math.abs(b.w - 3.3 * u) < 0.001 && Math.abs(b.h - 11 * u) < 0.001);
    const horizontal = boxes.find((b) => Math.abs(b.w - 11 * u) < 0.001 && Math.abs(b.h - 3.3 * u) < 0.001);
    expect(vertical!.x1 - logo!.x1).toBeCloseTo(8.3 * u, 3);
    expect(vertical!.y1 - logo!.y1).toBeCloseTo(4 * u, 3);
    expect(horizontal!.x1 - logo!.x1).toBeCloseTo(4.4 * u, 3);
    expect(horizontal!.y1 - logo!.y1).toBeCloseTo(7.9 * u, 3);
    // gedruckt wird nur, was im QR-Code steht: Faelligkeit in der Mitteilung
    expect(pdf).not.toContain('Fällig:');
  });
});
