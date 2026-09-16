import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Regressionstest zum Fehler vom 16. September 2026.
 *
 * "npm audit fix" hob @tiptap/core und @tiptap/pm auf 3.31.3, waehrend
 * @tiptap/react, @tiptap/starter-kit und alle Extensions auf 3.20.0 blieben.
 * Folge: Der Rich-Text-Editor in den Rechnungspositionen stuerzte beim Mounten
 * ab ("Cannot read properties of null (reading 'cached')"), die ganze Ansicht
 * blieb leer. Die TipTap-Pakete stammen aus einem Monorepo und werden nur
 * zusammen getestet; ein gemischter Baum ist immer kaputt.
 *
 * Der Test liest das Lock-File, nicht node_modules: So faellt der Fehler auch
 * dann auf, wenn jemand nur committet und nicht installiert.
 */
describe('Abhaengigkeiten', () => {
  it('haelt alle @tiptap-Pakete auf derselben Version', () => {
    const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
    const nachVersion = new Map<string, string[]>();

    for (const [pfad, eintrag] of Object.entries(lock.packages as Record<string, { version?: string }>)) {
      if (!pfad.includes('node_modules/@tiptap/')) continue;
      const version = eintrag.version;
      if (!version) continue;
      const name = pfad.slice(pfad.lastIndexOf('node_modules/@tiptap/') + 'node_modules/'.length);
      nachVersion.set(version, [...(nachVersion.get(version) ?? []), name]);
    }

    expect(nachVersion.size, 'mindestens ein @tiptap-Paket muss im Lock-File stehen').toBeGreaterThan(0);

    const uebersicht = [...nachVersion.entries()]
      .map(([version, pakete]) => `  ${version}: ${pakete.sort().join(', ')}`)
      .join('\n');

    expect(
      nachVersion.size,
      `Die @tiptap-Pakete laufen auf ${nachVersion.size} verschiedenen Versionen:\n${uebersicht}\n` +
        'Alle auf dieselbe Version bringen, sonst stuerzt der Rich-Text-Editor ab.',
    ).toBe(1);
  });
});
