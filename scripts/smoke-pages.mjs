// Rauchtest: rendert alle Hauptseiten mit Mock-Daten und meldet Fehleransichten.
// Aufruf (Dev-Server auf :5173): node scripts/smoke-pages.mjs
import { chromium } from 'playwright';
import { installMock } from './mock/route.mjs';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'de-CH', timezoneId: 'Europe/Zurich' });
await installMock(context);
// Neue Seiten und alte Adressen (Weiterleitungen); Stand UX-Struktur Oktober 2026
const routes = [
  '/', '/kontakte', '/kontakte?ansicht=personen', '/kontakte/firmen/00000000-0000-4000-8000-00000000c001', '/leads', '/pipeline', '/pipeline?darstellung=tabelle',
  '/offerten', '/offerten/00000000-0000-4000-8000-q00000000002', '/projekte', '/projekte/00000000-0000-4000-8000-p00000000001', '/zeiterfassung', '/zeiterfassung?ansicht=auswertung',
  '/rechnungen', '/rechnungen/00000000-0000-4000-8000-00000000f005', '/buchungen', '/buchungen?ansicht=unvollstaendig', '/berichte', '/berichte?tab=erfolgsrechnung',
  '/berichte?tab=jahresabschluss', '/berichte?tab=export',
  ...['unternehmen', 'ziele', 'kontostaende', 'fristen', 'rechnungen-offerten', 'leistungen', 'kategorien', 'pipeline', 'darstellung', 'benutzer'].map((b) => `/einstellungen/${b}`),
  '/sales', '/angebote', '/kunden', '/kunden/00000000-0000-4000-8000-00000000c001/kontakte', '/auswertungen', '/jahresabschluss', '/produkte', '/settings?tab=categories',
];
for (const r of routes) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errors.push(m.text().slice(0, 150)); });
  await page.goto('http://localhost:5173' + r, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const boundary = await page.getByText('Diese Ansicht konnte nicht geladen werden').count();
  const landed = new URL(page.url()).pathname + new URL(page.url()).search;
  console.log(r.padEnd(60).slice(0, 60), boundary ? 'FEHLERANSICHT' : 'ok', landed !== r ? `-> ${landed}` : '', errors.length ? errors.slice(0, 2).join(' | ') : '');
  await page.close();
}
await browser.close();
