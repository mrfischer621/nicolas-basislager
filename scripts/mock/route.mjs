// Faengt Supabase-Anfragen in Playwright ab und liefert die Testdaten.
import { fixtures, USER } from './fixtures.mjs';

const REF = 'sswwgrjowchcgrqkazoo';

export async function installMock(context) {
  const now = Math.floor(Date.now() / 1000);
  const session = {
    access_token: 'mock', refresh_token: 'mock', token_type: 'bearer', expires_in: 3600 * 24 * 365,
    expires_at: now + 3600 * 24 * 365, user: { ...USER, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
  };
  await context.addInitScript(([key, value]) => localStorage.setItem(key, value), [`sb-${REF}-auth-token`, JSON.stringify(session)]);

  await context.route(`https://${REF}.supabase.co/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname.startsWith('/auth/v1/user')) return json(session.user);
    if (url.pathname.startsWith('/auth/v1/')) return json({});
    if (url.pathname.startsWith('/storage/v1/')) return json({ signedURL: '/favicon.svg' });
    const rpc = /\/rest\/v1\/rpc\/([a-z_]+)/.exec(url.pathname);
    if (rpc) return json(fixtures.rpc[rpc[1]] ?? null);
    const table = /\/rest\/v1\/([a-z_]+)/.exec(url.pathname)?.[1];
    if (req.method() !== 'GET') return json(null, 201);
    let rows = fixtures[table] ?? [];
    // einfache Filter: eq, neq und in auf einzelne Spalten
    for (const [k, v] of url.searchParams) {
      if (!rows.length || !(k in rows[0]) || k === 'company_id') continue;
      const m = /^eq\.(.*)$/.exec(v);
      if (m) rows = rows.filter((r) => String(r[k]) === m[1]);
      const ne = /^neq\.(.*)$/.exec(v);
      if (ne) rows = rows.filter((r) => String(r[k]) !== ne[1]);
      const inList = /^in\.\((.*)\)$/.exec(v);
      if (inList) {
        const values = inList[1].split(',').map((x) => decodeURIComponent(x).replace(/^"|"$/g, ''));
        rows = rows.filter((r) => values.includes(String(r[k])));
      }
    }
    if ((req.headers()['accept'] ?? '').includes('vnd.pgrst.object')) {
      return rows.length ? json(rows[0]) : json({ code: 'PGRST116', message: 'no rows' }, 406);
    }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}`, 'access-control-expose-headers': 'content-range' }, body: JSON.stringify(rows) });
  });
}
