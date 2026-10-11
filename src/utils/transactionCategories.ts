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
