import { supabase } from '../lib/supabase';
import type { Category } from '../lib/supabase';
import { NO_CATEGORY, type DayRange, type FinanceEntry } from './financeAggregation';

/**
 * CSV fuer den Treuhaender: alle Eintraege des Zeitraums mit Kategorie,
 * Gegenpartei, Steuerrelevanz und einem 24 h gueltigen Link zum Beleg.
 * (Bisher unter Auswertungen, unveraendert uebernommen.)
 */
export async function downloadTreuhandCsv(entries: FinanceEntry[], categories: Pick<Category, 'name' | 'is_tax_relevant'>[], range: DayRange): Promise<void> {
  const withUrls = await Promise.all(
    entries.map(async (t) => {
      let url = '';
      if (t.receiptUrl) {
        try {
          const { data } = await supabase.storage.from('receipts').createSignedUrl(t.receiptUrl, 86400);
          url = data?.signedUrl || '';
        } catch {
          url = '';
        }
      }
      return { ...t, url };
    })
  );
  const byName = new Map(categories.map((c) => [c.name, c]));
  const headers = ['Datum', 'Beleg-Nr', 'Kategorie', 'Lieferant / Zahler', 'Steuerrelevant', 'Beschreibung', 'Betrag', 'Typ', 'Beleg-URL'];
  const rows = withUrls.map((t) => [
    `${t.date.slice(8, 10)}.${t.date.slice(5, 7)}.${t.date.slice(0, 4)}`,
    t.number || '',
    t.category || NO_CATEGORY,
    (t.counterparty || '').replace(/"/g, '""'),
    (t.category ? byName.get(t.category)?.is_tax_relevant ?? true : true) ? 'Ja' : 'Nein',
    (t.description || '').replace(/"/g, '""'),
    t.amount.toFixed(2),
    t.type === 'einnahme' ? 'Einnahme' : 'Ausgabe',
    t.url,
  ]);
  const csv = [headers.join(';'), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(';'))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `buchungen_${range.from}_bis_${range.to}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
