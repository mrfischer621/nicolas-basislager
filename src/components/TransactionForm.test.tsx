// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import type { Category, Transaction } from '../lib/supabase';

// Regressionstest fuer den Fehler "Aufwandskategorie geht beim erneuten Oeffnen
// verloren": Das Formular verglich den gespeicherten Kategorienamen mit der ID,
// zeigte deshalb die erste Kategorie an und schrieb beim Speichern NULL.

const cat = (name: string, type: 'income' | 'expense', is_active = true): Category => ({
  id: `id-${name}`,
  company_id: 'c1',
  name,
  type,
  icon: null,
  color: '#000',
  is_tax_relevant: true,
  sort_order: 0,
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

vi.mock('../lib/supabase', () => {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => Promise.resolve({ data: categories, error: null }),
  };
  return { supabase: { from: () => query, storage: { from: () => ({}) } } };
});
vi.mock('../context/CompanyContext', () => ({
  useCompany: () => ({ selectedCompany: { id: 'c1' } }),
}));
vi.mock('../context/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

import TransactionForm from './TransactionForm';

const a021: Transaction = {
  id: 't1',
  company_id: 'c1',
  type: 'ausgabe',
  date: '2026-09-11',
  amount: 80.65,
  description: 'Claude Abo (Max 5x)',
  category: 'Informatik & Telekom',
  project_id: null,
  customer_id: null,
  invoice_id: null,
  document_url: null,
  receipt_url: null,
  tags: null,
  billable: false,
  transaction_number: 'A021',
  created_at: '',
};

function renderForm(transaction?: Transaction) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <TransactionForm
      transaction={transaction}
      onSubmit={onSubmit}
      onCancel={() => {}}
      customers={[]}
      projects={[]}
    />
  );
  return { onSubmit };
}

async function categorySelect() {
  const select = (await screen.findByLabelText('Kategorie')) as HTMLSelectElement;
  await waitFor(() => expect(select.disabled).toBe(false));
  return select;
}

afterEach(cleanup);

describe('TransactionForm Kategorie', () => {
  it('zeigt beim Bearbeiten die gespeicherte Kategorie an', async () => {
    renderForm(a021);
    const select = await categorySelect();
    expect(select.value).toBe('Informatik & Telekom');
  });

  it('schreibt beim Speichern ohne Aenderung dieselbe Kategorie zurueck', async () => {
    const { onSubmit } = renderForm(a021);
    await categorySelect();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].category).toBe('Informatik & Telekom');
  });

  it('behaelt eine inaktive Kategorie und markiert sie', async () => {
    renderForm({ ...a021, category: 'Bankspesen' });
    const select = await categorySelect();
    expect(select.value).toBe('Bankspesen');
    expect(select.selectedOptions[0].textContent).toBe('Bankspesen (inaktiv)');
  });

  it('setzt den Default nur beim Neuanlegen', async () => {
    renderForm();
    const select = await categorySelect();
    expect(select.value).toBe('Warenaufwand');
  });

  it('laesst eine Buchung ohne Kategorie ohne Kategorie', async () => {
    renderForm({ ...a021, category: null });
    const select = await categorySelect();
    expect(select.value).toBe('');
  });
});
