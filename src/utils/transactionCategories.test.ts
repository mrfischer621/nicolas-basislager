import { describe, it, expect } from 'vitest';
import type { Category } from '../lib/supabase';
import { buildCategoryOptions, defaultCategoryName, emptyToNull } from './transactionCategories';

const cat = (name: string, type: 'income' | 'expense', is_active = true, sort_order = 0): Category => ({
  id: `id-${name}`,
  company_id: 'c1',
  name,
  type,
  icon: null,
  color: '#000',
  is_tax_relevant: true,
  sort_order,
  is_active,
  created_at: '',
  updated_at: '',
});

const categories = [
  cat('Dienstleistungsumsatz', 'income'),
  cat('Warenaufwand', 'expense'),
  cat('Informatik & Telekom', 'expense'),
  cat('Bankspesen', 'expense', false),
];

describe('buildCategoryOptions', () => {
  it('bietet die gespeicherte aktive Kategorie unveraendert an', () => {
    const options = buildCategoryOptions(categories, 'Informatik & Telekom');
    expect(options.filter((o) => o.value === 'Informatik & Telekom')).toHaveLength(1);
    expect(options.some((o) => o.inactive)).toBe(false);
  });

  it('behaelt eine inaktive gespeicherte Kategorie als Option "(inaktiv)"', () => {
    const options = buildCategoryOptions(categories, 'Bankspesen');
    const stored = options.find((o) => o.value === 'Bankspesen');
    expect(stored).toEqual({ value: 'Bankspesen', label: 'Bankspesen (inaktiv)', type: 'expense', inactive: true });
  });

  it('behaelt auch einen Namen ohne passende Kategorie', () => {
    const options = buildCategoryOptions(categories, 'Gibt es nicht mehr');
    expect(options.find((o) => o.value === 'Gibt es nicht mehr')?.type).toBeNull();
  });

  it('blendet inaktive Kategorien ohne Bezug aus', () => {
    expect(buildCategoryOptions(categories, null).some((o) => o.value === 'Bankspesen')).toBe(false);
  });
});

describe('defaultCategoryName', () => {
  it('nimmt die erste aktive Kategorie des passenden Typs (ausgabe -> expense)', () => {
    expect(defaultCategoryName(categories, 'ausgabe')).toBe('Warenaufwand');
    expect(defaultCategoryName(categories, 'einnahme')).toBe('Dienstleistungsumsatz');
  });
});

describe('emptyToNull', () => {
  it('speichert leere Texte als NULL', () => {
    expect(emptyToNull('')).toBeNull();
    expect(emptyToNull('   ')).toBeNull();
    expect(emptyToNull(undefined)).toBeNull();
    expect(emptyToNull(' Anthropic ')).toBe('Anthropic');
  });
});
