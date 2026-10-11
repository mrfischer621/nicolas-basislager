/**
 * Weiterleitungen alter URLs auf die neue Struktur (docs/ux-struktur/konzept.md,
 * Abschnitt 3), damit Lesezeichen weiter funktionieren. Bestehende Parameter
 * bleiben erhalten; Parameter, die es nicht mehr gibt, werden uebersetzt.
 */

/** alter ?tab= der Einstellungen -> neuer Bereich */
export const SETTINGS_TAB_TO_SECTION: Record<string, string> = {
  company: 'unternehmen',
  profile: 'benutzer',
  templates: 'rechnungen-offerten',
  categories: 'kategorien',
  product_categories: 'produktkategorien',
  pipeline: 'pipeline',
};

function withParams(path: string, params: URLSearchParams): string {
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}

/** Ziel fuer eine alte URL, sonst null. */
export function legacyTarget(pathname: string, search: string): string | null {
  const params = new URLSearchParams(search);
  const path = pathname.replace(/\/+$/, '') || '/';

  if (path === '/sales') return withParams('/pipeline', params);
  if (path === '/angebote') return withParams('/offerten', params);
  if (path === '/produkte') return withParams('/einstellungen/leistungen', params);

  if (path === '/kunden') {
    params.set('ansicht', 'firmen');
    return withParams('/kontakte', params);
  }
  const contacts = /^\/kunden\/([^/]+)\/kontakte$/.exec(path);
  if (contacts) {
    params.set('tab', 'personen');
    return withParams(`/kontakte/firmen/${contacts[1]}`, params);
  }
  const customer = /^\/kunden\/([^/]+)$/.exec(path);
  if (customer) return withParams(`/kontakte/firmen/${customer[1]}`, params);

  if (path === '/auswertungen') {
    params.set('tab', 'uebersicht');
    return withParams('/berichte', params);
  }
  if (path === '/jahresabschluss') {
    params.set('tab', 'jahresabschluss');
    return withParams('/berichte', params);
  }

  if (path === '/settings') {
    const tab = params.get('tab');
    params.delete('tab');
    const section = (tab && SETTINGS_TAB_TO_SECTION[tab]) || 'unternehmen';
    return withParams(`/einstellungen/${section}`, params);
  }

  if (path === '/rechnungen' && params.get('filter') === 'ohne-zahlungsdatum') {
    params.delete('filter');
    params.set('ansicht', 'bezahlt');
    params.set('ohne-zahlungsdatum', '1');
    return withParams('/rechnungen', params);
  }

  return null;
}
