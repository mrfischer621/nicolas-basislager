import { describe, it, expect } from 'vitest';
import { legacyTarget } from './legacy';

describe('Weiterleitungen alter URLs', () => {
  it.each([
    ['/sales', '', '/pipeline'],
    ['/angebote', '?customerId=1&opportunityId=2', '/offerten?customerId=1&opportunityId=2'],
    ['/produkte', '?id=5', '/einstellungen/leistungen?id=5'],
    ['/kunden', '', '/kontakte?ansicht=firmen'],
    ['/kunden/abc', '', '/kontakte/firmen/abc'],
    ['/kunden/abc/kontakte', '', '/kontakte/firmen/abc?tab=personen'],
    ['/auswertungen', '', '/berichte?tab=uebersicht'],
    ['/jahresabschluss', '', '/berichte?tab=jahresabschluss'],
    ['/settings', '', '/einstellungen/unternehmen'],
    ['/settings', '?tab=categories', '/einstellungen/kategorien'],
    ['/settings', '?tab=pipeline', '/einstellungen/pipeline'],
    ['/settings', '?tab=unbekannt', '/einstellungen/unternehmen'],
    ['/rechnungen', '?filter=ohne-zahlungsdatum', '/rechnungen?ansicht=bezahlt&ohne-zahlungsdatum=1'],
  ])('%s%s -> %s', (path, search, target) => {
    expect(legacyTarget(path, search)).toBe(target);
  });

  it('laesst neue URLs in Ruhe', () => {
    expect(legacyTarget('/rechnungen', '?ansicht=offen')).toBeNull();
    expect(legacyTarget('/kontakte', '?ansicht=personen')).toBeNull();
    expect(legacyTarget('/', '')).toBeNull();
  });
});
