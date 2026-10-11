// Oeffnet einen sichtbaren Browser auf der Login-Seite. Nach dem Anmelden
// (von Hand) wird der Sitzungszustand in .auth/state.json gespeichert
// (per .gitignore ausgeschlossen). Zugangsdaten werden nie gespeichert.
import { chromium } from 'playwright';

const base = process.env.APP_URL ?? 'http://localhost:5173';
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto(`${base}/login`);
console.log('Bitte im geoeffneten Browser anmelden ...');
await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60 * 60 * 1000 });
await page.waitForTimeout(2000);
await context.storageState({ path: '.auth/state.json' });
console.log('Sitzung gespeichert: .auth/state.json');
await browser.close();
