// Screenshots aller Seiten, Detailansichten und Masken fuer docs/ux-struktur/.
// Nur mit erfundenen Testdaten (MOCK), weil das Repository oeffentlich ist.
// Aufruf: node scripts/ux-audit-screens.mjs <ordner> [breite]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { installMock } from './mock/route.mjs';

const [dir = 'docs/ux-struktur/vorher', width = '1440'] = process.argv.slice(2);
const base = process.env.BASE ?? 'http://localhost:5173';
// [name, pfad, optional: Knopf (Text oder Regex), der vor dem Bild geklickt wird]
const shots = [
  ['cockpit', '/'],
  ['pipeline', '/sales'],
  ['pipeline-maske', '/sales', /Neue Opportunity|Neuer Deal|Neue Chance|Opportunity/i],
  ['offerten', '/angebote'],
  ['offerte-maske', '/angebote', /Neue Offerte|Neues Angebot/i],
  ['projekte', '/projekte'],
  ['zeiterfassung', '/zeiterfassung'],
  ['rechnungen', '/rechnungen'],
  ['rechnung-maske', '/rechnungen', /Neue Rechnung/i],
  ['buchungen', '/buchungen'],
  ['buchung-maske', '/buchungen', /Neue Buchung/i],
  ['auswertungen', '/auswertungen'],
  ['jahresabschluss', '/jahresabschluss'],
  ['kunden', '/kunden'],
  ['kunde-detail', '/kunden/00000000-0000-4000-8000-00000000c001'],
  ['kunde-kontakte', '/kunden/00000000-0000-4000-8000-00000000c001/kontakte'],
  ['kontakte', '/kontakte'],
  ['produkte', '/produkte'],
  ['einstellungen', '/settings'],
];
const only = process.env.PAGES?.split(',');
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: Number(width), height: 900 }, deviceScaleFactor: 1, timezoneId: 'Europe/Zurich', locale: 'de-CH',
});
await installMock(context);
await context.clock?.setFixedTime?.(new Date('2026-10-11T10:00:00+02:00'));
for (const [name, path, opener] of shots) {
  if (only && !only.includes(name)) continue;
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  if (opener) {
    const btn = page.getByRole('button', { name: opener }).first();
    if (await btn.count()) { await btn.click(); await page.waitForTimeout(700); } else console.warn(`kein Knopf fuer ${name}`);
  }
  const file = `${dir}/${name}-${width}.png`;
  await page.screenshot({ path: file, fullPage: process.env.FULL !== '0' });
  console.log(file, errors.length ? `Fehler: ${errors.join(' | ')}` : '');
  await page.close();
}
await browser.close();
