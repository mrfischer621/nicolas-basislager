// Rauchtest: rendert alle Hauptseiten mit Mock-Daten und meldet Fehleransichten.
// Aufruf (Dev-Server auf :5173): node scripts/smoke-pages.mjs
import { chromium } from 'playwright';
import { installMock } from './mock/route.mjs';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'de-CH', timezoneId: 'Europe/Zurich' });
await installMock(context);
const routes = ['/', '/buchungen', '/rechnungen', '/jahresabschluss', '/auswertungen', '/settings', '/settings?tab=profile', '/kunden', '/projekte', '/produkte', '/zeiterfassung', '/angebote', '/sales', '/kontakte'];
for (const r of routes) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errors.push(m.text().slice(0, 150)); });
  await page.goto('http://localhost:5173' + r, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const boundary = await page.getByText('Diese Ansicht konnte nicht geladen werden').count();
  console.log(r.padEnd(24), boundary ? 'FEHLERANSICHT' : 'ok', errors.length ? errors.slice(0, 2).join(' | ') : '');
  await page.close();
}
await browser.close();
