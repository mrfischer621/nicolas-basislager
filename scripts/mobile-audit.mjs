// Handy-Audit: Screenshots aller Seiten und Masken bei 375, 390 und 430 px,
// hell und Tiefsee, dazu automatische Messungen (Ueberlauf, Touch-Ziele,
// Schriftgroesse in Formularen, Lage der Hauptaktion).
// Nur mit erfundenen Testdaten (Mock), weil das Repository oeffentlich ist.
// Aufruf (Dev-Server auf :5173): node scripts/mobile-audit.mjs <ordner>
//   WIDTHS=390 THEMES=hell PAGES=cockpit,rechnungen  zum Eingrenzen
//   FULL=1  zusaetzlich ganze Seite (nur 390 hell)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { installMock } from './mock/route.mjs';

const [dir = 'docs/mobile/vorher'] = process.argv.slice(2);
const base = process.env.BASE ?? 'http://localhost:5173';
const widths = (process.env.WIDTHS ?? '375,390,430').split(',').map(Number);
const themes = (process.env.THEMES ?? 'hell,tiefsee').split(',');
const heights = { 375: 667, 390: 844, 430: 932 };
const C1 = '00000000-0000-4000-8000-00000000c001';

// [name, pfad, optional: Aktion vor dem Bild]
const shots = [
  ['login', '/login', 'logout'],
  ['cockpit', '/'],
  ['kontakte', '/kontakte'],
  ['personen', '/kontakte?ansicht=personen'],
  ['lieferanten', '/kontakte?ansicht=lieferanten'],
  ['firma', `/kontakte/firmen/${C1}`],
  ['firma-verlauf', `/kontakte/firmen/${C1}?tab=verlauf`],
  ['leads', '/leads'],
  ['pipeline', '/pipeline'],
  ['pipeline-tabelle', '/pipeline?darstellung=tabelle'],
  ['pipeline-board', '/pipeline?darstellung=board'],
  ['offerten', '/offerten'],
  ['offerte', '/offerten/00000000-0000-4000-8000-q00000000002'],
  ['projekte', '/projekte'],
  ['projekt', '/projekte/00000000-0000-4000-8000-p00000000001'],
  ['zeiterfassung', '/zeiterfassung'],
  ['zeit-auswertung', '/zeiterfassung?ansicht=auswertung'],
  ['rechnungen', '/rechnungen'],
  ['rechnung', '/rechnungen/00000000-0000-4000-8000-00000000f005'],
  ['buchungen', '/buchungen'],
  ['buchungen-unvollstaendig', '/buchungen?ansicht=unvollstaendig'],
  ['berichte', '/berichte'],
  ['erfolgsrechnung', '/berichte?tab=erfolgsrechnung'],
  ['jahresabschluss', '/berichte?tab=jahresabschluss'],
  ['export', '/berichte?tab=export'],
  ...['unternehmen', 'ziele', 'kontostaende', 'fristen', 'rechnungen-offerten', 'leistungen', 'kategorien', 'pipeline', 'darstellung', 'benutzer']
    .map((b) => [`einst-${b}`, `/einstellungen/${b}`]),
  // Masken, Menues, Suche
  ['menue', '/', { click: { role: 'button', name: 'Menü öffnen' } }],
  ['benutzermenue', '/', { click: { role: 'button', name: 'Benutzermenü und Firmenwechsel' } }],
  ['suche', '/', { click: { role: 'button', name: /^Suche$/ } }],
  ['zeit-neu', '/zeiterfassung?neu=1'],
  ['buchung-neu', '/buchungen?neu=1'],
  ['rechnung-neu', '/rechnungen?neu=1'],
  ['offerte-neu', '/offerten?neu=1'],
  ['lead-neu', '/leads?neu=1'],
  ['deal-neu', '/pipeline?neu=1'],
  ['firma-neu', '/kontakte?neu=1'],
  ['projekt-neu', '/projekte?neu=1'],
  ['rechnungen-zeilenmenue', '/rechnungen', { click: { role: 'button', name: /^Aktionen für/ } }],
  ['buchung-detail', '/buchungen', { clickCss: 'ul li button.text-left' }],
  ['lead-detail', '/leads', { clickCss: 'ul li button.text-left' }],
  ['zahlungsdaten', '/rechnungen', { click: { role: 'button', name: /Zahlungsdaten nachtragen/i } }],
  ['timer-laeuft', '/rechnungen', 'timer'],
  ['timer-stopp', '/', { timer: true, click: { role: 'button', name: 'Timer stoppen und speichern' } }],
];
const only = process.env.PAGES?.split(',');

// Laeuft im Browser: misst die sichtbare Ansicht
function measure() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[aria-hidden="true"],[inert]');
  };
  const label = (el) => {
    const t = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.getAttribute('name') || el.id || '').trim().replace(/\s+/g, ' ');
    return `${el.tagName.toLowerCase()}${el.type ? `[${el.type}]` : ''} «${t.slice(0, 40)}»`;
  };
  // Ueberlauf: die Seite selbst und der Scrollbereich in <main>
  const scroller = document.querySelector('main > div');
  const pageOverflow = Math.max(document.documentElement.scrollWidth - vw, scroller ? scroller.scrollWidth - scroller.clientWidth : 0);
  // Elemente, die rechts aus dem Bild ragen (ausser in eigenen Scrollbereichen)
  const inScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && p !== scroller) return p;
    }
    return null;
  };
  const sticking = [];
  const xScrollers = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) {
      const sc = inScroller(el);
      if (sc) { xScrollers.add(sc); continue; }
      if (el.children.length && [...el.children].some((c) => c.getBoundingClientRect().right > vw + 1)) continue;
      sticking.push(`${label(el)} rechts ${Math.round(r.right - vw)} px`);
    }
  }
  // Touch-Ziele
  const interactive = [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=menuitem],[role=option],[role=switch],[tabindex="0"]')]
    .filter(visible);
  const small = [];
  const tiny = [];
  for (const el of interactive) {
    let r = el.getBoundingClientRect();
    // Checkbox/Radio in einem Label: das Label zaehlt als Ziel
    const lab = (el.type === 'checkbox' || el.type === 'radio') && el.closest('label');
    if (lab) r = lab.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh * 3) continue;
    const w = Math.round(r.width), h = Math.round(r.height);
    if (w < 24 || h < 24) tiny.push(`${label(el)} ${w}×${h}`);
    else if (w < 44 || h < 44) small.push(`${label(el)} ${w}×${h}`);
  }
  // Formularfelder: Schrift < 16 px zoomt iOS beim Fokus heran
  const fields = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]),select,textarea')].filter(visible);
  const smallFont = fields.filter((f) => parseFloat(getComputedStyle(f).fontSize) < 16).map((f) => `${label(f)} ${getComputedStyle(f).fontSize}`);
  const fieldInfo = fields.map((f) => `${label(f)} type=${f.type || f.tagName.toLowerCase()} inputmode=${f.getAttribute('inputmode') ?? '-'} autocomplete=${f.getAttribute('autocomplete') ?? '-'}`);
  const unlabeled = fields.filter((f) => !(f.labels?.length || f.getAttribute('aria-label') || f.getAttribute('aria-labelledby'))).map(label);
  const fileInputs = [...document.querySelectorAll('input[type=file]')].map((f) => `accept=${f.accept || '-'} capture=${f.getAttribute('capture') ?? '-'}`);
  // Hauptaktion (Pill) und ihre Lage
  const ctas = [...document.querySelectorAll('.btn-cta')].filter(visible).map((el) => {
    const r = el.getBoundingClientRect();
    return `${label(el)} y=${Math.round(r.top)}/${vh} (${r.top > vh ? 'unter dem Rand' : r.top > vh * 0.6 ? 'Daumenzone' : 'oben'})`;
  });
  // Kleine Schrift
  let tinyText = 0;
  for (const el of document.querySelectorAll('body *')) {
    if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    if (visible(el) && parseFloat(getComputedStyle(el).fontSize) < 12) tinyText++;
  }
  const truncated = [...document.querySelectorAll('.truncate')].filter((el) => visible(el) && el.scrollWidth > el.clientWidth + 1).map((el) => el.innerText.slice(0, 40));
  const dialog = document.querySelector('[role=dialog],[role=menu],[role=listbox]');
  const dialogBox = dialog && visible(dialog) ? (() => { const r = dialog.getBoundingClientRect(); return `${dialog.getAttribute('role')} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}`; })() : null;
  const bar = document.querySelector('nav[aria-label="Schnellzugriff"]');
  return {
    pageOverflow, sticking: sticking.slice(0, 8), xScrollers: xScrollers.size,
    interactive: interactive.length, small: small.slice(0, 25), smallCount: small.length, tiny: tiny.slice(0, 25), tinyCount: tiny.length,
    smallFont, fieldInfo, unlabeled, fileInputs, ctas, tinyText, truncated: truncated.slice(0, 8), dialogBox,
    h1: [...document.querySelectorAll('h1')].map((h) => h.innerText).join(' | '),
    mobileBar: bar && visible(bar) ? Math.round(bar.getBoundingClientRect().height) : 0,
    contentHeight: scroller ? scroller.scrollHeight : document.documentElement.scrollHeight,
  };
}

fs.mkdirSync(dir, { recursive: true });
const report = {};
const browser = await chromium.launch();
for (const width of widths) {
  for (const theme of themes) {
    const context = await browser.newContext({
      viewport: { width, height: heights[width] ?? 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      timezoneId: 'Europe/Zurich', locale: 'de-CH',
    });
    await installMock(context);
    if (theme === 'tiefsee') await context.addInitScript(() => localStorage.setItem('bw-theme', 'dark'));
    await context.clock?.setFixedTime?.(new Date('2026-10-11T10:00:00+02:00'));
    const out = `${dir}/${width}-${theme}`;
    fs.mkdirSync(out, { recursive: true });
    for (const [name, path, action] of shots) {
      if (only && !only.includes(name)) continue;
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      if (action === 'logout') await page.addInitScript(() => localStorage.clear());
      // laufender Timer seit 42 Minuten (Timer-Leiste auf dem Handy)
      if (action === 'timer' || action?.timer) {
        await page.addInitScript(() => localStorage.setItem('basislager_timer', JSON.stringify({
          isRunning: true, isPaused: false, startTime: Date.now(), elapsedSeconds: 2520,
          selectedProjectId: '', description: 'Startseite umsetzen', billable: true,
        })));
      }
      await page.goto(base + path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      if (action?.click) {
        const btn = page.getByRole(action.click.role, { name: action.click.name }).first();
        if (await btn.count()) { await btn.click(); await page.waitForTimeout(600); } else errors.push('Ausloeser nicht gefunden');
      } else if (action?.clickCss) {
        const el = page.locator(action.clickCss).first();
        if (await el.count()) { await el.click(); await page.waitForTimeout(700); } else errors.push('Ausloeser nicht gefunden');
      }
      const m = await page.evaluate(measure);
      m.errors = errors;
      report[`${name}@${width}-${theme}`] = m;
      // JPEG halbiert die Groesse; Text bleibt bei Faktor 2 lesbar
      await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 70 });
      if (process.env.FULL === '1' && width === 390 && theme === 'hell' && !action) {
        await page.addStyleTag({ content: 'html,body,.h-screen,.h-dvh{height:auto!important;overflow:visible!important} main,main>div{overflow:visible!important;height:auto!important}' });
        await page.waitForTimeout(200);
        fs.mkdirSync(`${dir}/390-hell-ganz`, { recursive: true });
        await page.screenshot({ path: `${dir}/390-hell-ganz/${name}.jpg`, type: 'jpeg', quality: 60, fullPage: true });
      }
      console.log(`${width} ${theme} ${name}`, m.pageOverflow > 0 ? `UEBERLAUF ${m.pageOverflow}px` : '', errors.length ? `Fehler: ${errors.join(' | ').slice(0, 120)}` : '');
      await page.close();
    }
    await context.close();
  }
}
await browser.close();
fs.writeFileSync(`${dir}/messungen-${widths.join("_")}-${themes.join("_")}.json`, JSON.stringify(report, null, 1));
console.log("fertig");
