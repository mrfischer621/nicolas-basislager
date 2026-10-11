/**
 * Zustand einer Listenansicht in der URL (Lesezeichen, Zurueck-Knopf, Links
 * von anderen Seiten). Reine Funktionen, damit sie ohne Browser testbar sind.
 *
 * Schluessel (einheitlich auf allen Listen):
 *   ansicht  gewaehlter Tab (z.B. "offen")
 *   q        Suchtext
 *   firma    customer_id
 *   projekt  project_id
 *   von/bis  Zeitraum 'YYYY-MM-DD'
 *   seite    1-basiert
 *   sort     Spalte, mit "-" davor absteigend
 * Weitere seitenspezifische Schluessel sind erlaubt.
 */
export type ListState = Record<string, string>;

export const PAGE_SIZE = 50;

/** Liest alle Parameter; leere Werte gelten als nicht gesetzt. */
export function readListState(params: URLSearchParams, defaults: ListState = {}): ListState {
  const state: ListState = { ...defaults };
  params.forEach((value, key) => {
    if (value !== '') state[key] = value;
  });
  return state;
}

/**
 * Setzt Werte und gibt die neuen Parameter zurueck. Werte gleich dem Standard
 * oder leer werden entfernt, damit die URL kurz bleibt. Jede Aenderung ausser
 * an "seite" setzt die Seite zurueck.
 */
export function writeListState(
  current: URLSearchParams,
  patch: Record<string, string | null | undefined>,
  defaults: ListState = {}
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === '' || defaults[key] === value) next.delete(key);
    else next.set(key, value);
  }
  if (!('seite' in patch)) next.delete('seite');
  return next;
}

/** Anzahl aktiver Filter (ohne Ansicht, Seite und Sortierung) fuer "3 Filter". */
export function activeFilterCount(state: ListState, defaults: ListState = {}): number {
  return Object.entries(state).filter(
    ([k, v]) => !['ansicht', 'seite', 'sort', 'gruppe', 'darstellung', 'tab'].includes(k) && v !== '' && defaults[k] !== v
  ).length;
}

/** Seite (1-basiert) zu Bereich fuer Supabase .range(from, to). */
export function pageRange(page: number, size = PAGE_SIZE): [number, number] {
  const p = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  return [(p - 1) * size, p * size - 1];
}

/** "-date" -> { column: 'date', ascending: false } */
export function parseSort(sort: string | undefined, fallback: string): { column: string; ascending: boolean } {
  const s = sort || fallback;
  return s.startsWith('-') ? { column: s.slice(1), ascending: false } : { column: s, ascending: true };
}

/** Escapet % und _ fuer ilike-Suchen, damit Eingaben nicht als Muster wirken. */
export function ilikePattern(q: string): string {
  return `%${q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * Wert fuer .or() von PostgREST: Kommas und Klammern im Suchtext wuerden die
 * Filterliste aufbrechen, deshalb werden sie entfernt.
 */
export function orSearch(columns: string[], q: string): string {
  const pattern = ilikePattern(q.replace(/[,()]/g, ' '));
  return columns.map((c) => `${c}.ilike.${pattern}`).join(',');
}
