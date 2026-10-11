// Screenshots der wichtigsten Seiten (fuer docs/design-review/).
// Nutzt den gespeicherten Sitzungszustand aus .auth/state.json (gitignored).
// Aufruf: node scripts/screenshots.mjs <ordner> [basis-url] [hell|dunkel] [breite]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { installMock } from './mock/route.mjs';

// MOCK=1: erfundene Testdaten statt Live-Datenbank (fuer das oeffentliche Repo)
const mock = process.env.MOCK === '1';

const [dir = 'docs/design-review/nachher', base = 'http://localhost:5173', theme = 'hell', width = '1440'] = process.argv.slice(2);
const pages = (process.env.PAGES ?? 'login,dashboard,buchungen,buchung-maske,rechnungen,jahresabschluss,auswertungen,einstellungen').split(',');
const routes = {
  login: '/login',
  dashboard: '/',
  buchungen: '/buchungen',
  'buchung-maske': '/buchungen',
  rechnungen: '/rechnungen',
  jahresabschluss: '/jahresabschluss',
  auswertungen: '/auswertungen',
  einstellungen: '/settings',
  kategorien: '/settings?tab=categories',
  'rechnung-maske': '/rechnungen',
  kunden: '/kunden',
  projekte: '/projekte',
  produkte: '/produkte',
  zeiterfassung: '/zeiterfassung',
  offerten: '/angebote',
  sales: '/sales',
  kontakte: '/kontakte',
  registrieren: '/register',
};
const openers = { 'buchung-maske': /Neue Buchung/i, 'rechnung-maske': /Neue Rechnung/i };
fs.mkdirSync(dir, { recursive: true });
const hasState = mock || fs.existsSync('.auth/state.json');
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: Number(width), height: 900 },
  colorScheme: theme === 'dunkel' ? 'dark' : 'light',
  storageState: !mock && hasState ? '.auth/state.json' : undefined,
  deviceScaleFactor: 1,
  timezoneId: 'Europe/Zurich',
  locale: 'de-CH',
});
if (mock) {
  await installMock(context);
  await context.clock?.setFixedTime?.(new Date('2026-10-11T10:00:00+02:00'));
}
for (const name of pages) {
  if (!hasState && name !== 'login') continue;
  const page = await context.newPage();
  await page.goto(base + routes[name], { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  if (openers[name]) {
    await page.getByRole('button', { name: openers[name] }).first().click();
    await page.waitForTimeout(600);
  }
  const file = `${dir}/${name}-${theme}-${width}.png`;
  await page.screenshot({ path: file, fullPage: process.env.FULL === '1' });
  console.log(file);
  await page.close();
}
await browser.close();
