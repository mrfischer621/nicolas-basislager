// Erzeugt Muster-PDFs (Rechnung, Offerte) mit erfundenen Testdaten ueber den
// echten Generator im Browser (Vite-Dev-Server auf :5173).
// Aufruf: node scripts/pdf-muster/render.mjs <ausgabeordner>
import { chromium } from 'playwright';
import fs from 'node:fs';

const out = process.argv[2] ?? 'docs/design-review/pdf';
fs.mkdirSync(out, { recursive: true });

const company = {
  id: 'c1', name: 'ZZ Testfirma', rechnungsname: 'ZZ Testfirma', alternativ_name: 'Testfirma IT',
  sender_contact_name: 'Test Person', street: 'Musterstrasse', house_number: '12', zip_code: '8500', city: 'Frauenfeld',
  country: 'CH', iban: 'CH93 0076 2011 6238 5295 7', qr_iban: null, qr_creditor_name: 'Test Person', bank_name: 'Testbank',
  uid_number: 'CHE-123.456.789', vat_registered: false, vat_number: null, phone: '+41 52 000 00 00',
  email: 'hallo@example.ch', website: 'www.example.ch', logo_url: null, created_at: '2026-01-01',
};
const customer = {
  id: 'k1', company_id: 'c1', name: 'Beispiel GmbH', contact_person: 'Frau Muster', street: 'Bahnhofstrasse',
  house_number: '5', zip_code: '8570', city: 'Weinfelden', country: 'CH',
};
const items = [
  { id: 'i1', description: 'Workshop Prozessanalyse\nHalbtag vor Ort, inklusive Vorbereitung und Protokoll', quantity: 1, unit_price: 1200, discount_percent: 0, total: 1200 },
  { id: 'i2', description: 'Automatisierung Belegerfassung\nEinrichtung, Test und Übergabe', quantity: 6.5, unit_price: 140, discount_percent: 0, total: 910 },
  { id: 'i3', description: 'Betreuung Oktober', quantity: 2, unit_price: 140, discount_percent: 0, total: 280 },
];
// MANY=1: lange Rechnung ueber mehrere Seiten
if (process.env.MANY === '1') {
  for (let i = 4; i <= 22; i++) items.push({ id: `i${i}`, description: `Position ${i}\nKurze Beschreibung der Leistung`, quantity: 1, unit_price: 100, discount_percent: 0, total: 100 });
}
const invoice = {
  id: 'r1', company_id: 'c1', customer_id: 'k1', invoice_number: 'RE-2026-014', issue_date: '2026-10-11', due_date: '2026-11-10',
  status: 'versendet', subtotal: 2390, vat_rate: 0, vat_amount: 0, total: 2390, discount_type: 'none', discount_value: 0,
  title: 'Projekt Belegerfassung', paid_at: null,
};
const quote = {
  id: 'q1', company_id: 'c1', customer_id: 'k1', quote_number: 'OF-2026-007', issue_date: '2026-10-11', valid_until: '2026-11-10',
  status: 'offen', subtotal: 2390, vat_rate: 0, vat_amount: 0, total: 2390, discount_type: 'percent', discount_value: 5,
};
const logoPath = process.env.LOGO;
const logoBase64 = logoPath ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}` : null;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5173/login');
const result = await page.evaluate(
  async ({ company, customer, items, invoice, quote, logoBase64 }) => {
    const m = await import('/src/utils/pdfGenerator.ts');
    const toB64 = async (blob) => {
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
      return btoa(s);
    };
    const inv = await m.generateInvoicePDF({ invoice, items, customer, company, logoBase64, introText: 'Guten Tag\n\nVielen Dank für den Auftrag. Wir stellen Ihnen die folgenden Leistungen in Rechnung.', footerText: 'Zahlbar innert 30 Tagen. Freundliche Grüsse' });
    const quo = await m.generateQuotePDF({
      quote: { ...quote, total: 2270.5 },
      items,
      customer,
      company,
      logoBase64,
      introText: 'Gerne unterbreiten wir Ihnen folgende Offerte.',
      footerText: 'Wir freuen uns auf Ihren Auftrag.',
    });
    return { inv: await toB64(inv), quo: await toB64(quo) };
  },
  { company, customer, items, invoice, quote, logoBase64 }
);
const suffix = (logoPath ? '-mit-logo' : '') + (process.env.MANY === '1' ? '-lang' : '');
fs.writeFileSync(`${out}/muster-rechnung${suffix}.pdf`, Buffer.from(result.inv, 'base64'));
fs.writeFileSync(`${out}/muster-offerte${suffix}.pdf`, Buffer.from(result.quo, 'base64'));
console.log('geschrieben:', out);
await browser.close();
