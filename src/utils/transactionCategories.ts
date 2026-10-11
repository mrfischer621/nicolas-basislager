import type { Category } from '../lib/supabase';

/**
 * Buchungen speichern die Kategorie als NAMEN (transactions.category ist Text,
 * kein Fremdschluessel), die Kategorien selbst tragen den Typ englisch
 * ('income' | 'expense'), die Buchungen deutsch ('einnahme' | 'ausgabe').
 * Diese Helfer halten beides an einer Stelle zusammen.
 */

export type TransactionType = 'einnahme' | 'ausgabe';

export function categoryTypeFor(type: TransactionType): Category['type'] {
  return type === 'einnahme' ? 'income' : 'expense';
}

export function transactionTypeFor(type: Category['type']): TransactionType {
  return type === 'income' ? 'einnahme' : 'ausgabe';
}

export interface CategoryOption {
  value: string; // Kategoriename, so wie er in transactions.category steht
  label: string;
  type: Category['type'] | null; // null = gespeicherter Name ohne passende Kategorie
  inactive: boolean;
}

/**
 * Baut die Auswahlliste fuer das Buchungsformular.
 *
 * - Aktive Kategorien erscheinen normal, gruppiert nach Typ.
 * - Ist der gespeicherte Name (beim Bearbeiten) nicht unter den aktiven
 *   Kategorien, wird er trotzdem als Option angeboten, mit "(inaktiv)", statt
 *   still durch eine andere Kategorie ersetzt zu werden.
 */
export function buildCategoryOptions(
  categories: Category[],
  storedName: string | null | undefined
): CategoryOption[] {
  const active = categories.filter((c) => c.is_active !== false);
  const options: CategoryOption[] = active.map((c) => ({
    value: c.name,
    label: c.name,
    type: c.type,
    inactive: false,
  }));

  if (storedName && !active.some((c) => c.name === storedName)) {
    const known = categories.find((c) => c.name === storedName);
    options.push({
      value: storedName,
      label: `${storedName} (inaktiv)`,
      type: known?.type ?? null,
      inactive: true,
    });
  }

  return options;
}

/** Erste aktive Kategorie des Typs, fuer den Default beim Neuanlegen. */
export function defaultCategoryName(categories: Category[], type: TransactionType): string {
  const wanted = categoryTypeFor(type);
  return categories.find((c) => c.is_active !== false && c.type === wanted)?.name ?? '';
}

/** Leere oder nur aus Leerzeichen bestehende Texte als NULL speichern. */
export function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Vorschlagsliste fuer Lieferant/Zahler: jeder Name nur einmal, Gross- und
 * Kleinschreibung egal. Bei verschiedenen Schreibweisen gewinnt die
 * haeufigste (bei Gleichstand die zuerst gesehene). Alphabetisch sortiert.
 */
export function distinctCounterparties(values: Array<string | null | undefined>): string[] {
  const byKey = new Map<string, Map<string, number>>();
  for (const raw of values) {
    const value = (raw ?? '').trim();
    if (!value) continue;
    const key = value.toLocaleLowerCase('de-CH');
    const spellings = byKey.get(key) ?? new Map<string, number>();
    spellings.set(value, (spellings.get(value) ?? 0) + 1);
    byKey.set(key, spellings);
  }
  return Array.from(byKey.values())
    .map((spellings) => {
      let best = '';
      let bestCount = 0;
      for (const [spelling, count] of spellings) {
        if (count > bestCount) {
          best = spelling;
          bestCount = count;
        }
      }
      return best;
    })
    .sort((a, b) => a.localeCompare(b, 'de-CH'));
}

/**
 * Lieferant zu einem Lieferanten-Text: erfasster Lieferant mit gleichem Namen
 * (Gross- und Kleinschreibung egal), sonst null. Nur Ausgaben haben einen.
 */
export function supplierIdFor(type: 'einnahme' | 'ausgabe' | undefined, name: string | null | undefined, suppliers: { id: string; name: string }[]): string | null {
  const key = (name ?? '').trim().toLocaleLowerCase('de-CH');
  if (type !== 'ausgabe' || !key) return null;
  return suppliers.find((s) => s.name.trim().toLocaleLowerCase('de-CH') === key)?.id ?? null;
}
